import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it } from 'vitest';
import { RunRepository, type SqlDatabase, type SqlValue } from '../src/storage/repository';
import { SyncLocalStore } from '../src/sync/localStore';
import { DocumentSync, type DocumentAdapter, type DocumentRemote, type RemoteDocument } from '../src/sync/documents';

const handles: DatabaseSync[] = [];
afterEach(() => { handles.splice(0).forEach((db) => db.close()); });
async function localStore() {
  const db = new DatabaseSync(':memory:'); handles.push(db);
  const sql: SqlDatabase = {
    async execAsync(text) { db.exec(text); },
    async runAsync(text, ...params: SqlValue[]) { return db.prepare(text).run(...params); },
    async getFirstAsync<T>(text: string, ...params: SqlValue[]) { return (db.prepare(text).get(...params) ?? null) as T | null; },
    async getAllAsync<T>(text: string, ...params: SqlValue[]) { return db.prepare(text).all(...params) as T[]; },
  };
  const repo = new RunRepository(sql); await repo.initialize();
  return new SyncLocalStore((operation) => repo.serialized(operation));
}
class Server implements DocumentRemote {
  docs = new Map<string, RemoteDocument & { at: number }>();
  clock = 1_000;
  routesAllowed = true;
  async push(docs: Parameters<DocumentRemote['push']>[0]) {
    return docs.map((doc) => {
      const key = `${doc.kind}:${doc.id}`, existing = this.docs.get(key), at = Date.parse(doc.client_updated_at);
      if (doc.kind === 'route' && !this.routesAllowed) return { kind: doc.kind, id: doc.id, status: 'rejected' as const, reason: 'backup_disabled' };
      if (existing?.deleted) return { kind: doc.kind, id: doc.id, status: 'ignored_deleted' as const };
      if (existing && existing.at >= at) return { kind: doc.kind, id: doc.id, status: 'ignored_stale' as const };
      this.clock++;
      this.docs.set(key, { kind: doc.kind, id: doc.id, deleted: !!doc.deleted, at, client_updated_at: doc.client_updated_at,
        server_updated_at: new Date(this.clock).toISOString(), payload: doc.deleted ? null : doc.payload! });
      return { kind: doc.kind, id: doc.id, status: 'applied' as const };
    });
  }
  async pull(cursor: { ts: string | null; kind: string | null; id: string | null }) {
    const items = [...this.docs.values()].filter((doc) => (doc.kind !== 'route' || this.routesAllowed)
        && (!cursor.ts || `${doc.server_updated_at}|${doc.kind}|${doc.id}` > `${cursor.ts}|${cursor.kind}|${cursor.id}`))
      .sort((a, b) => (`${a.server_updated_at}|${a.kind}|${a.id}` < `${b.server_updated_at}|${b.kind}|${b.id}` ? -1 : 1));
    return { items, next_cursor: null };
  }
}
function memoryAdapter(kind: DocumentAdapter['kind'], extra: Partial<DocumentAdapter> = {}) {
  const docs = new Map<string, Record<string, unknown>>();
  const adapter: DocumentAdapter & { docs: typeof docs; applied: number } = {
    kind, docs, applied: 0,
    async list() { return [...docs.entries()].map(([id, payload]) => ({ id, payload, updatedAt: payload.updatedAt as number | undefined })); },
    async apply(id, payload) { adapter.applied++; if (payload) docs.set(id, { ...payload, updatedAt: (payload.updatedAt as number ?? 0) + 7 }); else docs.delete(id); },
    ...extra,
  };
  return adapter;
}

describe('entités secondaires (2b)', () => {
  it('propage création, modification et suppression entre deux appareils, sans aller-retour', async () => {
    const server = new Server();
    const oneWorkouts = memoryAdapter('workout', { fingerprint: (p) => ({ ...p, updatedAt: undefined }) });
    const twoWorkouts = memoryAdapter('workout', { fingerprint: (p) => ({ ...p, updatedAt: undefined }) });
    const one = new DocumentSync(await localStore(), server, [oneWorkouts], () => 5_000);
    const two = new DocumentSync(await localStore(), server, [twoWorkouts], () => 6_000);
    oneWorkouts.docs.set('w1', { name: 'Fractionné', updatedAt: 100 });
    await one.run(false);
    await two.run(false);
    expect(twoWorkouts.docs.get('w1')?.name).toBe('Fractionné');
    const pushed = server.clock;
    await two.run(false);
    await one.run(false);
    expect(server.clock).toBe(pushed); // updatedAt réécrit à l'application : aucune renvoi
    twoWorkouts.docs.set('w1', { name: 'Fractionné court', updatedAt: 200 });
    await two.run(false);
    await one.run(false);
    expect(oneWorkouts.docs.get('w1')?.name).toBe('Fractionné court');
    oneWorkouts.docs.delete('w1');
    await one.run(false);
    await two.run(false);
    expect(twoWorkouts.docs.has('w1')).toBe(false);
    twoWorkouts.docs.set('w1', { name: 'Résurrection', updatedAt: 999 });
    await two.run(false);
    expect(twoWorkouts.docs.has('w1')).toBe(false); // la suppression l'emporte
  });

  it('les itinéraires ne partent qu’avec la sauvegarde des parcours', async () => {
    const server = new Server();
    const routes = memoryAdapter('route', { requiresRoutes: true });
    routes.docs.set('r1', { name: 'Boucle du parc' });
    const sync = new DocumentSync(await localStore(), server, [routes], () => 1);
    await sync.run(false);
    expect(server.docs.size).toBe(0);
    await sync.run(true);
    expect(server.docs.has('route:r1')).toBe(true);
  });

  it('récupère un itinéraire antérieur au dernier document après activation des parcours', async () => {
    const server = new Server();
    await server.push([
      { kind: 'route', id: 'r1', client_updated_at: new Date(100).toISOString(), payload: { name: 'Ancien parcours' } },
      { kind: 'shoe', id: 's1', client_updated_at: new Date(200).toISOString(), payload: { name: 'Chaussures' } },
    ]);
    const routes = memoryAdapter('route', { requiresRoutes: true, fingerprint: ({ name }) => ({ name }) });
    const shoes = memoryAdapter('shoe', { fingerprint: ({ name }) => ({ name }) });
    const local = await localStore();
    const sync = new DocumentSync(local, server, [routes, shoes], () => 5_000);
    server.routesAllowed = false;
    await sync.run(false);
    expect(shoes.docs.get('s1')?.name).toBe('Chaussures');
    expect(routes.docs.size).toBe(0);
    const withoutRoutes = await local.getState('doc_cursor');
    server.routesAllowed = true;
    await sync.run(true);
    expect(routes.docs.get('r1')?.name).toBe('Ancien parcours');
    expect(await local.getState('doc_cursor')).toBe(withoutRoutes);
  });
});
