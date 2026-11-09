import { afterEach, describe, expect, it } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { RunRepository, SqlDatabase, SqlValue, parseRun } from '../src/storage/repository';
import { RunEngine } from '../src/core/engine';
import { DEFAULT_SETTINGS, DEFAULT_TARGET, DEFAULT_CONFIG } from '../src/core/types';

const handles: DatabaseSync[] = [];
function database(): SqlDatabase {
  const db = new DatabaseSync(':memory:'); handles.push(db);
  return {
    async execAsync(sql) { db.exec(sql); },
    async runAsync(sql, ...params: SqlValue[]) { return db.prepare(sql).run(...params); },
    async getFirstAsync<T>(sql: string, ...params: SqlValue[]) { return (db.prepare(sql).get(...params) ?? null) as T | null; },
    async getAllAsync<T>(sql: string, ...params: SqlValue[]) { return db.prepare(sql).all(...params) as T[]; },
  };
}
const record = () => new RunEngine(DEFAULT_TARGET, DEFAULT_CONFIG, 0, 1800000000000, 'storage-test').record;
afterEach(() => { handles.splice(0).forEach(db => db.close()); });
describe('SQLite persistence using actual SQL', () => {
  it('persists settings and restores a checkpoint in a new repository instance', async () => {
    const db = database(); const repo = new RunRepository(db); await repo.initialize();
    const run = record(); run.activeSeconds = 50; run.totalSeconds = 50;
    await repo.saveDraft({ version: 1, revision: 4, savedAt: Date.now(), run });
    await repo.saveSettings({ ...DEFAULT_SETTINGS, audioEnabled: true });
    const reopened = new RunRepository(db); await reopened.initialize();
    expect((await reopened.loadDraft())!.run).toEqual(run);
    expect((await reopened.loadSettings()).audioEnabled).toBe(true);
  });
  it('atomically commits history and removes the checkpoint; late saves cannot resurrect it', async () => {
    const repo = new RunRepository(database()); await repo.initialize(); const run = record();
    await repo.saveDraft({ version: 1, revision: 1, savedAt: Date.now(), run });
    await repo.finish({ ...run, endedAt: Date.now() });
    await repo.saveDraft({ version: 1, revision: 100, savedAt: Date.now(), run });
    expect(await repo.loadDraft()).toBeNull(); expect(await repo.history()).toHaveLength(1);
    await repo.deleteRun(run.id); expect(await repo.history()).toHaveLength(0);
  });
  it('ignores an older asynchronous checkpoint revision', async () => {
    const repo = new RunRepository(database()); await repo.initialize(); const run = record();
    run.activeSeconds = 50; run.totalSeconds = 50; await repo.saveDraft({ version: 1, revision: 5, savedAt: Date.now(), run });
    run.activeSeconds = 10; run.totalSeconds = 10; await repo.saveDraft({ version: 1, revision: 1, savedAt: Date.now(), run });
    expect((await repo.loadDraft())!.run.activeSeconds).toBe(50);
  });
  it('rolls back a failed finish and retains the recovery checkpoint', async () => {
    const db = database(); let fail = false; const original = db.runAsync;
    db.runAsync = async (sql, ...parameters) => { if (fail && sql.startsWith('DELETE FROM draft')) throw new Error('Disk write failure'); return original(sql, ...parameters); };
    const repo = new RunRepository(db); await repo.initialize(); const run = record();
    await repo.saveDraft({ version: 1, revision: 1, savedAt: Date.now(), run }); fail = true;
    await expect(repo.finish({ ...run, endedAt: Date.now() })).rejects.toThrow('Disk write failure');
    expect(await repo.history()).toEqual([]); expect((await repo.loadDraft())?.run.id).toBe(run.id);
  });
  it('reports corrupt history rows without deleting them', async () => {
    const db = database(), repo = new RunRepository(db); await repo.initialize();
    await db.runAsync('INSERT INTO runs VALUES (?, ?, ?)', 'bad', 0, '{bad');
    expect(await repo.history()).toEqual([]); expect(repo.unreadableCount).toBe(1);
    expect(await db.getAllAsync('SELECT id FROM runs')).toHaveLength(1);
  });
  it('rejects corrupt record statistics', () => {
    expect(() => parseRun(JSON.stringify({ ...record(), reliableSeconds: 100 }))).toThrow();
  });
  it('writes only the route suffix to a transactional journal and reassembles a checkpoint', async () => {
    const db = database(), repo = new RunRepository(db); await repo.initialize();
    const run = new RunEngine(DEFAULT_TARGET, DEFAULT_CONFIG, 0, 1800000000000, 'journal');
    const fix = (t: number) => ({ latitude: 48 + t * 3 / 6371000 * 180 / Math.PI, longitude: 2, timestamp: 1800000000000 + t * 1000, accuracy: 4, speed: 3 });
    for (let t = 0; t <= 100; t++) run.process(fix(t), t, fix(t).timestamp);
    await repo.saveDraft({ version: 1, revision: 1, savedAt: 1800000100000, run: run.record });
    expect(await db.getAllAsync('SELECT point_id FROM draft_points')).toHaveLength(101);
    const header = JSON.parse((await db.getFirstAsync<{ payload: string }>('SELECT payload FROM draft'))!.payload);
    expect(header.run.points).toEqual([]); expect(header.pointCount).toBe(101);
    const original = db.runAsync; const inserts: number[] = [];
    db.runAsync = async (sql, ...params) => { if (sql.startsWith('INSERT INTO draft_points')) inserts.push(params.length / 3); return original(sql, ...params); };
    run.process(fix(101), 101, fix(101).timestamp);
    await repo.saveDraft({ version: 1, revision: 2, savedAt: 1800000101000, run: run.record });
    expect(inserts).toEqual([1]); expect((await repo.loadDraft())!.run).toEqual(run.record);
    await repo.finish(run.finish(1800000101000)); expect(await db.getAllAsync('SELECT point_id FROM draft_points')).toEqual([]);
    expect((await repo.history())[0]!.points).toHaveLength(102);
  });
  it('keeps the previous header and point journal intact if an incremental save fails', async () => {
    const db = database(), repo = new RunRepository(db); await repo.initialize(); const run = record();
    await repo.saveDraft({ version: 1, revision: 1, savedAt: 10, run });
    const original = db.runAsync; let fail = true;
    db.runAsync = async (sql, ...params) => { if (fail && sql.startsWith('INSERT INTO draft (')) throw new Error('Disk full'); return original(sql, ...params); };
    run.activeSeconds = 10; run.totalSeconds = 10;
    await expect(repo.saveDraft({ version: 1, revision: 2, savedAt: 20, run })).rejects.toThrow('Disk full');
    expect((await repo.loadDraft())!.revision).toBe(1); expect((await repo.loadDraft())!.run.activeSeconds).toBe(0);
    fail = false; await repo.saveDraft({ version: 1, revision: 3, savedAt: 30, run }); expect((await repo.loadDraft())!.revision).toBe(3);
  });
  it('loads an existing inline checkpoint and migrates it without losing its route', async () => {
    const db = database(), repo = new RunRepository(db); await repo.initialize(); const run = record();
    delete run.totalSeconds; delete run.ascentMeters; delete run.descentMeters; delete run.elevationReliableSeconds; delete run.autoPauseEnabled; delete run.autoPauseCount;
    await db.runAsync('INSERT INTO draft VALUES (1, ?, ?, ?)', run.id, 10, JSON.stringify({ version: 1, revision: 10, savedAt: 1234, run }));
    expect((await repo.loadDraft())!.run).toEqual(run);
    await repo.saveDraft({ version: 1, revision: 11, savedAt: 1235, run }); expect((await repo.loadDraft())!.run).toEqual(run);
  });
  it('reports an incomplete point journal without deleting its recovery data', async () => {
    const db = database(), repo = new RunRepository(db); await repo.initialize(); const run = record();
    await db.runAsync('INSERT INTO draft VALUES (1, ?, ?, ?)', run.id, 1, JSON.stringify({ version: 1, revision: 1, savedAt: 1234, pointCount: 2, run }));
    await expect(repo.loadDraft()).rejects.toThrow('incomplet'); expect(await db.getFirstAsync('SELECT payload FROM draft')).not.toBeNull();
  });
  it('rejects inconsistent route chronology, negative elevation and total time below active time', () => {
    expect(() => parseRun(JSON.stringify({ ...record(), activeSeconds: 50, totalSeconds: 20 }))).toThrow();
    expect(() => parseRun(JSON.stringify({ ...record(), ascentMeters: -2 }))).toThrow();
    const run = new RunEngine(DEFAULT_TARGET); run.process({ latitude: 48, longitude: 2, timestamp: Date.now(), speed: 3, accuracy: 4 }, 0, Date.now());
    run.record.points[0]!.id = 4; expect(() => parseRun(JSON.stringify(run.record))).toThrow('parcours');
  });
  it('persists the optional auto-pause preference and defaults legacy settings safely', async () => {
    const repo = new RunRepository(database()); await repo.initialize(); expect((await repo.loadSettings()).autoPauseEnabled).toBe(false);
    await repo.saveSettings({ ...DEFAULT_SETTINGS, autoPauseEnabled: true }); expect((await repo.loadSettings()).autoPauseEnabled).toBe(true);
  });
});
