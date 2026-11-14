import type { SqlDatabase } from '../storage/repository';
import type { Cursor, PulledRun } from './types';

/**
 * Accès SQL du moteur de synchronisation à `sprinter-v1.db`. Toutes les écritures passent
 * par la file unique du dépôt de courses : une page reçue et l'avancée du curseur sont
 * appliquées dans la même transaction (§7.4).
 */
export interface OutboxEntry {
  seq: number; entity: 'run' | 'settings' | 'route'; entityId: string; op: 'upsert' | 'delete';
  createdAt: number; attempts: number; nextAttemptAt: number; lastError: string | null; version: number;
}
export interface LocalRunForPush { id: string; startedAt: number; updatedAt: number; payload: Record<string, unknown>; pointsCount: number }

export const BLOCK_AFTER_ATTEMPTS = 5;
type Serialize = <T>(operation: (db: SqlDatabase) => Promise<T>) => Promise<T>;

async function transaction<T>(db: SqlDatabase, body: () => Promise<T>): Promise<T> {
  await db.execAsync('BEGIN IMMEDIATE');
  try { const result = await body(); await db.execAsync('COMMIT'); return result; }
  catch (error) { await db.execAsync('ROLLBACK'); throw error; }
}

export class SyncLocalStore {
  constructor(private serialize: Serialize) {}

  // ------------------------------------------------------------------ État
  getState(key: string) {
    return this.serialize(async (db) => (await db.getFirstAsync<{ value: string }>('SELECT value FROM sync_state WHERE key = ?', key))?.value ?? null);
  }
  setState(key: string, value: string | null) {
    return this.serialize(async (db) => {
      if (value === null) await db.runAsync('DELETE FROM sync_state WHERE key = ?', key);
      else await db.runAsync('INSERT INTO sync_state (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', key, value);
    });
  }
  statesWithPrefix(prefix: string): Promise<[string, string][]> {
    return this.serialize(async (db) => (await db.getAllAsync<{ key: string; value: string }>(
      'SELECT key, value FROM sync_state WHERE substr(key, 1, length(?)) = ?', prefix, prefix)).map((row) => [row.key, row.value]));
  }
  /** Lie l'appareil à un compte (§7.6 A). Refuse silencieusement un autre compte (scénario D). */
  bind(userId: string): Promise<'bound' | 'same' | 'other'> {
    return this.serialize(async (db) => {
      const current = (await db.getFirstAsync<{ value: string }>("SELECT value FROM sync_state WHERE key = 'bound_user_id'"))?.value;
      if (current === userId) return 'same';
      if (current) return 'other';
      await db.runAsync("INSERT INTO sync_state (key, value) VALUES ('bound_user_id', ?)", userId);
      return 'bound';
    });
  }

  // ------------------------------------------------------------------ Outbox
  dueOutbox(now: number, limit: number, entity: OutboxEntry['entity']): Promise<OutboxEntry[]> {
    return this.serialize((db) => db.getAllAsync<OutboxEntry>(
      `SELECT seq, entity, entity_id AS entityId, op, created_at AS createdAt, attempts, next_attempt_at AS nextAttemptAt,
              last_error AS lastError, version FROM sync_outbox
       WHERE entity = ? AND parked = 0 AND attempts < ? AND next_attempt_at <= ? ORDER BY seq LIMIT ?`,
      entity, BLOCK_AFTER_ATTEMPTS, now, limit));
  }
  counts() {
    return this.serialize(async (db) => {
      const row = await db.getFirstAsync<{ pending: number; blocked: number }>(
        `SELECT COALESCE(SUM(CASE WHEN attempts < ${BLOCK_AFTER_ATTEMPTS} AND parked = 0 THEN 1 ELSE 0 END), 0) AS pending,
                COALESCE(SUM(CASE WHEN attempts >= ${BLOCK_AFTER_ATTEMPTS} AND parked = 0 THEN 1 ELSE 0 END), 0) AS blocked FROM sync_outbox`);
      return { pending: row?.pending ?? 0, blocked: row?.blocked ?? 0 };
    });
  }
  blockedEntries() {
    return this.serialize((db) => db.getAllAsync<{ entityId: string; lastError: string | null }>(
      `SELECT entity_id AS entityId, last_error AS lastError FROM sync_outbox WHERE attempts >= ${BLOCK_AFTER_ATTEMPTS} AND parked = 0 ORDER BY seq`));
  }
  /** Retire uniquement la version envoyée : une modification plus récente reste à traiter (§7.4). */
  complete(entry: OutboxEntry, meta: { serverUpdatedAt?: string | null; validity?: string | null; reasons?: string[] | null; deleted?: boolean }) {
    return this.serialize((db) => transaction(db, async () => {
      await db.runAsync('DELETE FROM sync_outbox WHERE entity = ? AND entity_id = ? AND version = ?', entry.entity, entry.entityId, entry.version);
      if (meta.deleted) await db.runAsync('DELETE FROM sync_meta WHERE entity = ? AND entity_id = ?', entry.entity, entry.entityId);
      else await db.runAsync(
        `INSERT INTO sync_meta (entity, entity_id, server_updated_at, synced_at, validity, validity_reasons) VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(entity, entity_id) DO UPDATE SET server_updated_at = excluded.server_updated_at, synced_at = excluded.synced_at,
           validity = COALESCE(excluded.validity, sync_meta.validity), validity_reasons = COALESCE(excluded.validity_reasons, sync_meta.validity_reasons)`,
        entry.entity, entry.entityId, meta.serverUpdatedAt ?? null, Date.now(), meta.validity ?? null, meta.reasons ? JSON.stringify(meta.reasons) : null);
    }));
  }
  fail(entry: OutboxEntry, error: string, nextAttemptAt: number, permanent: boolean) {
    return this.serialize((db) => db.runAsync(
      `UPDATE sync_outbox SET attempts = CASE WHEN ? THEN ${BLOCK_AFTER_ATTEMPTS} ELSE attempts + 1 END, last_error = ?, next_attempt_at = ?
       WHERE entity = ? AND entity_id = ? AND version = ?`, permanent ? 1 : 0, error.slice(0, 120), nextAttemptAt, entry.entity, entry.entityId, entry.version));
  }
  retryBlocked() {
    return this.serialize((db) => db.runAsync('UPDATE sync_outbox SET attempts = 0, next_attempt_at = 0, last_error = NULL WHERE parked = 0'));
  }
  /** Import initial (§7.6 A, C) : chaque course locale jamais synchronisée entre dans l'outbox. Reprenable. */
  enqueueUnsynced(now: number): Promise<number> {
    return this.serialize(async (db) => {
      const result = await db.runAsync(
        `INSERT INTO sync_outbox (entity, entity_id, op, created_at, attempts, next_attempt_at, version)
         SELECT 'run', r.id, 'upsert', ?, 0, 0, 1 FROM runs r
         WHERE NOT EXISTS (SELECT 1 FROM sync_meta m WHERE m.entity = 'run' AND m.entity_id = r.id)
           AND NOT EXISTS (SELECT 1 FROM sync_outbox o WHERE o.entity = 'run' AND o.entity_id = r.id)`, now) as { changes?: number };
      return Number(result?.changes ?? 0);
    });
  }

  // ------------------------------------------------------------------ Courses
  /** Courses à envoyer, sans leurs points GPS (retirés par SQLite, sans analyse en JavaScript). */
  runsForPush(ids: string[]): Promise<LocalRunForPush[]> {
    if (!ids.length) return Promise.resolve([]);
    return this.serialize(async (db) => {
      const rows = await db.getAllAsync<{ id: string; started_at: number; updated_at: number | null; payload: string; points: number | null }>(
        `SELECT id, started_at, updated_at, json_remove(payload, '$.points') AS payload, json_array_length(payload, '$.points') AS points
         FROM runs WHERE id IN (${ids.map(() => '?').join(', ')}) AND json_valid(payload)`, ...ids);
      return rows.map((row) => ({
        id: row.id, startedAt: row.started_at, updatedAt: row.updated_at ?? row.started_at,
        payload: JSON.parse(row.payload) as Record<string, unknown>, pointsCount: row.points ?? 0,
      }));
    });
  }
  localRunIds() { return this.serialize(async (db) => (await db.getAllAsync<{ id: string }>('SELECT id FROM runs')).map((row) => row.id)); }
  syncedRunIds() {
    return this.serialize(async (db) => (await db.getAllAsync<{ id: string }>("SELECT entity_id AS id FROM sync_meta WHERE entity = 'run'")).map((row) => row.id));
  }
  validity(id: string) {
    return this.serialize((db) => db.getFirstAsync<{ validity: string | null; reasons: string | null }>(
      "SELECT validity, validity_reasons AS reasons FROM sync_meta WHERE entity = 'run' AND entity_id = ?", id));
  }
  /** Supprime des courses de CET appareil (suppression confirmée ailleurs) sans rien envoyer. */
  deleteLocal(ids: string[]) {
    if (!ids.length) return Promise.resolve();
    return this.serialize((db) => transaction(db, async () => {
      for (const id of ids) {
        await db.runAsync('DELETE FROM runs WHERE id = ?', id);
        await db.runAsync("DELETE FROM sync_outbox WHERE entity IN ('run', 'route') AND entity_id = ?", id);
        await db.runAsync("DELETE FROM sync_meta WHERE entity IN ('run', 'route') AND entity_id = ?", id);
      }
    }));
  }
  /** Met de côté les écritures en attente de courses supprimées ailleurs (§7.7) : jamais renvoyées. */
  park(ids: string[]) {
    if (!ids.length) return Promise.resolve();
    return this.serialize((db) => db.runAsync(
      `UPDATE sync_outbox SET parked = 1 WHERE entity = 'run' AND entity_id IN (${ids.map(() => '?').join(', ')})`, ...ids));
  }
  /** Garde une course supprimée ailleurs sur cet appareil seulement : elle ne repartira plus. */
  keepLocalOnly(ids: string[]) {
    if (!ids.length) return Promise.resolve();
    return this.serialize((db) => transaction(db, async () => {
      for (const id of ids) {
        await db.runAsync("UPDATE sync_outbox SET parked = 1 WHERE entity = 'run' AND entity_id = ?", id);
        await db.runAsync("INSERT INTO sync_outbox (entity, entity_id, op, created_at, parked) VALUES ('run', ?, 'upsert', ?, 1) ON CONFLICT(entity, entity_id) DO UPDATE SET parked = 1", id, Date.now());
        await db.runAsync("DELETE FROM sync_meta WHERE entity = 'run' AND entity_id = ?", id);
      }
    }));
  }

  /**
   * Applique une page reçue et avance le curseur dans une même transaction. Idempotent :
   * rejouer une page laisse le même état. Une modification locale plus récente en attente
   * l'emporte sur la version reçue ; une suppression locale en attente aussi.
   */
  applyPage(items: PulledRun[], cursor: Cursor | null): Promise<{ changed: number }> {
    return this.serialize((db) => transaction(db, async () => {
      let changed = 0;
      for (const item of items) {
        const pending = await db.getFirstAsync<{ op: string; created_at: number; parked: number }>(
          "SELECT op, created_at, parked FROM sync_outbox WHERE entity = 'run' AND entity_id = ?", item.id);
        const remoteAt = Date.parse(item.client_updated_at);
        if (item.deleted) {
          const removed = await db.runAsync('DELETE FROM runs WHERE id = ?', item.id) as { changes?: number };
          await db.runAsync("DELETE FROM sync_outbox WHERE entity IN ('run', 'route') AND entity_id = ?", item.id);
          await db.runAsync("DELETE FROM sync_meta WHERE entity IN ('run', 'route') AND entity_id = ?", item.id);
          changed += Number(removed?.changes ?? 0);
          continue;
        }
        if (pending && !pending.parked && (pending.op === 'delete' || pending.created_at > remoteAt)) continue;
        const local = await db.getFirstAsync<{ points: string | null }>(
          "SELECT json_extract(payload, '$.points') AS points FROM runs WHERE id = ? AND json_valid(payload)", item.id);
        const payload = { ...(item.payload ?? {}), points: local?.points ? JSON.parse(local.points) : [] } as Record<string, unknown>;
        if (item.tz && payload.tz === undefined) payload.tz = item.tz;
        // Tracé disponible en ligne mais pas ici : téléchargement à la demande (§8.4).
        if (item.has_route && !(payload.points as unknown[]).length) payload.cloudRoute = true; else delete payload.cloudRoute;
        if (item.best_efforts && payload.bestEfforts === undefined) payload.bestEfforts = item.best_efforts;
        const startedAt = Number(payload.startedAt);
        if (!Number.isFinite(startedAt)) continue;
        await db.runAsync(
          `INSERT INTO runs (id, started_at, payload, updated_at) VALUES (?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET started_at = excluded.started_at, payload = excluded.payload, updated_at = excluded.updated_at`,
          item.id, startedAt, JSON.stringify(payload), remoteAt);
        if (pending && !pending.parked) await db.runAsync("DELETE FROM sync_outbox WHERE entity = 'run' AND entity_id = ?", item.id);
        await db.runAsync(
          `INSERT INTO sync_meta (entity, entity_id, server_updated_at, synced_at, validity, validity_reasons) VALUES ('run', ?, ?, ?, ?, ?)
           ON CONFLICT(entity, entity_id) DO UPDATE SET server_updated_at = excluded.server_updated_at, synced_at = excluded.synced_at,
             validity = excluded.validity, validity_reasons = excluded.validity_reasons`,
          item.id, item.server_updated_at, Date.now(), item.validity, JSON.stringify(item.validity_reasons ?? []));
        changed++;
      }
      if (cursor?.ts) {
        await db.runAsync("INSERT INTO sync_state (key, value) VALUES ('pull_cursor_ts', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", cursor.ts);
        await db.runAsync("INSERT INTO sync_state (key, value) VALUES ('pull_cursor_id', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", cursor.id ?? '');
      }
      return { changed };
    }));
  }

  // ------------------------------------------------------------------ Tracés GPS (phase 3)
  /** Courses déjà synchronisées, avec points locaux, dont le tracé n'est pas encore en ligne. */
  routeCandidates(limit: number) {
    return this.serialize(async (db) => (await db.getAllAsync<{ id: string }>(
      `SELECT r.id FROM runs r
       WHERE EXISTS (SELECT 1 FROM sync_meta m WHERE m.entity = 'run' AND m.entity_id = r.id)
         AND NOT EXISTS (SELECT 1 FROM sync_meta x WHERE x.entity = 'route' AND x.entity_id = r.id)
         AND json_valid(r.payload) AND COALESCE(json_array_length(r.payload, '$.points'), 0) > 0
       ORDER BY r.started_at DESC LIMIT ?`, limit)).map((row) => row.id));
  }
  pointsOf(id: string) {
    return this.serialize(async (db) => {
      const row = await db.getFirstAsync<{ points: string | null }>("SELECT json_extract(payload, '$.points') AS points FROM runs WHERE id = ? AND json_valid(payload)", id);
      return row?.points ? JSON.parse(row.points) as import('../core/types').TrackPoint[] : [];
    });
  }
  markRoute(id: string, state: 'uploaded' | 'too_large') {
    return this.serialize((db) => db.runAsync(
      `INSERT INTO sync_meta (entity, entity_id, server_updated_at, synced_at, validity) VALUES ('route', ?, NULL, ?, ?)
       ON CONFLICT(entity, entity_id) DO UPDATE SET synced_at = excluded.synced_at, validity = excluded.validity`, id, Date.now(), state));
  }
  clearRouteMeta() { return this.serialize((db) => db.runAsync("DELETE FROM sync_meta WHERE entity = 'route'")); }
  /** Courses dont le tracé est en ligne mais absent de l'appareil (préchargement en Wi-Fi). */
  cloudRouteRuns(limit: number) {
    return this.serialize(async (db) => (await db.getAllAsync<{ id: string }>(
      `SELECT id FROM runs WHERE json_valid(payload) AND json_extract(payload, '$.cloudRoute') = 1
         AND COALESCE(json_array_length(payload, '$.points'), 0) = 0 ORDER BY started_at DESC LIMIT ?`, limit)).map((row) => row.id));
  }
  /** Réintègre les points téléchargés dans la course locale, sans rien renvoyer au serveur. */
  attachPoints(id: string, points: import('../core/types').TrackPoint[]) {
    return this.serialize((db) => db.runAsync(
      "UPDATE runs SET payload = json_set(json_remove(payload, '$.cloudRoute'), '$.points', json(?)) WHERE id = ? AND json_valid(payload)",
      JSON.stringify(points), id));
  }

  // ------------------------------------------------------------------ Sauvegarde locale et changement de compte
  /** Copie locale des courses avant le premier import (§3, §7.6 A/C). */
  backupBeforeImport() {
    return this.serialize((db) => transaction(db, async () => {
      await db.execAsync('CREATE TABLE IF NOT EXISTS runs_backup (id TEXT PRIMARY KEY, started_at REAL NOT NULL, payload TEXT NOT NULL, updated_at REAL)');
      await db.execAsync('DELETE FROM runs_backup; INSERT INTO runs_backup (id, started_at, payload, updated_at) SELECT id, started_at, payload, updated_at FROM runs;');
      await db.runAsync("INSERT INTO sync_state (key, value) VALUES ('local_backup_at', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", String(Date.now()));
    }));
  }
  /** Scénario D : efface les données de l'ancien compte sur cet appareil, puis lie le nouveau. */
  resetForAccount(userId: string) {
    return this.serialize((db) => transaction(db, async () => {
      await db.execAsync('DELETE FROM runs; DELETE FROM sync_outbox; DELETE FROM sync_meta; DELETE FROM sync_state;');
      await db.execAsync('DROP TABLE IF EXISTS runs_backup');
      await db.runAsync("INSERT INTO sync_state (key, value) VALUES ('bound_user_id', ?)", userId);
    }));
  }
}
