import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SqlDatabase, SqlValue } from '../src/storage/repository';
import { ProfileLocalStore, type LocalMedia, type OutboxItem, type RemoteElement, type SaveResult } from '../src/profile/localStore';
import { ProfileSync, type ProfileRemote, type RemoteMedia } from '../src/profile/sync';
import { activeStatus, computeStats, moveInOrder, orderedWidgets, statusExpiry, validatePayload, widgetKey, type Payload } from '../src/profile/model';
import { ACCENTS, THEMES, SPRINTER_LIGHT, contrastRatio, resolveTheme } from '../src/profile/catalog';
import { SyncError } from '../src/sync/types';
import type { RunRecord } from '../src/core/types';

const handles: DatabaseSync[] = [];
const dirs: string[] = [];
afterEach(() => { handles.splice(0).forEach((db) => db.close()); dirs.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true })); });
function sql(db: DatabaseSync): SqlDatabase {
  return {
    async execAsync(text) { db.exec(text); },
    async runAsync(text, ...params: SqlValue[]) { return db.prepare(text).run(...params); },
    async getFirstAsync<T>(text: string, ...params: SqlValue[]) { return (db.prepare(text).get(...params) ?? null) as T | null; },
    async getAllAsync<T>(text: string, ...params: SqlValue[]) { return db.prepare(text).all(...params) as T[]; },
  };
}
function device(path = ':memory:') { const db = new DatabaseSync(path); handles.push(db); return new ProfileLocalStore(sql(db)); }

let counter = 0;
const uuid = () => `00000000-0000-4000-8000-${String(++counter).padStart(12, '0')}`;
const A = 'aaaaaaaa-0000-4000-8000-000000000001', B = 'bbbbbbbb-0000-4000-8000-000000000002';

/** Faux serveur fidèle à profile_save / profile_pull / médias (0015_profiles.sql). */
class Server {
  elements = new Map<string, { payload: Payload; deleted: boolean; revision: number; lastOp: string }>();
  media = new Map<string, { owner: string; status: 'pending' | 'ready' | 'deleted'; path: string; mime: string }>();
  objects = new Map<string, number>();
  calls: string[] = [];
  loseNextResponse = false;
  failUploadsOnce = false;
  rejectMedia: string | null = null;
  disabled = false;
  private check() { if (this.disabled) throw new SyncError('rate', 'feature_disabled', 30 * 60_000, 'feature_disabled'); }
  remote(owner: string): ProfileRemote {
    return {
      save: async (items: OutboxItem[]) => {
        this.check(); this.calls.push('save');
        const results = items.map((item): SaveResult => {
          const id = `${owner}/${item.key}`, row = this.elements.get(id);
          if (row && row.lastOp === item.opId) return { key: item.key, status: 'applied', revision: row.revision };
          if (row && row.revision !== item.baseRevision && !(item.prevOpId && row.lastOp === item.prevOpId && row.revision === item.baseRevision + 1)) {
            return { key: item.key, status: 'conflict', revision: row.revision, payload: row.payload, deleted: row.deleted };
          }
          const mediaIds = item.deleted ? [] : typeof item.payload?.mediaId === 'string' ? [item.payload.mediaId] : [];
          if (mediaIds.some((mediaId) => this.media.get(mediaId)?.status !== 'ready')) return { key: item.key, status: 'deferred', reason: 'media_not_ready' };
          const revision = (row?.revision ?? 0) + 1;
          this.elements.set(id, { payload: item.deleted ? {} : item.payload!, deleted: item.deleted, revision, lastOp: item.opId });
          return { key: item.key, status: 'applied', revision };
        });
        if (this.loseNextResponse) { this.loseNextResponse = false; throw new SyncError('network', 'Network request failed', undefined, 'network'); }
        return results;
      },
      pull: async () => {
        this.check(); this.calls.push('pull');
        const elements: RemoteElement[] = [...this.elements].filter(([id]) => id.startsWith(`${owner}/`))
          .map(([id, row]) => ({ key: id.slice(owner.length + 1), payload: row.payload, deleted: row.deleted, revision: row.revision }));
        const media: RemoteMedia[] = [...this.media].filter(([, row]) => row.owner === owner && row.status === 'ready')
          .map(([id, row]) => ({ id, usage: 'avatar', mime: row.mime, bytes: 10, width: 64, height: 64, path: row.path }));
        return { elements, media };
      },
      mediaBegin: async (media: LocalMedia) => {
        this.check(); this.calls.push('begin');
        const existing = this.media.get(media.id);
        if (existing) return { path: existing.path, status: existing.status };
        const path = `${owner}/${media.id}.jpg`;
        this.media.set(media.id, { owner, status: 'pending', path, mime: media.mime });
        return { path, status: 'pending' };
      },
      upload: async (path: string) => {
        this.calls.push('upload');
        if (this.failUploadsOnce) { this.failUploadsOnce = false; throw new SyncError('network', 'Network request failed', undefined, 'network'); }
        this.objects.set(path, (this.objects.get(path) ?? 0) + 1);
      },
      commit: async (id: string) => {
        this.calls.push('commit');
        const row = this.media.get(id)!;
        if (!this.objects.has(row.path)) return { status: 'missing' as const };
        if (this.rejectMedia) { row.status = 'deleted'; return { status: 'rejected' as const, reason: this.rejectMedia }; }
        row.status = 'ready';
        return { status: 'ready' as const };
      },
      download: async (_owner: string, media: RemoteMedia) => { this.calls.push('download'); return `file:///profil/${media.id}.jpg`; },
    };
  }
}

function engine(store: ProfileLocalStore, server: Server, owner: string, options: { run?: () => boolean; notify?: (message: string) => void; now?: () => number } = {}) {
  return new ProfileSync(store, server.remote(owner), {
    enabled: () => true, userId: () => owner, runActive: options.run ?? (() => false), refreshAuth: async () => true,
    now: options.now ?? (() => Date.parse('2026-11-14T10:00:00Z')), notify: options.notify,
  });
}
const NOW = Date.parse('2026-11-14T10:00:00Z');

describe('profil personnalisé : brouillon, enregistrement et synchronisation (§17.6)', () => {
  it('un brouillon hors ligne survit au redémarrage de l’app', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'profil-')); dirs.push(dir);
    const first = device(join(dir, 'profile.db'));
    await first.editDraft(A, 'appearance', { theme: 'espace' }, NOW);
    await first.editDraft(A, 'about', { bio: 'Toujours partant' }, NOW);
    handles.splice(0).forEach((db) => db.close());
    const reopened = device(join(dir, 'profile.db'));
    const { working, saved } = await reopened.documents(A);
    expect(working).toMatchObject({ appearance: { theme: 'espace' }, about: { bio: 'Toujours partant' } });
    expect(saved).toEqual({});
  });

  it('après enregistrement, la version privée apparaît sur le second appareil du titulaire', async () => {
    const server = new Server(), phone = device(), tablet = device();
    await phone.editDraft(A, 'appearance', { theme: 'neon', accent: 'rose' }, NOW);
    await phone.editDraft(A, widgetKey(uuid()), { type: 'interests', title: 'Passions', tags: ['trail', 'piste'] }, NOW);
    expect(await phone.save(A, NOW, uuid)).toBe(2);
    expect((await engine(phone, server, A).sync('save')).phase).toBe('idle');
    await engine(tablet, server, A).sync('foreground');
    expect((await tablet.documents(A)).saved).toEqual((await phone.documents(A)).saved);
    expect((await phone.counts(A)).pending).toBe(0);
  });

  it('éléments distincts fusionnés ; même élément : version serveur gardée, changement local à revoir', async () => {
    const server = new Server(), phone = device(), tablet = device();
    await phone.editDraft(A, 'about', { bio: 'Version initiale' }, NOW); await phone.save(A, NOW, uuid);
    await engine(phone, server, A).sync('save');
    await engine(tablet, server, A).sync('foreground');
    await phone.editDraft(A, 'about', { bio: 'Depuis le téléphone' }, NOW); await phone.editDraft(A, 'identity', { name: 'Camille' }, NOW); await phone.save(A, NOW, uuid);
    await tablet.editDraft(A, 'about', { bio: 'Depuis la tablette' }, NOW); await tablet.editDraft(A, 'appearance', { theme: 'pastel' }, NOW); await tablet.save(A, NOW, uuid);
    await engine(phone, server, A).sync('save');
    await engine(tablet, server, A).sync('save');
    const tabletDocs = await tablet.documents(A);
    expect(tabletDocs.saved).toMatchObject({ about: { bio: 'Depuis le téléphone' }, identity: { name: 'Camille' }, appearance: { theme: 'pastel' } });
    expect(tabletDocs.drafts).toEqual([expect.objectContaining({ key: 'about', review: 'conflict', payload: { bio: 'Depuis la tablette' } })]);
    await engine(phone, server, A).sync('foreground');
    expect((await phone.documents(A)).saved).toMatchObject({ appearance: { theme: 'pastel' }, about: { bio: 'Depuis le téléphone' } });
  });

  it('réponse perdue puis nouvelle édition : aucun faux conflit, aucun doublon', async () => {
    const server = new Server(), phone = device();
    await phone.editDraft(A, 'status', { emoji: '🏃', text: 'Prépa semi' }, NOW); await phone.save(A, NOW, uuid);
    server.loseNextResponse = true;
    expect((await engine(phone, server, A).sync('save')).phase).toBe('offline');
    await phone.editDraft(A, 'status', { emoji: '🏁', text: 'Semi bouclé' }, NOW); await phone.save(A, NOW, uuid);
    await engine(phone, server, A).sync('network');
    expect(server.elements.get(`${A}/status`)).toMatchObject({ revision: 2, payload: { text: 'Semi bouclé' } });
    expect((await phone.documents(A)).drafts).toEqual([]);
  });

  it('un autre compte n’accède à aucun brouillon, envoi ni média du titulaire', async () => {
    const server = new Server(), shared = device();
    await shared.editDraft(A, 'about', { bio: 'Privé' }, NOW); await shared.save(A, NOW, uuid);
    await shared.editDraft(A, 'identity', { name: 'Brouillon de A' }, NOW);
    await shared.addMedia(A, { id: uuid(), usage: 'avatar', mime: 'image/jpeg', bytes: 10, width: 64, height: 64, uri: 'file:///a.jpg', path: null, state: 'local', createdAt: NOW });
    expect(await shared.documents(B)).toEqual({ saved: {}, working: {}, drafts: [] });
    expect(await shared.outbox(B)).toEqual([]);
    expect(await shared.media(B)).toEqual([]);
    await engine(shared, server, B).sync('state');
    expect([...server.elements.keys()].some((key) => key.startsWith(A))).toBe(false);
    await shared.forget(A);
    expect(await shared.documents(A)).toEqual({ saved: {}, working: {}, drafts: [] });
  });

  it('avatar personnel : transfert interrompu repris sans doublon, enregistré après validation', async () => {
    const server = new Server(), phone = device(), id = uuid();
    await phone.addMedia(A, { id, usage: 'avatar', mime: 'image/jpeg', bytes: 10, width: 64, height: 64, uri: 'file:///avatar.jpg', path: null, state: 'local', createdAt: NOW });
    await phone.editDraft(A, 'avatar', { source: 'media', mediaId: id, crop: { x: 0.2, y: 0, zoom: 1.4 } }, NOW);
    await phone.save(A, NOW, uuid);
    server.failUploadsOnce = true;
    expect((await engine(phone, server, A).sync('save')).phase).toBe('offline');
    expect(server.elements.has(`${A}/avatar`)).toBe(false);
    await engine(phone, server, A).sync('network');
    expect(server.objects.get(`${A}/${id}.jpg`)).toBe(1);
    expect(server.calls.filter((call) => call === 'begin')).toHaveLength(2);
    expect(server.elements.get(`${A}/avatar`)?.payload).toMatchObject({ mediaId: id, crop: { zoom: 1.4 } });
    const tablet = device();
    await engine(tablet, server, A).sync('foreground');
    expect((await tablet.media(A))[0]).toMatchObject({ id, state: 'remote', uri: `file:///profil/${id}.jpg` });
    expect((await tablet.documents(A)).saved.avatar).toMatchObject({ crop: { x: 0.2, y: 0, zoom: 1.4 } });
  });

  it('média refusé (position GPS) : rien n’est publié, le changement revient en brouillon et l’utilisateur est prévenu', async () => {
    const server = new Server(), phone = device(), id = uuid(), notify = vi.fn();
    server.rejectMedia = 'location';
    await phone.addMedia(A, { id, usage: 'banner', mime: 'image/jpeg', bytes: 10, width: 64, height: 64, uri: 'file:///b.jpg', path: null, state: 'local', createdAt: NOW });
    await phone.editDraft(A, 'banner', { source: 'media', mediaId: id }, NOW); await phone.save(A, NOW, uuid);
    await engine(phone, server, A, { notify }).sync('save');
    expect(notify).toHaveBeenCalledWith(expect.stringContaining('position GPS'));
    expect(server.elements.has(`${A}/banner`)).toBe(false);
    expect((await phone.documents(A)).drafts[0]).toMatchObject({ key: 'banner', review: 'rejected:media_location' });
    expect((await phone.documents(A)).saved.banner).toBeUndefined();
  });

  it('aucun appel pendant une course ; reprise ensuite. Coupure serveur : pause sans perte', async () => {
    const server = new Server(), phone = device();
    let running = true;
    await phone.editDraft(A, 'about', { bio: 'Pendant la course' }, NOW); await phone.save(A, NOW, uuid);
    const sync = engine(phone, server, A, { run: () => running });
    await sync.sync('save');
    expect(server.calls).toEqual([]);
    running = false;
    server.disabled = true;
    expect((await sync.sync('run_finished')).phase).toBe('paused');
    expect((await phone.counts(A)).pending).toBe(1);
    server.disabled = false;
    await sync.sync('manual');
    expect(server.elements.get(`${A}/about`)?.payload).toEqual({ bio: 'Pendant la course' });
  });
});

describe('profil personnalisé : modèle', () => {
  it('statut temporaire : expire à l’heure dite, sur tous les appareils', () => {
    const expiresAt = statusExpiry('1h', NOW)!;
    expect(activeStatus({ emoji: '🎧', text: 'Footing', expiresAt }, NOW + 59 * 60_000)).not.toBeNull();
    expect(activeStatus({ emoji: '🎧', text: 'Footing', expiresAt }, NOW + 61 * 60_000)).toBeNull();
    expect(activeStatus({ text: 'Sans limite', expiresAt: statusExpiry('permanent', NOW) }, NOW + 1e10)).not.toBeNull();
  });

  it('validation alignée sur le serveur', () => {
    expect(validatePayload('appearance', { theme: 'espace', accent: 'rose' })).toBeNull();
    expect(validatePayload('appearance', { theme: 'Thème Libre!' })).toBe('appearance');
    expect(validatePayload('about', { bio: 'x'.repeat(191) })).toBe('about');
    expect(validatePayload('about', { bio: `a${String.fromCharCode(7)}b` })).toBe('about');
    expect(validatePayload('banner', { source: 'gradient', colors: ['#112233'] })).toBe('banner');
    expect(validatePayload('banner', { source: 'gradient', colors: ['#112233', '#445566'] })).toBeNull();
    expect(validatePayload('avatar', { source: 'library', libraryId: 'fusee', crop: { x: 0, y: 0, zoom: 5 } })).toBe('avatar');
    expect(validatePayload('widget', { type: 'text', tags: ['x'] })).toBe('widget');
    expect(validatePayload('widget', { type: 'stats', stats: ['runs', 'distance'] })).toBeNull();
    expect(validatePayload('status', { text: '   ' })).toBe('status');
  });

  it('disposition : ordre du titulaire, widgets nouveaux ajoutés à la fin, déplacement accessible', () => {
    const one = widgetKey(uuid()), two = widgetKey(uuid()), three = widgetKey(uuid());
    const doc = { [one]: { type: 'text' }, [two]: { type: 'text' }, [three]: { type: 'text' }, layout: { order: [two, one, widgetKey(uuid())] } };
    expect(orderedWidgets(doc)).toEqual([two, one, three]);
    expect(moveInOrder([two, one, three], three, -1)).toEqual([two, three, one]);
    expect(moveInOrder([two, one, three], two, -1)).toEqual([two, one, three]);
  });

  it('statistiques privées calculées sur l’appareil, avec définition', () => {
    const run = (startedAt: number, distanceMeters: number, best?: number) => ({
      id: String(startedAt), startedAt, endedAt: startedAt + 1800_000, activeSeconds: 1800, distanceMeters, points: [], splits: [],
      bestEfforts: best ? { '5000': best } : undefined,
    }) as unknown as RunRecord;
    const stats = computeStats([run(Date.parse('2025-03-02'), 5200, 1500), run(Date.parse('2026-01-05'), 10400, 1450), run(Date.parse('2026-02-01'), 400)], ['runs', 'distance', 'best_effort'], NOW);
    expect(stats.map((stat) => stat.value)).toEqual(['2', '16 km', '24 min 10 s']);
    expect(stats[0]!.definition).toMatch(/au moins 1 km/);
  });

  it('thèmes et couleurs lisibles (4,5:1 pour le texte, 3:1 pour les accents)', () => {
    for (const theme of [...THEMES, SPRINTER_LIGHT]) {
      expect(contrastRatio(theme.text, theme.background), `${theme.id} texte`).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(theme.text, theme.surface), `${theme.id} texte carte`).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(theme.muted, theme.surface), `${theme.id} texte secondaire`).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(theme.accentInk, theme.accent), `${theme.id} bouton`).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(theme.accent, theme.surface), `${theme.id} accent`).toBeGreaterThanOrEqual(3);
      for (const accent of ACCENTS) {
        const resolved = resolveTheme(theme.id, accent.id, theme.dark);
        expect(contrastRatio(resolved.accent, resolved.surface), `${theme.id}/${accent.id}`).toBeGreaterThanOrEqual(3);
        expect(contrastRatio(resolved.accentInk, resolved.accent), `${theme.id}/${accent.id} encre`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
});
