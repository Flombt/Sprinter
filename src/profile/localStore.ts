// Stockage local du profil personnalisé (§17.6), dans une base séparée de l'historique des courses.
// Chaque ligne appartient à un titulaire (owner) : un autre compte, ou le mode invité, ne lit
// ni ne reprend jamais les brouillons, envois ou médias d'un autre compte.
//   profile_saved  : version privée enregistrée (révision serveur connue, -1 = à relire)
//   profile_draft  : modifications en cours, sauvegardées immédiatement (review = conflit ou refus à revoir)
//   profile_outbox : changements enregistrés à envoyer (rejouables : op_id, révision de base)
//   profile_media  : images locales et état de leur transfert
import type { SqlDatabase, SqlValue } from '../storage/repository';
import { kindOf, payloadMedia, type Payload, type ProfileDoc } from './model';

export interface SavedElement { key: string; payload: Payload | null; deleted: boolean; revision: number }
export interface DraftElement { key: string; payload: Payload | null; deleted: boolean; review: string | null; updatedAt: number }
export interface OutboxItem {
  key: string; opId: string; prevOpId: string | null; payload: Payload | null; deleted: boolean;
  baseRevision: number; clientUpdatedAt: string; attempts: number; lastError: string | null;
}
export type MediaState = 'local' | 'uploaded' | 'ready' | 'remote' | 'rejected';
export interface LocalMedia {
  id: string; usage: 'avatar' | 'banner' | 'gallery'; mime: string; bytes: number; width: number; height: number;
  uri: string | null; path: string | null; state: MediaState; createdAt: number; animated?: boolean;
}
export type SaveResult =
  | { key: string; status: 'applied'; revision: number }
  | { key: string; status: 'conflict'; revision: number; payload: Payload; deleted: boolean }
  | { key: string; status: 'deferred' | 'rejected'; reason: string };
export interface RemoteElement { key: string; payload: Payload; deleted: boolean; revision: number }

const SCHEMA = `
CREATE TABLE IF NOT EXISTS profile_saved (owner TEXT NOT NULL, key TEXT NOT NULL, payload TEXT, deleted INTEGER NOT NULL DEFAULT 0,
  revision INTEGER NOT NULL DEFAULT 0, updated_at REAL NOT NULL, PRIMARY KEY (owner, key));
CREATE TABLE IF NOT EXISTS profile_draft (owner TEXT NOT NULL, key TEXT NOT NULL, payload TEXT, deleted INTEGER NOT NULL DEFAULT 0,
  review TEXT, updated_at REAL NOT NULL, PRIMARY KEY (owner, key));
CREATE TABLE IF NOT EXISTS profile_outbox (owner TEXT NOT NULL, key TEXT NOT NULL, op_id TEXT NOT NULL, prev_op_id TEXT, payload TEXT,
  deleted INTEGER NOT NULL DEFAULT 0, base_revision INTEGER NOT NULL, client_updated_at TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT, PRIMARY KEY (owner, key));
CREATE TABLE IF NOT EXISTS profile_media (owner TEXT NOT NULL, id TEXT NOT NULL, usage TEXT NOT NULL, mime TEXT NOT NULL, bytes INTEGER NOT NULL,
  width INTEGER NOT NULL, height INTEGER NOT NULL, uri TEXT, path TEXT, state TEXT NOT NULL, created_at REAL NOT NULL,
  animated INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (owner, id));
CREATE TABLE IF NOT EXISTS profile_meta (owner TEXT NOT NULL, key TEXT NOT NULL, value TEXT, PRIMARY KEY (owner, key));`;

type Row = Record<string, SqlValue>;
const parse = (text: SqlValue | undefined): Payload | null => {
  if (typeof text !== 'string') return null;
  try { const value = JSON.parse(text) as unknown; return value && typeof value === 'object' && !Array.isArray(value) ? value as Payload : null; }
  catch { return null; }
};
const same = (a: Payload | null, b: Payload | null) => JSON.stringify(a) === JSON.stringify(b);

export class ProfileLocalStore {
  private queue: Promise<unknown> = Promise.resolve();
  private ready: Promise<void> | null = null;
  constructor(private db: SqlDatabase) {}

  initialize() {
    this.ready ??= (async () => {
      await this.db.execAsync(`PRAGMA journal_mode = WAL;${SCHEMA}`);
      // Base créée par une version 8a : colonne des médias animés (8b).
      const columns = await this.db.getAllAsync<{ name: string }>('PRAGMA table_info(profile_media)');
      if (!columns.some((column) => column.name === 'animated')) await this.db.execAsync('ALTER TABLE profile_media ADD COLUMN animated INTEGER NOT NULL DEFAULT 0');
    })();
    return this.ready;
  }
  /** Un seul écrivain à la fois ; les changements liés passent dans une même transaction. */
  private run<T>(operation: () => Promise<T>): Promise<T> {
    const next = this.queue.then(async () => { await this.initialize(); return operation(); });
    this.queue = next.catch(() => undefined);
    return next;
  }
  private transaction<T>(operation: () => Promise<T>): Promise<T> {
    return this.run(async () => {
      await this.db.execAsync('BEGIN IMMEDIATE');
      try { const result = await operation(); await this.db.execAsync('COMMIT'); return result; }
      catch (error) { await this.db.execAsync('ROLLBACK'); throw error; }
    });
  }

  // -------------------------------------------------------------------------------------
  // Lecture
  // -------------------------------------------------------------------------------------
  saved(owner: string): Promise<SavedElement[]> {
    return this.run(async () => (await this.db.getAllAsync<Row>('SELECT key, payload, deleted, revision FROM profile_saved WHERE owner = ? ORDER BY key', owner))
      .map((row) => ({ key: String(row.key), payload: parse(row.payload), deleted: row.deleted === 1, revision: Number(row.revision) })));
  }
  drafts(owner: string): Promise<DraftElement[]> {
    return this.run(async () => (await this.db.getAllAsync<Row>('SELECT key, payload, deleted, review, updated_at FROM profile_draft WHERE owner = ? ORDER BY key', owner))
      .map((row) => ({ key: String(row.key), payload: parse(row.payload), deleted: row.deleted === 1, review: row.review === null ? null : String(row.review), updatedAt: Number(row.updated_at) })));
  }
  outbox(owner: string, limit = 40): Promise<OutboxItem[]> {
    return this.run(async () => (await this.db.getAllAsync<Row>(
      'SELECT key, op_id, prev_op_id, payload, deleted, base_revision, client_updated_at, attempts, last_error FROM profile_outbox WHERE owner = ? ORDER BY key LIMIT ?', owner, limit))
      .map((row) => ({
        key: String(row.key), opId: String(row.op_id), prevOpId: row.prev_op_id === null ? null : String(row.prev_op_id), payload: parse(row.payload),
        deleted: row.deleted === 1, baseRevision: Number(row.base_revision), clientUpdatedAt: String(row.client_updated_at),
        attempts: Number(row.attempts), lastError: row.last_error === null ? null : String(row.last_error),
      })));
  }
  async counts(owner: string) {
    return this.run(async () => {
      const pending = await this.db.getFirstAsync<{ n: number }>('SELECT count(*) AS n FROM profile_outbox WHERE owner = ?', owner);
      const drafts = await this.db.getFirstAsync<{ n: number }>('SELECT count(*) AS n FROM profile_draft WHERE owner = ?', owner);
      const review = await this.db.getFirstAsync<{ n: number }>('SELECT count(*) AS n FROM profile_draft WHERE owner = ? AND review IS NOT NULL', owner);
      return { pending: pending?.n ?? 0, drafts: drafts?.n ?? 0, review: review?.n ?? 0 };
    });
  }
  /** Version enregistrée, et version de travail (enregistrée + brouillon). */
  async documents(owner: string): Promise<{ saved: ProfileDoc; working: ProfileDoc; drafts: DraftElement[] }> {
    const [saved, drafts] = await Promise.all([this.saved(owner), this.drafts(owner)]);
    const savedDoc: ProfileDoc = {};
    for (const element of saved) savedDoc[element.key] = element.deleted ? null : element.payload;
    const working: ProfileDoc = { ...savedDoc };
    for (const draft of drafts) working[draft.key] = draft.deleted ? null : draft.payload;
    return { saved: savedDoc, working, drafts };
  }

  // -------------------------------------------------------------------------------------
  // Brouillon : chaque geste est écrit tout de suite sur l'appareil.
  // -------------------------------------------------------------------------------------
  editDraft(owner: string, key: string, payload: Payload | null, now: number) {
    return this.transaction(async () => {
      const saved = await this.db.getFirstAsync<Row>('SELECT payload, deleted FROM profile_saved WHERE owner = ? AND key = ?', owner, key);
      const savedValue = saved ? (saved.deleted === 1 ? null : parse(saved.payload)) : null;
      const review = await this.db.getFirstAsync<Row>('SELECT review FROM profile_draft WHERE owner = ? AND key = ?', owner, key);
      if (same(savedValue, payload) && !review?.review) {
        await this.db.runAsync('DELETE FROM profile_draft WHERE owner = ? AND key = ?', owner, key);
        return;
      }
      await this.db.runAsync(`INSERT INTO profile_draft (owner, key, payload, deleted, review, updated_at) VALUES (?, ?, ?, ?, NULL, ?)
        ON CONFLICT (owner, key) DO UPDATE SET payload = excluded.payload, deleted = excluded.deleted, review = NULL, updated_at = excluded.updated_at`,
        owner, key, payload === null ? null : JSON.stringify(payload), payload === null ? 1 : 0, now);
    });
  }
  discardDraft(owner: string, keys?: string[]) {
    return this.transaction(async () => {
      if (!keys) { await this.db.runAsync('DELETE FROM profile_draft WHERE owner = ?', owner); return; }
      for (const key of keys) await this.db.runAsync('DELETE FROM profile_draft WHERE owner = ? AND key = ?', owner, key);
    });
  }

  /** « Enregistrer » : le brouillon devient la version privée, et part dans la file d'envoi (même transaction). */
  save(owner: string, now: number, uuid: () => string): Promise<number> {
    return this.transaction(async () => {
      const drafts = await this.db.getAllAsync<Row>('SELECT key, payload, deleted FROM profile_draft WHERE owner = ?', owner);
      for (const draft of drafts) {
        const key = String(draft.key);
        const saved = await this.db.getFirstAsync<Row>('SELECT revision FROM profile_saved WHERE owner = ? AND key = ?', owner, key);
        const revision = saved ? Number(saved.revision) : 0;
        await this.db.runAsync(`INSERT INTO profile_saved (owner, key, payload, deleted, revision, updated_at) VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT (owner, key) DO UPDATE SET payload = excluded.payload, deleted = excluded.deleted, updated_at = excluded.updated_at`,
          owner, key, draft.payload ?? null, draft.deleted ?? 0, revision, now);
        const queued = await this.db.getFirstAsync<Row>('SELECT op_id, prev_op_id, attempts, base_revision FROM profile_outbox WHERE owner = ? AND key = ?', owner, key);
        // Une opération déjà tentée a pu être appliquée sans que la réponse arrive : on la cite pour éviter un faux conflit.
        const prev = queued ? (Number(queued.attempts) > 0 ? String(queued.op_id) : (queued.prev_op_id === null || queued.prev_op_id === undefined ? null : String(queued.prev_op_id))) : null;
        const base = queued ? Number(queued.base_revision) : Math.max(revision, 0);
        await this.db.runAsync(`INSERT INTO profile_outbox (owner, key, op_id, prev_op_id, payload, deleted, base_revision, client_updated_at, attempts, last_error)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, NULL)
          ON CONFLICT (owner, key) DO UPDATE SET op_id = excluded.op_id, prev_op_id = excluded.prev_op_id, payload = excluded.payload,
            deleted = excluded.deleted, base_revision = excluded.base_revision, client_updated_at = excluded.client_updated_at, attempts = 0, last_error = NULL`,
          owner, key, uuid(), prev, draft.payload ?? null, draft.deleted ?? 0, base, new Date(now).toISOString());
      }
      await this.db.runAsync('DELETE FROM profile_draft WHERE owner = ?', owner);
      return drafts.length;
    });
  }

  // -------------------------------------------------------------------------------------
  // Résultats d'envoi et réception
  // -------------------------------------------------------------------------------------
  applyResult(owner: string, opId: string, result: SaveResult, now: number) {
    return this.transaction(async () => {
      const queued = await this.db.getFirstAsync<Row>('SELECT op_id, payload, deleted FROM profile_outbox WHERE owner = ? AND key = ?', owner, result.key);
      if (result.status === 'applied') {
        await this.db.runAsync('UPDATE profile_saved SET revision = ? WHERE owner = ? AND key = ?', result.revision, owner, result.key);
        if (queued && String(queued.op_id) === opId) await this.db.runAsync('DELETE FROM profile_outbox WHERE owner = ? AND key = ?', owner, result.key);
        else if (queued) await this.db.runAsync('UPDATE profile_outbox SET base_revision = ?, prev_op_id = NULL WHERE owner = ? AND key = ?', result.revision, owner, result.key);
        return;
      }
      if (result.status === 'deferred') {
        await this.db.runAsync('UPDATE profile_outbox SET attempts = attempts + 1, last_error = ? WHERE owner = ? AND key = ?', result.reason, owner, result.key);
        return;
      }
      // Conflit ou refus : la version serveur fait foi, le changement local reste en brouillon à revoir (§17.6).
      if (queued) {
        await this.db.runAsync(`INSERT INTO profile_draft (owner, key, payload, deleted, review, updated_at) VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT (owner, key) DO UPDATE SET review = excluded.review`,
          owner, result.key, queued.payload ?? null, queued.deleted ?? 0, result.status === 'conflict' ? 'conflict' : `rejected:${result.reason}`, now);
        await this.db.runAsync('DELETE FROM profile_outbox WHERE owner = ? AND key = ?', owner, result.key);
      }
      if (result.status === 'conflict') await this.writeSaved(owner, result.key, result.payload, result.deleted, result.revision, now);
      else await this.db.runAsync('UPDATE profile_saved SET revision = -1 WHERE owner = ? AND key = ?', owner, result.key);
    });
  }
  markAttempt(owner: string, keys: string[], error: string) {
    return this.transaction(async () => {
      for (const key of keys) await this.db.runAsync('UPDATE profile_outbox SET attempts = attempts + 1, last_error = ? WHERE owner = ? AND key = ?', error, owner, key);
    });
  }
  private async writeSaved(owner: string, key: string, payload: Payload | null, deleted: boolean, revision: number, now: number) {
    await this.db.runAsync(`INSERT INTO profile_saved (owner, key, payload, deleted, revision, updated_at) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT (owner, key) DO UPDATE SET payload = excluded.payload, deleted = excluded.deleted, revision = excluded.revision, updated_at = excluded.updated_at`,
      owner, key, deleted ? null : JSON.stringify(payload), deleted ? 1 : 0, revision, now);
  }
  /** Version serveur : appliquée aux éléments sans envoi en attente, si elle est plus récente. */
  applyRemote(owner: string, elements: RemoteElement[], now: number) {
    return this.transaction(async () => {
      let changed = 0;
      const keys = new Set(elements.map((element) => element.key));
      for (const element of elements) {
        if (await this.db.getFirstAsync('SELECT 1 FROM profile_outbox WHERE owner = ? AND key = ?', owner, element.key)) continue;
        const local = await this.db.getFirstAsync<Row>('SELECT revision FROM profile_saved WHERE owner = ? AND key = ?', owner, element.key);
        if (local && Number(local.revision) >= element.revision) continue;
        await this.writeSaved(owner, element.key, element.payload, element.deleted, element.revision, now);
        changed++;
      }
      // Élément refusé jamais enregistré côté serveur : retour à la valeur par défaut.
      const stale = await this.db.getAllAsync<Row>('SELECT key FROM profile_saved WHERE owner = ? AND revision = -1', owner);
      for (const row of stale) {
        if (keys.has(String(row.key))) continue;
        await this.db.runAsync('DELETE FROM profile_saved WHERE owner = ? AND key = ?', owner, String(row.key));
        changed++;
      }
      return changed;
    });
  }

  // -------------------------------------------------------------------------------------
  // Médias
  // -------------------------------------------------------------------------------------
  addMedia(owner: string, media: LocalMedia) {
    return this.run(() => this.db.runAsync(`INSERT INTO profile_media (owner, id, usage, mime, bytes, width, height, uri, path, state, created_at, animated)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT (owner, id) DO UPDATE SET uri = coalesce(excluded.uri, uri), path = coalesce(excluded.path, path), state = excluded.state`,
      owner, media.id, media.usage, media.mime, media.bytes, media.width, media.height, media.uri, media.path, media.state, media.createdAt, media.animated ? 1 : 0));
  }
  updateMedia(owner: string, id: string, patch: Partial<Pick<LocalMedia, 'state' | 'path' | 'uri'>>) {
    return this.run(async () => {
      if (patch.state !== undefined) await this.db.runAsync('UPDATE profile_media SET state = ? WHERE owner = ? AND id = ?', patch.state, owner, id);
      if (patch.path !== undefined) await this.db.runAsync('UPDATE profile_media SET path = ? WHERE owner = ? AND id = ?', patch.path, owner, id);
      if (patch.uri !== undefined) await this.db.runAsync('UPDATE profile_media SET uri = ? WHERE owner = ? AND id = ?', patch.uri, owner, id);
    });
  }
  media(owner: string): Promise<LocalMedia[]> {
    return this.run(async () => (await this.db.getAllAsync<Row>('SELECT * FROM profile_media WHERE owner = ? ORDER BY created_at', owner)).map((row) => ({
      id: String(row.id), usage: String(row.usage) as LocalMedia['usage'], mime: String(row.mime), bytes: Number(row.bytes), width: Number(row.width),
      height: Number(row.height), uri: row.uri === null ? null : String(row.uri), path: row.path === null ? null : String(row.path),
      state: String(row.state) as MediaState, createdAt: Number(row.created_at), animated: row.animated === 1,
    })));
  }
  /** Médias encore utilisés par la version enregistrée, le brouillon ou un envoi en attente. */
  async referencedMedia(owner: string): Promise<Set<string>> {
    const [saved, drafts, outbox] = await Promise.all([this.saved(owner), this.drafts(owner), this.outbox(owner, 1000)]);
    return new Set([...saved, ...drafts, ...outbox].flatMap((element) => payloadMedia(element.payload)));
  }
  removeMedia(owner: string, ids: string[]) {
    return this.transaction(async () => { for (const id of ids) await this.db.runAsync('DELETE FROM profile_media WHERE owner = ? AND id = ?', owner, id); });
  }

  getMeta(owner: string, key: string) {
    return this.run(async () => { const row = await this.db.getFirstAsync<Row>('SELECT value FROM profile_meta WHERE owner = ? AND key = ?', owner, key); return row?.value === undefined || row.value === null ? null : String(row.value); });
  }
  setMeta(owner: string, key: string, value: string | null) {
    return this.run(() => value === null
      ? this.db.runAsync('DELETE FROM profile_meta WHERE owner = ? AND key = ?', owner, key)
      : this.db.runAsync('INSERT INTO profile_meta (owner, key, value) VALUES (?, ?, ?) ON CONFLICT (owner, key) DO UPDATE SET value = excluded.value', owner, key, value));
  }

  /** Efface tout ce qui appartient à un titulaire (compte supprimé, ou effacement demandé). */
  forget(owner: string) {
    return this.transaction(async () => {
      for (const table of ['profile_saved', 'profile_draft', 'profile_outbox', 'profile_media', 'profile_meta']) {
        await this.db.runAsync(`DELETE FROM ${table} WHERE owner = ?`, owner);
      }
    });
  }
}

export const elementKind = kindOf;
