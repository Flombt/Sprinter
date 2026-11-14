import { RunRecord, Settings, DEFAULT_SETTINGS } from '../core/types';
import { validateTarget } from '../core/format';
import { sanitizeConfig } from '../core/coach';
import { validWorkoutSnapshot } from '../workouts/definition';
import { validPacingSnapshot } from '../pacing/engine';
import { migrateActivity } from './migrations';
import { sanitizeCoaching } from '../coaching/config';

export type SqlValue = string | number | null;
export interface SqlDatabase {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, ...parameters: SqlValue[]): Promise<unknown>;
  getFirstAsync<T>(sql: string, ...parameters: SqlValue[]): Promise<T | null>;
  getAllAsync<T>(sql: string, ...parameters: SqlValue[]): Promise<T[]>;
}
export interface Draft { version: 1; revision: number; savedAt: number; run: RunRecord }
export interface DraftArchiveInfo { id: string; archivedAt: number; bytes: number }
export interface DraftArchive { id: string; archivedAt: number; payload: string }
function preserveSection(run: RunRecord, key: 'workout' | 'pacing', payload: unknown) {
  if (payload === undefined) return;
  const previous = run.unreadableSections?.[key];
  run.unreadableSections = { ...run.unreadableSections, [key]: previous === undefined ? payload : [previous, payload] };
}

export function parseRun(payload: string): RunRecord {
  const r: RunRecord = migrateActivity(JSON.parse(payload));
  if (r?.target && validateTarget(r.target)) {
    const basic = { fast: r.target.fast, slow: r.target.slow, distanceMeters: r.target.distanceMeters };
    if (!validateTarget(basic)) { r.target = basic; preserveSection(r, 'pacing', r.pacing); delete r.pacing; r.pacingError = 'L’objectif du coach était illisible. Les données de course ont été conservées.'; }
  }
  if (!r || typeof r.id !== 'string' || !r.id || !Number.isFinite(r.startedAt) ||
      !r.target || validateTarget(r.target) || !r.config ||
      ![r.activeSeconds, r.distanceMeters, r.reliableSeconds, r.inTargetSeconds].every(n => Number.isFinite(n) && n >= 0) ||
      r.inTargetSeconds > r.reliableSeconds + 0.001 || r.reliableSeconds > r.activeSeconds + 1 ||
      !Array.isArray(r.points) || !Array.isArray(r.splits) ||
      !r.points.every(p => p && Number.isFinite(p.activeSeconds) && Number.isFinite(p.meters) &&
        p.fix && Number.isFinite(p.fix.latitude) && Math.abs(p.fix.latitude) <= 90 &&
        Number.isFinite(p.fix.longitude) && Math.abs(p.fix.longitude) <= 180 && Number.isFinite(p.fix.timestamp))) {
    throw new Error('Une activité est illisible. Les données ont été conservées.');
  }
  if ((r.endedAt !== null && !Number.isFinite(r.endedAt)) ||
      (r.totalSeconds !== undefined && (!Number.isFinite(r.totalSeconds) || r.totalSeconds < r.activeSeconds - .001)) ||
      [r.ascentMeters, r.descentMeters, r.elevationReliableSeconds, r.autoPauseCount].some(n => n !== undefined && (!Number.isFinite(n) || n < 0)) ||
      (r.elevationReliableSeconds !== undefined && r.elevationReliableSeconds > r.activeSeconds + 1)) throw new Error('Les statistiques de cette activité sont incohérentes. Les données ont été conservées.');
  if (r.healthKit && (typeof r.healthKit.uuid !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(r.healthKit.uuid) ||
    typeof r.healthKit.sourceName !== 'string' || typeof r.healthKit.sourceBundle !== 'string' || !Number.isFinite(r.healthKit.importedAt) ||
    (r.healthKit.originalRunId !== null && typeof r.healthKit.originalRunId !== 'string') || !r.targetUnavailable || r.points.length > 0 ||
    r.endedAt === null || r.distanceMeters <= 0 || r.activeSeconds <= 0)) throw new Error('Provenance Santé incohérente. Les données ont été conservées.');
  // Invalid optional route labels cannot make recorded sports data disappear.
  if (r.healthExportRequestedAt !== undefined && (!Number.isFinite(r.healthExportRequestedAt) || r.healthExportRequestedAt <= 0)) delete r.healthExportRequestedAt;
  if (r.routeId !== undefined && (typeof r.routeId !== 'string' || !r.routeId || r.routeId.length > 200)) { delete r.routeId; delete r.routeName; }
  if (r.routeName !== undefined && (typeof r.routeName !== 'string' || r.routeName.length > 100)) delete r.routeName;
  if (r.clockPauses !== undefined) {
    let previousEnd = 0;
    const valid = Array.isArray(r.clockPauses) && r.clockPauses.every((p, i) => {
      if (!p || !Number.isFinite(p.from) || p.from < previousEnd || (p.to !== null && (!Number.isFinite(p.to) || p.to < p.from)) ||
        (p.to === null && i !== r.clockPauses!.length - 1) || (r.totalSeconds !== undefined && (p.to ?? p.from) > r.totalSeconds + .001)) return false;
      previousEnd = p.to ?? p.from; return true;
    });
    // An optional corrupt pause ledger must not hide the recorded GPS activity.
    if (!valid) delete r.clockPauses;
  }
  let previousTime = -1, previousMeters = -1, previousSegment = -1;
  for (const [index, point] of r.points.entries()) {
    if (point.id !== index || !Number.isInteger(point.segment) || point.segment < previousSegment || point.activeSeconds < previousTime ||
        point.activeSeconds > r.activeSeconds + 1 || point.meters < previousMeters || point.meters > r.distanceMeters + .001 ||
        (point.pace !== null && (!Number.isFinite(point.pace) || point.pace <= 0)) ||
        (point.altitude != null && !Number.isFinite(point.altitude)) ||
        (point.totalSeconds != null && (!Number.isFinite(point.totalSeconds) || point.totalSeconds < point.activeSeconds - .001 || (r.totalSeconds !== undefined && point.totalSeconds > r.totalSeconds + .001)))) throw new Error('Le parcours de cette activité est incohérent. Les données ont été conservées.');
    previousTime = point.activeSeconds; previousMeters = point.meters; previousSegment = point.segment;
  }
  if (r.workout && !validWorkoutSnapshot(r.workout)) {
    preserveSection(r, 'workout', r.workout);
    delete r.workout; r.workoutError = 'Les données de séance sont illisibles. Le parcours et les statistiques de course restent disponibles.';
  }
  if (r.pacing && (!validPacingSnapshot(r.pacing) || r.pacing.reliableSeconds > r.activeSeconds + 1 ||
      (r.pacing.lastPosition && (r.pacing.lastPosition.activeSeconds > r.activeSeconds + .001 || r.pacing.lastPosition.meters > r.distanceMeters + .001)))) {
    preserveSection(r, 'pacing', r.pacing);
    delete r.pacing; r.pacingError = 'Le journal du coach était illisible. Les statistiques de course ont été conservées.';
  }
  return { ...r, config: sanitizeConfig(r.config) };
}

/**
 * Entrée d'outbox écrite dans la MÊME transaction que l'écriture métier (§7.1), seulement
 * si l'appareil est lié à un compte. La dernière opération gagne et sa version augmente :
 * le moteur ne retire que la version qu'il a envoyée.
 */
export const ENQUEUE_SQL = `INSERT INTO sync_outbox (entity, entity_id, op, created_at, attempts, next_attempt_at, version)
  SELECT ?, ?, ?, ?, 0, 0, 1 WHERE EXISTS (SELECT 1 FROM sync_state WHERE key = 'bound_user_id')
  ON CONFLICT(entity, entity_id) DO UPDATE SET op = excluded.op, created_at = excluded.created_at, attempts = 0,
    next_attempt_at = 0, last_error = NULL, parked = 0, version = sync_outbox.version + 1`;

/** One serialized writer. Finishing commits history + removes the checkpoint atomically. */
export class RunRepository {
  private queue: Promise<unknown> = Promise.resolve();
  private closedSessions = new Set<string>();
  private committedPoints = new Map<string, number>();
  unreadableCount = 0;
  constructor(private db: SqlDatabase) {}
  private write<T>(operation: () => Promise<T>): Promise<T> {
    const task = this.queue.then(operation); this.queue = task.catch(() => undefined); return task;
  }
  async initialize() {
    const version = await this.db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
    if ((version?.user_version ?? 0) > 4) throw new Error('Cette base de courses provient d’une version plus récente. Aucune migration ni écriture n’a été effectuée.');
    await this.db.execAsync(`PRAGMA journal_mode = WAL;
      PRAGMA foreign_keys = ON;
      CREATE TABLE IF NOT EXISTS runs (id TEXT PRIMARY KEY, started_at REAL NOT NULL, payload TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS draft (slot INTEGER PRIMARY KEY CHECK(slot = 1), session_id TEXT NOT NULL,
        revision INTEGER NOT NULL, payload TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS settings (slot INTEGER PRIMARY KEY CHECK(slot = 1), payload TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS draft_points (session_id TEXT NOT NULL, point_id INTEGER NOT NULL, payload TEXT NOT NULL,
        PRIMARY KEY (session_id, point_id));
      CREATE TABLE IF NOT EXISTS draft_archives (id TEXT PRIMARY KEY, archived_at REAL NOT NULL, payload TEXT NOT NULL);`);
    // Version 4 (§7.2) : horodatage local de modification et tables de synchronisation, en une transaction.
    if ((version?.user_version ?? 0) < 4) {
      await this.db.execAsync('BEGIN IMMEDIATE');
      try {
        const columns = await this.db.getAllAsync<{ name: string }>('PRAGMA table_info(runs)');
        if (!columns.some(column => column.name === 'updated_at')) await this.db.execAsync('ALTER TABLE runs ADD COLUMN updated_at REAL');
        await this.db.execAsync(`UPDATE runs SET updated_at = started_at WHERE updated_at IS NULL;
          CREATE TABLE IF NOT EXISTS sync_outbox (seq INTEGER PRIMARY KEY AUTOINCREMENT,
            entity TEXT NOT NULL CHECK (entity IN ('run', 'settings', 'route')), entity_id TEXT NOT NULL,
            op TEXT NOT NULL CHECK (op IN ('upsert', 'delete')), created_at REAL NOT NULL,
            attempts INTEGER NOT NULL DEFAULT 0, next_attempt_at REAL NOT NULL DEFAULT 0, last_error TEXT,
            version INTEGER NOT NULL DEFAULT 1, parked INTEGER NOT NULL DEFAULT 0, UNIQUE (entity, entity_id));
          CREATE TABLE IF NOT EXISTS sync_state (key TEXT PRIMARY KEY, value TEXT NOT NULL);
          CREATE TABLE IF NOT EXISTS sync_meta (entity TEXT NOT NULL, entity_id TEXT NOT NULL, server_updated_at TEXT,
            synced_at REAL, validity TEXT, validity_reasons TEXT, PRIMARY KEY (entity, entity_id));
          PRAGMA user_version = 4;`);
        await this.db.execAsync('COMMIT');
      } catch (error) { await this.db.execAsync('ROLLBACK'); throw error; }
    }
  }
  /** Exécute une opération dans la file d'écriture unique (utilisée par le moteur de synchronisation). */
  serialized<T>(operation: (db: SqlDatabase) => Promise<T>): Promise<T> { return this.write(() => operation(this.db)); }
  async history(): Promise<RunRecord[]> {
    const rows = await this.db.getAllAsync<{ payload: string }>('SELECT payload FROM runs ORDER BY started_at DESC');
    this.unreadableCount = 0;
    return rows.flatMap(row => { try { return [parseRun(row.payload)]; } catch { this.unreadableCount++; return []; } });
  }
  async loadDraft(): Promise<Draft | null> {
    const row = await this.db.getFirstAsync<{ payload: string }>('SELECT payload FROM draft WHERE slot = 1');
    if (!row) return null;
    const value: Draft & { pointCount?: number } = JSON.parse(row.payload);
    if (value.version !== 1 || !Number.isInteger(value.revision) || value.revision < 0 || !Number.isFinite(value.savedAt)) throw new Error('Version de sauvegarde non prise en charge.');
    if (value.pointCount !== undefined) {
      if (!Number.isInteger(value.pointCount) || value.pointCount < 0 || value.pointCount > 1000000) throw new Error('Journal GPS illisible.');
      const rows = await this.db.getAllAsync<{ payload: string }>('SELECT payload FROM draft_points WHERE session_id = ? AND point_id < ? ORDER BY point_id', value.run.id, value.pointCount);
      if (rows.length !== value.pointCount) throw new Error('Journal GPS incomplet. Les données ont été conservées.');
      value.run.points = rows.map(point => JSON.parse(point.payload));
    }
    value.run = parseRun(JSON.stringify(value.run));
    if (value.pointCount !== undefined) this.committedPoints.set(value.run.id, value.pointCount);
    return value;
  }
  saveDraft(draft: Draft): Promise<void> {
    // Snapshot NOW, while persisting only the append-only suffix of the route.
    const id = draft.run.id, revision = draft.revision, pointCount = draft.run.points.length;
    const payload = JSON.stringify({ ...draft, pointCount, run: { ...draft.run, points: [] } });
    const from = Math.min(this.committedPoints.get(id) ?? 0, pointCount);
    const points = draft.run.points.slice(from).map(point => ({ id: point.id, payload: JSON.stringify(point) }));
    return this.write(async () => {
      if (this.closedSessions.has(id)) return;
      await this.db.execAsync('BEGIN IMMEDIATE');
      try {
        if (await this.db.getFirstAsync('SELECT id FROM runs WHERE id = ?', id)) { await this.db.execAsync('COMMIT'); return; }
        const current = await this.db.getFirstAsync<{ session_id: string; revision: number }>('SELECT session_id, revision FROM draft WHERE slot = 1');
        if (current?.session_id === id && current.revision > revision) { await this.db.execAsync('COMMIT'); return; }
        for (let offset = 0; offset < points.length; offset += 200) {
          const chunk = points.slice(offset, offset + 200);
          await this.db.runAsync(`INSERT INTO draft_points (session_id, point_id, payload) VALUES ${chunk.map(() => '(?, ?, ?)').join(', ')} ON CONFLICT(session_id, point_id) DO NOTHING`,
            ...chunk.flatMap(point => [id, point.id, point.payload]));
        }
        await this.db.runAsync('INSERT INTO draft (slot, session_id, revision, payload) VALUES (1, ?, ?, ?) ON CONFLICT(slot) DO UPDATE SET session_id = excluded.session_id, revision = excluded.revision, payload = excluded.payload', id, revision, payload);
        await this.db.runAsync('DELETE FROM draft_points WHERE session_id != ?', id);
        await this.db.execAsync('COMMIT'); this.committedPoints.set(id, pointCount);
      } catch (error) { await this.db.execAsync('ROLLBACK'); throw error; }
    });
  }
  archiveDraft(): Promise<string | null> {
    return this.write(async () => {
      await this.db.execAsync('BEGIN IMMEDIATE');
      try {
        const draft = await this.db.getFirstAsync<{ session_id: string; revision: number; payload: string }>('SELECT session_id, revision, payload FROM draft WHERE slot = 1');
        if (!draft) { await this.db.execAsync('COMMIT'); return null; }
        const points = await this.db.getAllAsync<{ point_id: number; payload: string }>('SELECT point_id, payload FROM draft_points WHERE session_id = ? ORDER BY point_id', draft.session_id);
        const archivedAt = Date.now(), id = archivedAt.toString(36) + '-' + Math.random().toString(36).slice(2, 10);
        // Preserve the original source, including invalid JSON and incomplete journals.
        const payload = JSON.stringify({ format: 'sprinter-recovery-v1', archivedAt, draft, points });
        await this.db.runAsync('INSERT INTO draft_archives (id, archived_at, payload) VALUES (?, ?, ?)', id, archivedAt, payload);
        await this.db.runAsync('DELETE FROM draft_points WHERE session_id = ?', draft.session_id);
        await this.db.runAsync('DELETE FROM draft WHERE slot = 1');
        await this.db.execAsync('COMMIT');
        this.closedSessions.add(draft.session_id); this.committedPoints.delete(draft.session_id);
        return id;
      } catch (error) { await this.db.execAsync('ROLLBACK'); throw error; }
    });
  }
  listDraftArchives(): Promise<DraftArchiveInfo[]> {
    return this.db.getAllAsync('SELECT id, archived_at AS archivedAt, length(CAST(payload AS BLOB)) AS bytes FROM draft_archives ORDER BY archived_at DESC');
  }
  loadDraftArchive(id: string): Promise<DraftArchive | null> {
    return this.db.getFirstAsync('SELECT id, archived_at AS archivedAt, payload FROM draft_archives WHERE id = ?', id);
  }
  finish(run: RunRecord): Promise<void> {
    const payload = JSON.stringify(run);
    return this.write(async () => {
      if (run.endedAt === null) throw new Error('La course doit être terminée avant son enregistrement.');
      await this.db.execAsync('BEGIN IMMEDIATE');
      try {
        const now = Date.now();
        await this.db.runAsync('INSERT INTO runs (id, started_at, payload, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at', run.id, run.startedAt, payload, now);
        await this.db.runAsync(ENQUEUE_SQL, 'run', run.id, 'upsert', now);
        await this.db.runAsync('DELETE FROM draft WHERE session_id = ?', run.id);
        await this.db.runAsync('DELETE FROM draft_points WHERE session_id = ?', run.id);
        await this.db.execAsync('COMMIT'); this.closedSessions.add(run.id); this.committedPoints.delete(run.id);
      } catch (error) { await this.db.execAsync('ROLLBACK'); throw error; }
    });
  }
  deleteRun(id: string) {
    return this.write(async () => {
      await this.db.execAsync('BEGIN IMMEDIATE');
      try {
        await this.db.runAsync('DELETE FROM runs WHERE id = ?', id);
        await this.db.runAsync(ENQUEUE_SQL, 'run', id, 'delete', Date.now());
        await this.db.execAsync('COMMIT');
      } catch (error) { await this.db.execAsync('ROLLBACK'); throw error; }
    });
  }
  /** Efface l'historique de CET appareil seulement (déconnexion ou suppression de compte, choix explicite) : rien n'est supprimé en ligne. */
  purgeLocalRuns() {
    return this.write(async () => {
      await this.db.execAsync('BEGIN IMMEDIATE');
      try {
        await this.db.execAsync("DELETE FROM runs; DELETE FROM sync_outbox WHERE entity IN ('run', 'route'); DELETE FROM sync_meta WHERE entity IN ('run', 'route');");
        await this.db.execAsync('COMMIT');
      } catch (error) { await this.db.execAsync('ROLLBACK'); throw error; }
    });
  }
  async loadSettings(): Promise<Settings> {
    const row = await this.db.getFirstAsync<{ payload: string }>('SELECT payload FROM settings WHERE slot = 1');
    if (!row) return { ...DEFAULT_SETTINGS, config: { ...DEFAULT_SETTINGS.config } };
    try {
      const s: Partial<Settings> = JSON.parse(row.payload);
      return { config: sanitizeConfig(s.config ?? DEFAULT_SETTINGS.config),
        audioEnabled: s.audioEnabled === true, hapticsEnabled: s.hapticsEnabled !== false,
        backgroundEnabled: typeof s.backgroundEnabled === 'boolean' ? s.backgroundEnabled : DEFAULT_SETTINGS.backgroundEnabled,
        autoPauseEnabled: s.autoPauseEnabled === true,
        coaching: sanitizeCoaching(s.coaching),
        appearance: s.appearance === 'light' || s.appearance === 'dark' || s.appearance === 'system'
          ? s.appearance : DEFAULT_SETTINGS.appearance };
    } catch { return { ...DEFAULT_SETTINGS, config: { ...DEFAULT_SETTINGS.config } }; }
  }
  saveSettings(settings: Settings) {
    const payload = JSON.stringify(settings);
    return this.write(async () => {
      await this.db.execAsync('BEGIN IMMEDIATE');
      try {
        await this.db.runAsync('INSERT INTO settings VALUES (1, ?) ON CONFLICT(slot) DO UPDATE SET payload = excluded.payload', payload);
        await this.db.runAsync(ENQUEUE_SQL, 'settings', 'portable', 'upsert', Date.now());
        await this.db.execAsync('COMMIT');
      } catch (error) { await this.db.execAsync('ROLLBACK'); throw error; }
    });
  }
}

export type StorageRepository = Pick<RunRepository, 'initialize' | 'history' | 'loadDraft' | 'archiveDraft' | 'listDraftArchives' | 'loadDraftArchive' | 'saveDraft' | 'finish' | 'deleteRun' | 'purgeLocalRuns' | 'loadSettings' | 'serialized' | 'saveSettings' | 'unreadableCount'>;
