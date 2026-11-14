import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it } from 'vitest';
import { RunRepository, type SqlDatabase, type SqlValue } from '../src/storage/repository';
import { RunEngine } from '../src/core/engine';
import { DEFAULT_CONFIG, DEFAULT_TARGET } from '../src/core/types';
import { SyncLocalStore } from '../src/sync/localStore';
import { shoeMileage } from '../src/progression/aggregates';

const handles: DatabaseSync[] = [];
afterEach(() => { handles.splice(0).forEach((db) => db.close()); });
function database(): SqlDatabase {
  const db = new DatabaseSync(':memory:'); handles.push(db);
  return {
    async execAsync(sql) { db.exec(sql); },
    async runAsync(sql, ...params: SqlValue[]) { return db.prepare(sql).run(...params); },
    async getFirstAsync<T>(sql: string, ...params: SqlValue[]) { return (db.prepare(sql).get(...params) ?? null) as T | null; },
    async getAllAsync<T>(sql: string, ...params: SqlValue[]) { return db.prepare(sql).all(...params) as T[]; },
  };
}
const record = (id: string, startedAt: number) => ({
  ...new RunEngine(DEFAULT_TARGET, DEFAULT_CONFIG, 0, startedAt, id).record,
  endedAt: startedAt + 1_800_000, activeSeconds: 1500, totalSeconds: 1600, distanceMeters: 5000, reliableSeconds: 1400,
});

describe('migration SQLite v3 → v4 (§7.2)', () => {
  it('conserve les courses v1, v2, v3 et les imports Santé, puis les rend synchronisables', async () => {
    const db = database();
    // Base telle qu'écrite par la version actuelle de l'app (schéma v3, sans updated_at).
    await db.execAsync(`CREATE TABLE runs (id TEXT PRIMARY KEY, started_at REAL NOT NULL, payload TEXT NOT NULL);
      CREATE TABLE settings (slot INTEGER PRIMARY KEY CHECK(slot = 1), payload TEXT NOT NULL);
      PRAGMA user_version = 3;`);
    const v1 = { ...record('1700000000000-aaaaaaaaaa', 1_700_000_000_000) } as Record<string, unknown>; delete v1.dataVersion;
    const v2 = { ...record('1700000100000-bbbbbbbbbb', 1_700_000_100_000), dataVersion: 2 };
    const v3 = { ...record('1700000200000-cccccccccc', 1_700_000_200_000), dataVersion: 3, shoeId: 'chaussure-disparue', plannedEntryId: 'seance-inconnue', routeId: 'route-supprimee', routeName: 'Boucle' };
    const uuid = '0f1e2d3c-4b5a-4968-8776-655443322110';
    const health = { ...record(`healthkit:${uuid}`, 1_700_000_300_000), dataVersion: 3, points: [], targetUnavailable: true,
      healthKit: { uuid, sourceName: 'Montre', sourceBundle: 'com.apple.health', importedAt: 1, originalRunId: null } };
    for (const run of [v1, v2, v3, health] as { id: string; startedAt: number }[]) {
      await db.runAsync('INSERT INTO runs (id, started_at, payload) VALUES (?, ?, ?)', run.id, run.startedAt, JSON.stringify(run));
    }
    const repo = new RunRepository(db);
    await repo.initialize();
    expect((await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version'))?.user_version).toBe(4);
    const history = await repo.history();
    expect(history.map((run) => run.id).sort()).toEqual([v1.id, v2.id, v3.id, health.id].sort());
    expect(repo.unreadableCount).toBe(0);
    expect(history.every((run) => run.dataVersion === 3)).toBe(true);
    const rows = await db.getAllAsync<{ updated_at: number; started_at: number }>('SELECT updated_at, started_at FROM runs');
    expect(rows.every((row) => row.updated_at === row.started_at)).toBe(true);
    // Rien n'est mis en file tant que l'appareil n'est lié à aucun compte.
    expect(await db.getAllAsync('SELECT * FROM sync_outbox')).toEqual([]);
    const local = new SyncLocalStore((operation) => repo.serialized(operation));
    await local.bind('user-a');
    expect(await local.enqueueUnsynced(Date.now())).toBe(4);
    expect(await local.enqueueUnsynced(Date.now())).toBe(0);
    // Réouverture : migration idempotente, garde contre une base plus récente.
    await new RunRepository(db).initialize();
    await db.execAsync('PRAGMA user_version = 5');
    await expect(new RunRepository(db).initialize()).rejects.toThrow(/version plus récente/);
  });

  it('écrit l’outbox dans la même transaction que la course, et l’annule avec elle', async () => {
    const db = database(), repo = new RunRepository(db);
    await repo.initialize();
    await new SyncLocalStore((operation) => repo.serialized(operation)).bind('user-a');
    const original = db.runAsync;
    db.runAsync = async (sql, ...params) => { if (sql.startsWith('DELETE FROM draft WHERE')) throw new Error('Disque plein'); return original(sql, ...params); };
    await expect(repo.finish(record('r-fail', 1_800_000_000_000))).rejects.toThrow('Disque plein');
    expect(await db.getAllAsync('SELECT * FROM runs')).toEqual([]);
    expect(await db.getAllAsync('SELECT * FROM sync_outbox')).toEqual([]);
    db.runAsync = original;
    await repo.finish(record('r-ok', 1_800_000_000_000));
    await repo.deleteRun('r-ok');
    expect(await db.getAllAsync('SELECT entity_id, op, version FROM sync_outbox')).toEqual([{ entity_id: 'r-ok', op: 'delete', version: 2 }]);
  });

  it('gère les références orphelines sans plantage (§7.9)', () => {
    const run = { ...record('orphan', 1_800_000_000_000), shoeId: 'inconnue', plannedEntryId: 'absente' };
    const data = { shoes: [], journals: [] } as unknown as Parameters<typeof shoeMileage>[1];
    expect(() => shoeMileage([run], data, 'inconnue')).not.toThrow();
    expect(shoeMileage([run], data, 'inconnue').totalMeters).toBeGreaterThanOrEqual(0);
  });
});
