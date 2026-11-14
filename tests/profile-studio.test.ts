import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it } from 'vitest';
import type { SqlDatabase, SqlValue } from '../src/storage/repository';
import { ProfileLocalStore } from '../src/profile/localStore';
import {
  EditHistory, LIMITS, applyConfiguration, captureConfiguration, goalProgress, payloadMedia, restoreDefaultStyle, validatePayload, widgetKey, type Payload, type ProfileDoc,
} from '../src/profile/model';
import { contrastRatio, resolveAppearance } from '../src/profile/catalog';
import type { RunRecord } from '../src/core/types';

const handles: DatabaseSync[] = [];
afterEach(() => { handles.splice(0).forEach((db) => db.close()); });
let counter = 0;
const uuid = () => `00000000-0000-4000-8000-${String(++counter).padStart(12, '0')}`;
const NOW = Date.parse('2026-11-14T10:00:00Z');

describe('studio avancé (8b)', () => {
  it('annuler et rétablir, y compris une opération groupée', () => {
    const history = new EditHistory();
    history.record([{ key: 'appearance', before: null, after: { theme: 'neon' } }]);
    history.record([{ key: 'banner', before: null, after: { source: 'preset', presetId: 'aube' } }, { key: 'appearance', before: { theme: 'neon' }, after: { theme: 'pastel' } }]);
    history.record([{ key: 'about', before: { bio: 'x' }, after: { bio: 'x' } }]);
    expect(history.undo()).toEqual([{ key: 'appearance', before: { theme: 'pastel' }, after: { theme: 'neon' } }, { key: 'banner', before: { source: 'preset', presetId: 'aube' }, after: null }]);
    expect(history.canRedo).toBe(true);
    expect(history.redo()?.map((step) => step.after)).toEqual([{ source: 'preset', presetId: 'aube' }, { theme: 'pastel' }]);
    history.undo(); history.undo();
    expect(history.canUndo).toBe(false);
  });

  it('restaurer l’apparence par défaut garde images, textes, statut et widgets', () => {
    const widget = widgetKey(uuid());
    const doc: ProfileDoc = {
      appearance: { theme: 'neon', font: 'serif' }, decorations: { title: 'Traileuse' }, about: { bio: 'Bio' }, status: { text: 'Prépa' },
      avatar: { source: 'media', mediaId: uuid(), shape: 'rounded', halo: true }, banner: { source: 'preset', presetId: 'aube', veil: 0.3 }, [widget]: { type: 'text', text: 'Bonjour' },
    };
    const changes = restoreDefaultStyle(doc);
    expect(changes.map((change) => change.key).sort()).toEqual(['appearance', 'avatar', 'banner', 'decorations']);
    expect(changes.find((change) => change.key === 'avatar')?.payload).toEqual({ source: 'media', mediaId: (doc.avatar as Payload).mediaId });
    expect(changes.find((change) => change.key === 'banner')?.payload).toEqual({ source: 'preset', presetId: 'aube' });
    expect(changes.some((change) => ['about', 'status', widget].includes(change.key))).toBe(false);
  });

  it('une configuration capture le style et la disposition, jamais le contenu ; l’appliquer garde le contenu', () => {
    const one = widgetKey(uuid()), two = widgetKey(uuid());
    const doc: ProfileDoc = {
      appearance: { theme: 'cyberpunk' }, avatar: { source: 'media', mediaId: uuid(), frame: 'gradient' }, about: { bio: 'Privé' }, status: { text: 'Au repos' },
      [one]: { type: 'text', text: 'Un', size: 'wide' }, [two]: { type: 'mood', emoji: '😄' }, layout: { order: [two, one] },
    };
    const config = captureConfiguration(doc, ' Cyberpunk ');
    expect(config).toEqual({ name: 'Cyberpunk', appearance: { theme: 'cyberpunk' }, avatar: { frame: 'gradient' }, order: [two, one], sizes: { [two]: 'compact', [one]: 'wide' } });
    expect(JSON.stringify(config)).not.toMatch(/Privé|Au repos|mediaId/);
    expect(validatePayload('config', config as unknown as Payload)).toBeNull();
    const minimal: ProfileDoc = { ...doc, appearance: { theme: 'minimaliste' }, avatar: { source: 'media', mediaId: (doc.avatar as Payload).mediaId as string }, layout: { order: [one, two] } };
    const changes = Object.fromEntries(applyConfiguration(minimal, config).map((change) => [change.key, change.payload]));
    expect(changes.appearance).toEqual({ theme: 'cyberpunk' });
    expect(changes.avatar).toEqual({ source: 'media', mediaId: (doc.avatar as Payload).mediaId, frame: 'gradient' });
    expect(changes.layout).toEqual({ order: [two, one] });
    expect(Object.keys(changes)).not.toContain('about');
    expect(Object.keys(changes)).not.toContain('status');
  });

  it('studio coupé : les réglages avancés sont refusés comme côté serveur', () => {
    expect(validatePayload('decorations', { title: 'Traileuse' }, false)).toBe('studio_disabled');
    expect(validatePayload('widget', { type: 'goal', label: 'Semi' }, false)).toBe('studio_disabled');
    expect(validatePayload('appearance', { theme: 'espace' }, false)).toBeNull();
    expect(validatePayload('decorations', { plate: 'officiel-or' })).toBe('decorations');
    expect(validatePayload('decorations', { title: 'Coureur certifié' })).toBe('decorations');
    expect(validatePayload('widget', { type: 'links', links: [{ label: 'Blog', url: 'http://exemple.fr' }] })).toBe('widget');
    expect(validatePayload('widget', { type: 'links', links: [{ label: 'Blog', url: 'https://exemple.fr/courses' }] })).toBeNull();
    expect(validatePayload('widget', { type: 'gallery', images: [{ mediaId: uuid(), alt: ' ' }] })).toBe('widget');
    expect(validatePayload('badges', { show: ['courses_10', 'champion'] })).toBe('badges');
  });

  it('profil au maximum des limites du §17.8 : chaque contenu reste valide et sous 4 Ko', () => {
    const long = (length: number) => 'é'.repeat(length);
    const widgets: Payload[] = [
      { type: 'text', title: long(40), text: long(280), size: 'wide' },
      { type: 'interests', title: long(40), tags: Array.from({ length: LIMITS.tags }, (_, index) => `${long(22)}${index}`.slice(0, 24)) },
      { type: 'stats', title: long(40), stats: ['seniority', 'runs', 'distance', 'best_effort'] },
      { type: 'goal', title: long(40), label: long(60), target: 1_000_000, unit: 'km', progress: 999_999, source: 'manual' },
      { type: 'gallery', title: long(40), images: Array.from({ length: LIMITS.gallery }, () => ({ mediaId: uuid(), alt: long(140) })) },
      { type: 'links', title: long(40), links: Array.from({ length: LIMITS.links }, (_, index) => ({ label: long(40), url: `https://exemple${index}.fr/${'a'.repeat(170)}` })) },
      { type: 'mood', title: long(40), emoji: '🏃‍♀️', message: long(140) },
      { type: 'counter', title: long(40), label: long(40), value: -1e9, unit: long(16) },
    ];
    for (const widget of widgets) {
      expect(validatePayload('widget', widget), String(widget.type)).toBeNull();
      expect(new TextEncoder().encode(JSON.stringify(widget)).length, String(widget.type)).toBeLessThanOrEqual(4096);
    }
    expect(validatePayload('statuses', { items: Array.from({ length: LIMITS.statusTemplates }, () => ({ emoji: '🏁', text: long(80) })) })).toBeNull();
    expect(validatePayload('about', { bio: long(190), quote: long(140), long: long(1000) })).toBeNull();
    expect(payloadMedia(widgets[4]!)).toHaveLength(LIMITS.gallery);
    expect(payloadMedia({ name: 'Style', banner: { source: 'media', mediaId: '00000000-0000-4000-8000-0000000000aa', posterId: '00000000-0000-4000-8000-0000000000bb' } })).toHaveLength(2);
  });

  it('couleurs personnalisées : une combinaison illisible est corrigée', () => {
    const resolved = resolveAppearance({ theme: 'pastel', colors: { background: '#FFF7FB', surface: '#FFFFFF', accent: '#FFF4E0' } }, false, 'ios');
    expect(contrastRatio(resolved.text, resolved.surface)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(resolved.accent, resolved.surface)).toBeGreaterThanOrEqual(3);
    const clash = resolveAppearance({ theme: 'sombre', colors: { background: '#F4F4F5' } }, true, 'android');
    expect(contrastRatio(clash.text, clash.background)).toBeGreaterThanOrEqual(4.5);
    expect(resolveAppearance({ theme: 'espace', font: 'serif' }, true, 'ios').fontFamily).toBe('Georgia');
  });

  it('objectif : progression saisie ou calculée sur l’appareil, avec provenance', () => {
    const run = (startedAt: number, meters: number) => ({ id: String(startedAt), startedAt, endedAt: startedAt + 1800_000, activeSeconds: 1800, distanceMeters: meters, points: [], splits: [] }) as unknown as RunRecord;
    const history = [run(Date.parse('2026-11-02T08:00:00Z'), 10_000), run(Date.parse('2026-10-20T08:00:00Z'), 8_000), run(Date.parse('2026-11-05T08:00:00Z'), 500)];
    expect(goalProgress({ type: 'goal', source: 'distance_month', target: 100 }, history, NOW)).toEqual({ value: 10, computed: true });
    expect(goalProgress({ type: 'goal', source: 'runs_year', target: 50 }, history, NOW)).toEqual({ value: 2, computed: true });
    expect(goalProgress({ type: 'goal', progress: 12, target: 50 }, history, NOW)).toEqual({ value: 12, computed: false });
  });

  it('une base 8a reçoit la colonne des médias animés sans perte', async () => {
    const db = new DatabaseSync(':memory:'); handles.push(db);
    db.exec(`CREATE TABLE profile_media (owner TEXT NOT NULL, id TEXT NOT NULL, usage TEXT NOT NULL, mime TEXT NOT NULL, bytes INTEGER NOT NULL,
      width INTEGER NOT NULL, height INTEGER NOT NULL, uri TEXT, path TEXT, state TEXT NOT NULL, created_at REAL NOT NULL, PRIMARY KEY (owner, id));
      INSERT INTO profile_media VALUES ('o', 'm', 'avatar', 'image/jpeg', 10, 64, 64, 'file:///m.jpg', NULL, 'ready', 1);`);
    const sql: SqlDatabase = {
      async execAsync(text) { db.exec(text); },
      async runAsync(text, ...params: SqlValue[]) { return db.prepare(text).run(...params); },
      async getFirstAsync<T>(text: string, ...params: SqlValue[]) { return (db.prepare(text).get(...params) ?? null) as T | null; },
      async getAllAsync<T>(text: string, ...params: SqlValue[]) { return db.prepare(text).all(...params) as T[]; },
    };
    const store = new ProfileLocalStore(sql);
    expect(await store.media('o')).toEqual([expect.objectContaining({ id: 'm', animated: false, uri: 'file:///m.jpg' })]);
    await store.addMedia('o', { id: 'g', usage: 'avatar', mime: 'image/gif', bytes: 10, width: 64, height: 64, uri: 'file:///g.gif', path: null, state: 'local', createdAt: 2, animated: true });
    expect((await store.media('o')).find((item) => item.id === 'g')?.animated).toBe(true);
  });
});
