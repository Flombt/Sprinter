import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it } from 'vitest';
import { RunRepository, type SqlDatabase, type SqlValue } from '../src/storage/repository';
import { RunEngine } from '../src/core/engine';
import { DEFAULT_CONFIG, DEFAULT_SETTINGS, DEFAULT_TARGET, type RunRecord, type Settings } from '../src/core/types';
import { SyncLocalStore } from '../src/sync/localStore';
import { RECONCILE_AFTER_MS, SyncEngine, type SyncHost } from '../src/sync/engine';
import { SyncError, type Cursor, type PulledRun, type PushItem, type SyncRemote } from '../src/sync/types';
import { probableDuplicates } from '../src/sync/duplicates';

// ---------------------------------------------------------------------------- Base locale réelle
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
let sequence = 0;
function finishedRun(minutesAgo: number, meters = 5000, id?: string): RunRecord {
  const startedAt = Date.UTC(2026, 10, 10, 7) - minutesAgo * 60_000;
  const engine = new RunEngine(DEFAULT_TARGET, DEFAULT_CONFIG, 0, startedAt, id ?? `${startedAt}-${(++sequence).toString(36).padStart(10, '0')}`);
  return { ...engine.record, endedAt: startedAt + 1_800_000, activeSeconds: 1500, totalSeconds: 1600, distanceMeters: meters, reliableSeconds: 1400 };
}
function healthRun(uuid: string): RunRecord {
  return { ...finishedRun(4000, 3000, `healthkit:${uuid}`), targetUnavailable: true, points: [],
    healthKit: { uuid, sourceName: 'Montre', sourceBundle: 'com.apple.health', importedAt: 1, originalRunId: null } };
}

// ---------------------------------------------------------------------------- Faux serveur (sémantique des RPC §5.4)
interface ServerRun { item: PushItem | null; clientAt: number; serverAt: string; deleted: boolean }
class FakeServer {
  users = new Map<string, { runs: Map<string, ServerRun>; prefs: { data: Record<string, unknown>; at: number } | null; backup: boolean | null; backupAt: number }>();
  calls: string[] = [];
  private clock = Date.UTC(2026, 10, 14);
  failNext: SyncError | null = null;
  failOn: string | null = null;
  loseNextResponse = false;
  expireToken = false;
  user(id: string) {
    if (!this.users.has(id)) this.users.set(id, { runs: new Map(), prefs: null, backup: null, backupAt: 0 });
    return this.users.get(id)!;
  }
  tick() { this.clock += 1000; return new Date(this.clock).toISOString(); }
  remote(userId: () => string): SyncRemote {
    const guard = (name: string) => {
      this.calls.push(name);
      if (this.expireToken) throw new SyncError('auth', 'jwt expired', undefined, 'auth');
      if (this.failNext && (!this.failOn || this.failOn === name)) { const error = this.failNext; this.failNext = null; throw error; }
    };
    const lose = () => { if (this.loseNextResponse) { this.loseNextResponse = false; throw new SyncError('network', 'response lost', undefined, 'network'); } };
    return {
      pushRuns: async (items) => {
        guard('push');
        const user = this.user(userId());
        const results = items.map((item) => {
          if (!user.backup) return { id: item.id, status: 'rejected' as const, reason: 'backup_disabled' };
          const existing = user.runs.get(item.id), clientAt = Math.min(Date.parse(item.client_updated_at), this.clock);
          if (existing?.deleted) return { id: item.id, status: 'ignored_deleted' as const, server_updated_at: existing.serverAt };
          if (existing && existing.clientAt >= clientAt) return { id: item.id, status: 'ignored_stale' as const, server_updated_at: existing.serverAt };
          const serverAt = this.tick();
          user.runs.set(item.id, { item, clientAt, serverAt, deleted: false });
          return { id: item.id, status: 'applied' as const, server_updated_at: serverAt, validity: 'valid', validity_reasons: [] };
        });
        lose();
        return results;
      },
      deleteRuns: async (ids) => {
        guard('delete');
        const user = this.user(userId());
        return ids.map((id) => {
          const existing = user.runs.get(id);
          const serverAt = this.tick();
          user.runs.set(id, { item: null, clientAt: this.clock, serverAt, deleted: true });
          return { id, status: existing && !existing.deleted ? 'deleted' as const : 'already_deleted' as const, server_updated_at: serverAt };
        });
      },
      pull: async (cursor: Cursor, limit) => {
        guard('pull');
        const rows = [...this.user(userId()).runs.entries()]
          .map(([id, run]) => ({ id, run }))
          .filter(({ id, run }) => !cursor.ts || run.serverAt > cursor.ts || (run.serverAt === cursor.ts && id > (cursor.id ?? '')))
          .sort((a, b) => (a.run.serverAt === b.run.serverAt ? (a.id < b.id ? -1 : 1) : a.run.serverAt < b.run.serverAt ? -1 : 1));
        const page = rows.slice(0, limit);
        const items: PulledRun[] = page.map(({ id, run }) => ({
          id, deleted: run.deleted, server_updated_at: run.serverAt, client_updated_at: new Date(run.clientAt).toISOString(),
          source: run.item?.source ?? 'sprinter', has_route: false, validity: 'valid', validity_reasons: [], tz: null, best_efforts: null,
          payload: run.deleted ? null : run.item!.payload,
        }));
        const last = page.at(-1);
        return { items, next_cursor: page.length === limit && last ? { ts: last.run.serverAt, id: last.id } : null };
      },
      listIds: async (after, limit) => {
        guard('listIds');
        const ids = [...this.user(userId()).runs.entries()].filter(([, run]) => !run.deleted).map(([id]) => id).sort().filter((id) => !after || id > after);
        const page = ids.slice(0, limit);
        return { ids: page, next: page.length === limit ? page.at(-1)! : null };
      },
      pushPreferences: async (data, at) => {
        guard('pushPrefs');
        const user = this.user(userId()), clientAt = Math.min(Date.parse(at), this.clock);
        const clean = Object.fromEntries(Object.entries(data).filter(([key]) => ['config', 'audioEnabled', 'hapticsEnabled', 'appearance', 'autoPauseEnabled', 'coaching'].includes(key)));
        if (user.prefs && user.prefs.at >= clientAt) return { status: 'ignored_stale' as const, data: user.prefs.data, client_updated_at: new Date(user.prefs.at).toISOString() };
        user.prefs = { data: clean, at: clientAt };
        return { status: 'applied' as const, data: clean, client_updated_at: new Date(clientAt).toISOString() };
      },
      getPreferences: async () => {
        guard('getPrefs');
        const prefs = this.user(userId()).prefs;
        return prefs ? { data: prefs.data, client_updated_at: new Date(prefs.at).toISOString() } : null;
      },
      reportSync: async () => { this.calls.push('report'); },
      backupChoices: async () => { guard('consents'); return { runs: this.user(userId()).backup, routes: null }; },
    };
  }
  recordBackup(userId: string, on: boolean, at: string) {
    const user = this.user(userId), clientAt = Date.parse(at);
    if (user.backupAt > clientAt) return { status: 'stale' as const, granted: user.backup };
    user.backup = on; user.backupAt = clientAt;
    return { status: 'applied' as const, granted: on };
  }
}

// ---------------------------------------------------------------------------- Appareil simulé
interface Device { repo: RunRepository; local: SyncLocalStore; engine: SyncEngine; settings: Settings; history: () => Promise<RunRecord[]>; state: { userId: string | null; running: boolean; now: number; refreshOk: boolean; historyEvents: number } }
async function device(server: FakeServer, userId: string | null, options: { db?: SqlDatabase } = {}): Promise<Device> {
  const repo = new RunRepository(options.db ?? database());
  await repo.initialize();
  const local = new SyncLocalStore((operation) => repo.serialized(operation));
  const state = { userId, running: false, now: Date.UTC(2026, 10, 14), refreshOk: false, historyEvents: 0 };
  const dev = { repo, local, settings: { ...DEFAULT_SETTINGS }, state, history: () => repo.history() } as Device;
  const host: SyncHost = {
    enabled: () => true,
    userId: () => state.userId,
    runActive: () => state.running,
    refreshAuth: async () => { if (state.refreshOk) server.expireToken = false; return state.refreshOk; },
    localSettings: () => dev.settings,
    applyRemoteSettings: async (patch) => { dev.settings = { ...dev.settings, ...patch }; await repo.saveSettings(dev.settings); },
    historyChanged: async () => { state.historyEvents++; },
    recordBackupChoice: async (on, _id, at) => server.recordBackup(state.userId!, on, at),
    platform: () => 'ios', appVersion: () => '1.0.0', timeZone: () => 'Europe/Paris', uuid: randomUUID,
    now: () => state.now, yieldToUi: async () => undefined,
  };
  dev.engine = new SyncEngine(local, server.remote(() => state.userId!), host);
  return dev;
}
const serverRuns = (server: FakeServer, user: string) => [...server.user(user).runs.values()].filter((run) => !run.deleted);

describe('synchronisation · scénarios §7.6', () => {
  it('A : sans sauvegarde rien ne part ; après activation, exactement trois lignes, même après rejeu ×3', async () => {
    const server = new FakeServer();
    const phone = await device(server, null);
    for (const minutes of [300, 200, 100]) await phone.repo.finish(finishedRun(minutes));
    expect(await phone.local.counts()).toEqual({ pending: 0, blocked: 0 });
    phone.state.userId = 'A';
    await phone.engine.sync('signin');
    expect(phone.engine.getSnapshot().backup).toBe('unset');
    expect(serverRuns(server, 'A')).toHaveLength(0);
    expect(await phone.history()).toHaveLength(3);

    server.loseNextResponse = true; // le serveur applique mais la réponse se perd (mode avion)
    await phone.engine.chooseBackup(true);
    expect(phone.engine.getSnapshot().phase).toBe('offline');
    for (let replay = 0; replay < 3; replay++) await phone.engine.sync('manual');
    expect(serverRuns(server, 'A')).toHaveLength(3);
    expect(await phone.local.counts()).toEqual({ pending: 0, blocked: 0 });
    expect(await phone.local.getState('local_backup_at')).not.toBeNull();
  });

  it('B : un nouvel appareil récupère les courses par pages, sans points GPS', async () => {
    const server = new FakeServer();
    const first = await device(server, 'A');
    server.recordBackup('A', true, new Date(first.state.now).toISOString());
    for (let i = 0; i < 450; i++) await first.repo.finish(finishedRun(10_000 + i * 60));
    let pass = 0;
    do { await first.engine.sync('manual'); } while ((await first.local.counts()).pending && ++pass < 3);
    expect(serverRuns(server, 'A')).toHaveLength(450);
    const second = await device(server, 'A');
    await second.engine.sync('signin');
    const history = await second.history();
    expect(history).toHaveLength(450);
    expect(history.every((run) => run.points.length === 0)).toBe(true);
    expect(second.state.historyEvents).toBeGreaterThan(0);
  });

  it('C : union par identifiant avec un compte existant et doublons probables signalés', async () => {
    const server = new FakeServer();
    const existing = await device(server, 'A');
    server.recordBackup('A', true, new Date(existing.state.now).toISOString());
    const remote = finishedRun(500, 10_000);
    await existing.repo.finish(remote);
    await existing.engine.sync('manual');
    const phone = await device(server, null);
    const local = finishedRun(499, 10_100); // même sortie enregistrée deux fois, une minute d'écart
    await phone.repo.finish(local);
    await phone.repo.finish(finishedRun(50));
    phone.state.userId = 'A';
    await phone.engine.sync('signin');
    await phone.engine.sync('manual');
    expect(await phone.history()).toHaveLength(3);
    expect(serverRuns(server, 'A')).toHaveLength(3);
    const pairs = probableDuplicates(await phone.history());
    expect(pairs).toHaveLength(1);
    expect(new Set([pairs[0]!.a.id, pairs[0]!.b.id])).toEqual(new Set([remote.id, local.id]));
    expect(probableDuplicates(await phone.history(), new Set([pairs[0]!.key]))).toHaveLength(0);
  });

  it('D : les données du compte A ne partent jamais dans le compte B', async () => {
    const server = new FakeServer();
    server.recordBackup('A', true, '2026-11-01T00:00:00Z');
    server.recordBackup('B', true, '2026-11-01T00:00:00Z');
    const phone = await device(server, 'A');
    await phone.repo.finish(finishedRun(300));
    await phone.engine.sync('manual');
    phone.state.userId = 'B';
    await phone.repo.finish(finishedRun(100));
    await phone.engine.sync('signin');
    expect(phone.engine.getSnapshot().phase).toBe('bound_other');
    expect(serverRuns(server, 'B')).toHaveLength(0);
    await phone.engine.resetForAccount('B', async () => {
      expect(await phone.local.beginAccountReset('B')).toBe(true);
      return false; // Un autre stockage local a échoué avant le rattachement.
    });
    expect(await phone.local.getState('bound_user_id')).toBe('A');
    expect(await phone.local.bind('A')).toBe('other');
    await phone.engine.sync('manual');
    expect(phone.engine.getSnapshot().phase).toBe('bound_other');
    expect(serverRuns(server, 'B')).toHaveLength(0);
    expect(await phone.engine.resetForAccount('B', async () => {
      expect(await phone.local.beginAccountReset('B')).toBe(true);
      await phone.local.resetForAccount('B', DEFAULT_SETTINGS);
      return true;
    })).toBe(true);
    expect(await phone.history()).toHaveLength(0);
    await phone.engine.sync('manual');
    expect(phone.engine.getSnapshot().phase).toBe('idle');
    expect(serverRuns(server, 'B')).toHaveLength(0);
  });

  it('E : après déconnexion les données restent liées à l’ancien compte, sans synchronisation', async () => {
    const server = new FakeServer();
    server.recordBackup('A', true, '2026-11-01T00:00:00Z');
    const phone = await device(server, 'A');
    await phone.repo.finish(finishedRun(100));
    await phone.engine.sync('manual');
    phone.state.userId = null;
    server.calls = [];
    await phone.repo.finish(finishedRun(50));
    expect((await phone.engine.sync('foreground')).phase).toBe('disabled');
    expect(server.calls).toEqual([]);
    expect(await phone.local.getState('bound_user_id')).toBe('A');
    expect(await phone.history()).toHaveLength(2);
  });

  it('G et H : suppression propagée ; après 60 jours hors ligne, réconciliation avant tout envoi', async () => {
    const server = new FakeServer();
    server.recordBackup('A', true, '2026-11-01T00:00:00Z');
    const one = await device(server, 'A'), two = await device(server, 'A');
    const runs = [finishedRun(900), finishedRun(800), finishedRun(700)];
    for (const run of runs) await one.repo.finish(run);
    await one.engine.sync('manual');
    await two.engine.sync('manual');
    expect(await two.history()).toHaveLength(3);

    await one.repo.deleteRun(runs[0]!.id);
    await one.engine.sync('manual');
    await two.engine.sync('manual');
    expect((await two.history()).map((run) => run.id)).not.toContain(runs[0]!.id); // H

    // L'appareil 2 modifie une course hors ligne pendant que l'appareil 1 la supprime ; le tombstone est ensuite purgé.
    await two.repo.finish({ ...runs[1]!, distanceMeters: 4200 });
    await one.repo.deleteRun(runs[1]!.id);
    await one.engine.sync('manual');
    server.user('A').runs.delete(runs[1]!.id);
    two.state.now += RECONCILE_AFTER_MS + 1;
    await two.engine.sync('foreground');
    // 1 course sur 2 (50 %) dépasse le seuil de 20 % : choix explicite, et la modification en attente reste suspendue.
    expect(two.engine.getSnapshot().deletedElsewhere).toEqual([runs[1]!.id]);
    expect(serverRuns(server, 'A').map((run) => run.item?.id)).not.toContain(runs[1]!.id);
    await two.engine.sync('manual');
    expect(serverRuns(server, 'A').map((run) => run.item?.id)).not.toContain(runs[1]!.id);
    await two.engine.resolveDeletedElsewhere('delete');
    expect((await two.history()).map((run) => run.id)).toEqual([runs[2]!.id]);
  });

  it('G : au-delà de 10 courses supprimées ailleurs, la suppression locale attend un choix explicite', async () => {
    const server = new FakeServer();
    server.recordBackup('A', true, '2026-11-01T00:00:00Z');
    const phone = await device(server, 'A');
    for (let i = 0; i < 15; i++) await phone.repo.finish(finishedRun(2000 + i * 100));
    await phone.engine.sync('manual');
    for (const id of [...server.user('A').runs.keys()].slice(0, 12)) server.user('A').runs.delete(id);
    phone.state.now += RECONCILE_AFTER_MS + 1;
    await phone.engine.sync('foreground');
    expect(phone.engine.getSnapshot().deletedElsewhere).toHaveLength(12);
    expect(await phone.history()).toHaveLength(15);
    await phone.engine.resolveDeletedElsewhere('delete');
    expect(await phone.history()).toHaveLength(3);
  });

  it('I : aucune requête de synchronisation pendant une course', async () => {
    const server = new FakeServer();
    server.recordBackup('A', true, '2026-11-01T00:00:00Z');
    const phone = await device(server, 'A');
    await phone.repo.finish(finishedRun(100));
    phone.state.running = true;
    server.calls = [];
    for (const trigger of ['foreground', 'network', 'run_finished', 'manual']) await phone.engine.sync(trigger);
    expect(server.calls).toEqual([]);
    phone.state.running = false;
    await phone.engine.sync('run_finished');
    expect(serverRuns(server, 'A')).toHaveLength(1);
  });

  it('J : un même import Santé sur deux iPhone donne une seule course', async () => {
    const server = new FakeServer();
    server.recordBackup('A', true, '2026-11-01T00:00:00Z');
    const one = await device(server, 'A'), two = await device(server, 'A');
    const uuid = '0f1e2d3c-4b5a-4968-8776-655443322110';
    await one.repo.finish(healthRun(uuid));
    await two.repo.finish(healthRun(uuid));
    await one.engine.sync('manual');
    await two.engine.sync('manual');
    expect(serverRuns(server, 'A')).toHaveLength(1);
    expect(await two.history()).toHaveLength(1);
  });
});

describe('synchronisation · robustesse', () => {
  it('jeton expiré : un seul rafraîchissement puis invitation à se reconnecter, sans perte', async () => {
    const server = new FakeServer();
    server.recordBackup('A', true, '2026-11-01T00:00:00Z');
    const phone = await device(server, 'A');
    await phone.engine.sync('signin');
    await phone.repo.finish(finishedRun(100));
    server.expireToken = true;
    const status = await phone.engine.sync('manual');
    expect(status.phase).toBe('reauth');
    expect(status.pending).toBe(1);
    phone.state.refreshOk = true;
    expect((await phone.engine.sync('manual')).phase).toBe('idle');
    expect(serverRuns(server, 'A')).toHaveLength(1);
  });

  it('une modification locale pendant l’envoi reste à envoyer', async () => {
    const server = new FakeServer();
    server.recordBackup('A', true, '2026-11-01T00:00:00Z');
    const phone = await device(server, 'A');
    const run = finishedRun(100);
    await phone.repo.finish(run);
    const original = server.remote(() => 'A').pushRuns;
    const remote = (phone.engine as unknown as { remote: { pushRuns: typeof original } }).remote;
    remote.pushRuns = async (items) => {
      const result = await original(items);
      await phone.repo.finish({ ...run, distanceMeters: 5100 }); // nouvelle version pendant le vol
      return result;
    };
    await phone.engine.sync('manual');
    expect((await phone.local.counts()).pending).toBe(1);
    remote.pushRuns = original;
    phone.state.now += 10_000;
    await phone.engine.sync('manual');
    expect(serverRuns(server, 'A')[0]!.item!.payload.distanceMeters).toBe(5100);
  });

  it('import de 500 courses reprenable après arrêt de l’app, sans doublon', async () => {
    const server = new FakeServer();
    server.recordBackup('A', true, '2026-11-01T00:00:00Z');
    const db = database();
    const phone = await device(server, null, { db });
    for (let i = 0; i < 500; i++) await phone.repo.finish(finishedRun(20_000 + i * 50));
    phone.state.userId = 'A';
    let pushes = 0;
    const remote = (phone.engine as unknown as { remote: SyncRemote }).remote;
    const original = remote.pushRuns;
    remote.pushRuns = async (items) => {
      expect(items.length).toBeLessThanOrEqual(20);
      if (++pushes === 6) phone.state.running = true; // l'utilisateur démarre une course : arrêt net
      return original(items);
    };
    await phone.engine.sync('signin');
    expect(serverRuns(server, 'A').length).toBe(120);
    // « Redémarrage » : nouveau dépôt et nouveau moteur sur la même base.
    const restarted = await device(server, 'A', { db });
    for (let pass = 0; pass < 3; pass++) await restarted.engine.sync('foreground');
    expect(serverRuns(server, 'A')).toHaveLength(500);
    expect(new Set(serverRuns(server, 'A').map((run) => run.item!.id)).size).toBe(500);
    expect(await restarted.local.counts()).toEqual({ pending: 0, blocked: 0 });
  });

  it('seuls les réglages portables sont synchronisés', async () => {
    const server = new FakeServer();
    const one = await device(server, 'A'), two = await device(server, 'A');
    one.settings = { ...DEFAULT_SETTINGS, audioEnabled: true, backgroundEnabled: false, appearance: 'light' };
    await one.repo.saveSettings(one.settings);
    await one.engine.sync('manual');
    expect(Object.keys(server.user('A').prefs!.data)).not.toContain('backgroundEnabled');
    two.settings = { ...DEFAULT_SETTINGS, backgroundEnabled: true };
    await two.engine.sync('manual');
    expect(two.settings).toMatchObject({ audioEnabled: true, appearance: 'light', backgroundEnabled: true });
    server.calls = [];
    await two.engine.sync('manual');
    expect(server.calls).not.toContain('pushPrefs'); // pas d'aller-retour après application
  });

  it('une erreur serveur répétée bloque l’élément après 5 essais, visible et relançable', async () => {
    const server = new FakeServer();
    server.recordBackup('A', true, '2026-11-01T00:00:00Z');
    const phone = await device(server, 'A');
    await phone.engine.sync('signin');
    await phone.repo.finish(finishedRun(100));
    server.failOn = 'push';
    for (let attempt = 0; attempt < 5; attempt++) {
      server.failNext = new SyncError('server', 'boom', undefined, 'server_500');
      phone.state.now += 60 * 60_000;
      await phone.engine.sync('manual');
    }
    expect(await phone.local.counts()).toEqual({ pending: 0, blocked: 1 });
    await phone.engine.retryBlocked();
    expect(serverRuns(server, 'A')).toHaveLength(1);
  });
});
