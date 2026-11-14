import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it } from 'vitest';
import { RunRepository, type SqlDatabase, type SqlValue } from '../src/storage/repository';
import { RunEngine } from '../src/core/engine';
import { DEFAULT_CONFIG, DEFAULT_TARGET, type RunRecord, type TrackPoint } from '../src/core/types';
import { SyncLocalStore } from '../src/sync/localStore';
import {
  base64Url, bestEfforts, compressPoints, decompressPoints, MAX_ROUTE_BYTES, previewPolyline, routeObjectName, RouteSync, type RouteTransport,
} from '../src/sync/routes';
import { distance } from '../src/core/geo';

const handles: DatabaseSync[] = [];
afterEach(() => { handles.splice(0).forEach((db) => db.close()); });
async function setup() {
  const db = new DatabaseSync(':memory:'); handles.push(db);
  const sql: SqlDatabase = {
    async execAsync(text) { db.exec(text); },
    async runAsync(text, ...params: SqlValue[]) { return db.prepare(text).run(...params); },
    async getFirstAsync<T>(text: string, ...params: SqlValue[]) { return (db.prepare(text).get(...params) ?? null) as T | null; },
    async getAllAsync<T>(text: string, ...params: SqlValue[]) { return db.prepare(text).all(...params) as T[]; },
  };
  const repo = new RunRepository(sql); await repo.initialize();
  return { repo, local: new SyncLocalStore((operation) => repo.serialized(operation)), sql };
}

/** Course synthétique à 1 Hz, 5:00/km, en ligne droite vers le nord. */
function syntheticRun(id: string, meters: number): RunRecord {
  const startedAt = Date.UTC(2026, 10, 10, 7), speed = 1000 / 300, seconds = Math.round(meters / speed);
  const points: TrackPoint[] = Array.from({ length: seconds + 1 }, (_, t) => ({
    id: t, segment: 0, activeSeconds: t, totalSeconds: t, meters: t * speed, pace: 300,
    fix: { latitude: 48.85 + (t * speed) / 111_195, longitude: 2.35, timestamp: startedAt + t * 1000, accuracy: 4, speed },
  }));
  return { ...new RunEngine(DEFAULT_TARGET, DEFAULT_CONFIG, 0, startedAt, id).record, endedAt: startedAt + seconds * 1000,
    activeSeconds: seconds, totalSeconds: seconds, distanceMeters: meters, reliableSeconds: seconds, points };
}

function decode(polyline: string) {
  const out: { latitude: number; longitude: number }[] = [];
  let index = 0, lat = 0, lng = 0;
  const next = () => { let shift = 0, result = 0, byte; do { byte = polyline.charCodeAt(index++) - 63; result |= (byte & 0x1f) << shift; shift += 5; } while (byte >= 0x20); return result & 1 ? ~(result >> 1) : result >> 1; };
  while (index < polyline.length) { lat += next(); lng += next(); out.push({ latitude: lat / 1e5, longitude: lng / 1e5 }); }
  return out;
}

describe('tracés GPS (§8)', () => {
  it('nomme le fichier <uid>/<base64url(run_id)>.json.gz, conforme à la policy Storage', () => {
    for (const id of ['1800000000000-abc', 'healthkit:0f1e2d3c-4b5a-4968-8776-655443322110', 'é/ü?']) {
      expect(base64Url(id)).toBe(Buffer.from(id, 'utf8').toString('base64url'));
      expect(routeObjectName('0f1e2d3c-4b5a-4968-8776-655443322110', id)).toMatch(/^[0-9a-f-]{36}\/[A-Za-z0-9_-]{1,140}\.json\.gz$/);
    }
  });

  it('compresse une course de 10 km bien sous 8 Mo, sans perte', () => {
    const run = syntheticRun('ten', 10_000);
    const bytes = compressPoints(run.points);
    expect(bytes.length).toBeLessThan(MAX_ROUTE_BYTES);
    expect(bytes.length).toBeLessThan(400_000);
    expect(decompressPoints(bytes)).toEqual(run.points);
  });

  it('l’aperçu exclut les 300 premiers et derniers mètres et reste borné', () => {
    const run = syntheticRun('preview', 5000);
    const decoded = decode(previewPolyline(run.points)!);
    expect(decoded.length).toBeLessThanOrEqual(301);
    const start = run.points[0]!.fix, end = run.points.at(-1)!.fix;
    expect(Math.min(...decoded.map((p) => distance(start, p)))).toBeGreaterThan(295);
    expect(Math.min(...decoded.map((p) => distance(end, p)))).toBeGreaterThan(295);
    expect(previewPolyline(syntheticRun('short', 400).points)).toBeNull();
  });

  it('calcule les meilleurs efforts sur l’appareil', () => {
    const efforts = bestEfforts(syntheticRun('efforts', 10_500))!;
    expect(Object.keys(efforts)).toEqual(['1000', '5000', '10000']);
    expect(efforts['1000']).toBeCloseTo(300, 0);
    expect(efforts['5000']).toBeCloseTo(1500, 0);
  });

  it('envoie les tracés des seules courses synchronisées, jamais pendant une course', async () => {
    const { repo, local } = await setup();
    const synced = syntheticRun('synced', 3000), pending = syntheticRun('pending', 3000);
    await repo.finish(synced); await repo.finish(pending);
    await local.bind('11111111-1111-4111-8111-111111111111');
    await local.complete({ seq: 0, entity: 'run', entityId: 'synced', op: 'upsert', createdAt: 0, attempts: 0, nextAttemptAt: 0, lastError: null, version: 1 }, { serverUpdatedAt: 'x' });
    const uploads: string[] = [], registered: string[] = [];
    let running = true;
    const transport: RouteTransport = {
      async upload(path) { uploads.push(path); }, async download() { return compressPoints(synced.points); }, async remove() {},
      async register(runId) { registered.push(runId); }, async deleteRoutes() { return uploads; },
    };
    const sync = new RouteSync(local, transport, { userId: () => '11111111-1111-4111-8111-111111111111', enabled: () => true, runActive: () => running, wifi: () => false, historyChanged: async () => undefined });
    await sync.run({ routesOn: true });
    expect(uploads).toEqual([]);
    running = false;
    await sync.run({ routesOn: false });
    expect(uploads).toEqual([]);
    await sync.run({ routesOn: true });
    expect(registered).toEqual(['synced']);
    await sync.run({ routesOn: true });
    expect(registered).toEqual(['synced']); // pas de renvoi
    expect(await sync.deleteOnline()).toBe(1);
    expect(await local.routeCandidates(5)).toEqual(['synced']);
  });

  it('réintègre un tracé téléchargé sans rien renvoyer au serveur', async () => {
    const { repo, local, sql } = await setup();
    const run = syntheticRun('remote', 2000);
    await local.applyPage([{ id: 'remote', deleted: false, server_updated_at: '2026-11-14T00:00:00Z', client_updated_at: '2026-11-13T00:00:00Z',
      source: 'sprinter', has_route: true, validity: 'valid', validity_reasons: [], tz: null, best_efforts: null, payload: { ...run, points: undefined } }], null);
    expect(await local.cloudRouteRuns(5)).toEqual(['remote']);
    const transport = { async download() { return compressPoints(run.points); } } as unknown as RouteTransport;
    const sync = new RouteSync(local, transport, { userId: () => 'u', enabled: () => true, runActive: () => false, wifi: () => true, historyChanged: async () => undefined });
    expect(await sync.download('remote')).toBe(run.points.length);
    const [restored] = await repo.history();
    expect(restored!.points).toHaveLength(run.points.length);
    expect((restored as RunRecord & { cloudRoute?: boolean }).cloudRoute).toBeUndefined();
    expect(await sql.getAllAsync('SELECT * FROM sync_outbox')).toEqual([]);
  });
});
