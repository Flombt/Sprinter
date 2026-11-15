import { describe, expect, it, vi } from 'vitest';
import {
  addDiscoveryDays,
  parisDay,
  parisInstant,
  readDiscoveryItem,
  type DiscoveryItem,
} from '../supabase/functions/_shared/discovery-model';
import { createMemoryKeyValueStore } from '../src/account/kvStore';
import editorial from '../src/discovery/catalogue.json';
import {
  dateWindow,
  defaultFilters,
  filterCatalogue,
  mergeCatalogue,
  parseDateWindow,
  remaining,
  verifiedPrice,
  verifiedRegistration,
} from '../src/discovery/catalog';
import { calendarDocument } from '../src/discovery/calendarExport';
import { fetchDiscoveryFeed, parseCachedFeed } from '../src/discovery/feed';
import { mapClusters, regionAround } from '../src/discovery/mapModel';
import {
  discoveryPreferenceStore,
  discoveryUserKey,
  readPreferences,
  updateSaved,
} from '../src/discovery/preferences';
import { linkedPlan, preparationTarget } from '../src/discovery/trainingLink';
import { generatePlan } from '../src/progression/plans';

const initial = Date.parse('2026-11-15T10:30:00Z');
const today = parisDay(initial);
const bundle = editorial.map((row) => readDiscoveryItem(row)!);
const item = (id: string) => bundle.find((entry) => entry.id === id)!;
const prom = item('prom-classic-2027');
const club = item('runfest-run-club');
const cap = item('mounta-cala-2026');
const options = { sector: 'nice', radius: 25, query: '', now: initial, filters: defaultFilters } as const;

describe('catalogue éditorial et validation', () => {
  it('valide chaque fiche, les IDs uniques et les minima du pilote', () => {
    expect(bundle).not.toContain(null);
    expect(new Set(bundle.map((entry) => entry.id)).size).toBe(bundle.length);
    expect(bundle.filter((entry) => entry.kind === 'race' && remaining(entry, initial))).toHaveLength(5);
    expect(bundle.filter((entry) => entry.kind === 'club')).toHaveLength(3);
    expect(bundle.filter((entry) => entry.kind === 'place')).toHaveLength(3);
    expect(bundle.filter((entry) => entry.kind === 'club_run')).toHaveLength(1);
  });

  it('refuse dates invalides, horaires incompatibles, points hors domaine, URLs dangereuses et HTML', () => {
    for (const invalid of [
      { ...prom, officialUrl: 'javascript:alert(1)' },
      { ...prom, officialUrl: 'https://maps.example.com@private.test' },
      { ...prom, summary: '<script>' },
      { ...prom, point: { latitude: 91, longitude: 7 } },
      { ...prom, schedule: { ...prom.schedule, day: '2027-02-29' } },
      { ...prom, schedule: { ...prom.schedule, startAt: '2027-01-10T08:00:00' } },
      { ...prom, schedule: { ...prom.schedule, endAt: '2027-01-10T07:00:00Z' } },
      { ...club, kind: 'club_run' },
      { ...prom, sources: [] },
      {
        ...item('canal-gairaut'),
        track: {
          segments: [
            [
              { latitude: 43.7, longitude: 7.2 },
              { latitude: 43.8, longitude: 7.3 },
            ],
          ],
          credit: 'Source',
          sourceUrl: 'https://www.nice.fr',
          license: 'CC-BY-4.0',
        },
      },
    ])
      expect(readDiscoveryItem(invalid)).toBeNull();
  });

  it('recherche accents, ponctuation, distance et les synonymes locaux', () => {
    for (const query of ['prom classic', 'Prom’Classic', 'promclassic']) {
      expect(filterCatalogue(bundle, { ...options, query }).map((entry) => entry.id)).toContain(prom.id);
    }
    expect(filterCatalogue(bundle, { ...options, query: '10k' }).map((entry) => entry.id)).toContain(prom.id);
    expect(filterCatalogue(bundle, { ...options, query: 'footing' }).map((entry) => entry.id)).toContain(
      'breakfast-run-2027',
    );
    expect(filterCatalogue(bundle, { ...options, query: 'piste' }).map((entry) => entry.id)).toContain(
      'plateau-sportif-vauban',
    );
  });

  it('combine prix vérifié, débutant, catégorie, terrain, rayon et date', () => {
    const filters = {
      ...defaultFilters,
      free: true,
      beginner: true,
      category: 'club',
      terrain: 'trail',
    } as const;
    expect(filterCatalogue(bundle, { ...options, filters }).map((entry) => entry.id)).toEqual([club.id]);
    expect(filterCatalogue(bundle, { ...options, filters, radius: 5 })).toEqual([]);
    const races = { ...defaultFilters, distanceKm: 10, registrationOpen: true, terrain: 'road' } as const;
    expect(filterCatalogue(bundle, { ...options, filters: races }).map((entry) => entry.id)).toEqual([
      cap.id,
    ]);
    expect(
      filterCatalogue(bundle, { ...options, window: dateWindow('month', today) }).map((entry) => entry.id),
    ).toEqual(['urban-trail-vence-2026']);
  });

  it('sépare absence de position et géolocalisation facultative de la carte', () => {
    const unknown = { ...club, id: 'lieu-inconnu', city: 'Une commune sans coordonnées' };
    expect(filterCatalogue([unknown, club], options)).toHaveLength(2);
    expect(
      filterCatalogue([unknown, club], { ...options, position: { latitude: 43.7, longitude: 7.26 } }),
    ).toEqual([club]);
    const center = regionAround(prom.point!, 10);
    expect(
      mapClusters([unknown, club, prom, item('promenade-des-anglais')], center, 360, 280).map(
        (cluster) => cluster.items.length,
      ),
    ).toEqual([2]);
  });

  it('expire à la fin vérifiée ou au changement de jour Paris, et garde les dates partielles hors périodes', () => {
    expect(remaining(prom, Date.parse('2027-01-10T11:44:59Z'))).toBe(true);
    expect(remaining(prom, Date.parse('2027-01-10T11:45:00Z'))).toBe(false);
    const vence = item('urban-trail-vence-2026');
    expect(remaining(vence, Date.parse('2026-12-13T22:59:59Z'))).toBe(true);
    expect(remaining(vence, Date.parse('2026-12-13T23:00:00Z'))).toBe(false);
    for (const state of ['cancelled', 'postponed', 'stale'] as const)
      expect(remaining({ ...prom, state }, initial)).toBe(false);
    expect(remaining(item('semi-marathon-nice-2027'), initial)).toBe(false);
    expect(dateWindow('weekend', '2026-11-15')).toEqual({ from: '2026-11-15', through: '2026-11-15' });
    expect(parseDateWindow('2026-11-15', '2026-11-13')).toBeUndefined();
  });

  it('omet les statuts et prix anciens ou inconnus', () => {
    expect(verifiedRegistration(prom, initial, today)?.state).toBe('sold_out');
    expect(verifiedRegistration(prom, initial, addDiscoveryDays(today, 8))).toBeUndefined();
    expect(verifiedPrice(club, addDiscoveryDays(today, 90))).toBe(0);
    expect(verifiedPrice(club, addDiscoveryDays(today, 91))).toBeUndefined();
    expect(verifiedPrice(prom, today)).toBeUndefined();
  });
});

describe('persistance et lecture distante', () => {
  it('sérialise deux mises à jour, conserve un seul favori et isole les comptes et la suppression', async () => {
    const kv = createMemoryKeyValueStore();
    const repo = discoveryPreferenceStore(kv);
    await Promise.all([
      repo.change('alice', (saved) => updateSaved(saved, prom, { favorite: true })),
      repo.change('alice', (saved) => updateSaved(saved, prom, { goal: { distanceKm: 10, addedOn: today } })),
    ]);
    expect((await repo.load('alice')).saves).toMatchObject([{ favorite: true, goal: { distanceKm: 10 } }]);
    expect((await repo.load('bob')).saves).toEqual([]);
    await repo.forget('alice');
    expect(kv.data.has(discoveryUserKey('alice'))).toBe(false);
  });

  it('préserve les données illisibles et conserve une fiche favorite quand le serveur la masque', () => {
    expect(() => readPreferences('{')).toThrow();
    const revised = { ...prom, state: 'cancelled' } as const;
    const server = new Map<string, DiscoveryItem | null>([
      [prom.id, revised],
      [club.id, null],
    ]);
    const merged = mergeCatalogue([prom, club], server);
    expect(merged).toEqual([revised]);
    expect(filterCatalogue(merged, options)).toEqual([]);
  });

  it('n’applique pas un cache corrompu ou des pages mélangées', async () => {
    const backend = { url: 'https://project.supabase.co', publishableKey: 'public-test' };
    const entries = Array.from({ length: 20 }, (_, index) => ({
      id: `item-${String(index).padStart(2, '0')}`,
      item: null,
    }));
    expect(() =>
      parseCachedFeed(
        JSON.stringify({ version: 1, loadedAt: initial, entries: [entries[0], entries[0]] }),
        'nice',
        initial,
      ),
    ).toThrow('dupliqué');
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ version: 1, revision: 14, entries, nextCursor: 'item-19' }))
      .mockResolvedValueOnce(Response.json({ version: 1, revision: 15, entries: [], nextCursor: null }));
    await expect(
      fetchDiscoveryFeed(backend, 'nice', 'test', new AbortController().signal, request),
    ).rejects.toThrow('incohérente');
    expect(request.mock.calls[1]?.[0]).toContain('p_after=item-19&p_revision=14');
    const aborted = new AbortController();
    aborted.abort();
    await expect(fetchDiscoveryFeed(backend, 'nice', 'test', aborted.signal, request)).rejects.toThrow(
      'interrompue',
    );
    expect(request).toHaveBeenCalledTimes(2);
  });
});

describe('calendrier et préparation', () => {
  it('utilise Europe/Paris, les dates calendaires et des lignes ICS sans coupure Unicode', () => {
    expect(parisInstant('2027-03-28', '02:30')).toBeUndefined();
    const { data } = calendarDocument(prom, initial);
    expect(data).toContain('DTSTART:20270110T080000Z\r\n');
    const allDay = calendarDocument(
      {
        ...prom,
        summary: 'é'.repeat(120),
        schedule: {
          day: '2027-03-27',
          lastDay: '2027-03-28',
          timeZone: 'Europe/Paris',
        },
      },
      initial,
    );
    expect(allDay.data).toContain('DTEND;VALUE=DATE:20270329');
    for (const line of String(allDay.data).split('\r\n'))
      expect(Buffer.byteLength(line, 'utf8')).toBeLessThanOrEqual(75);
    expect(() => calendarDocument({ ...prom, state: 'cancelled' })).toThrow('exportable');
  });

  it('préremplit un plan avant la date réelle et garde les autres formats en préparation manuelle', () => {
    const preparation = { name: prom.title, distanceKm: 10, event: { id: prom.id, day: prom.schedule!.day } };
    const plan = linkedPlan(preparation, today)!;
    expect(plan).toEqual({
      name: prom.title,
      goalMeters: 10000,
      start: '2026-11-16',
      weeks: 7,
      targetEvent: preparation.event,
    });
    const config = {
      ...plan,
      id: 'test',
      weekdays: [1, 3, 5],
      baseWeekMeters: 11000,
      maximumSessionMeters: 6000,
      growthPercent: 0,
      createdAt: initial,
    };
    expect(generatePlan(config).at(-1)?.day).toBe('2027-01-03');
    expect(() => generatePlan({ ...config, weeks: 8 })).toThrow('se terminer avant');
    expect(linkedPlan({ ...preparation, distanceKm: 42.195 }, today)).toBeUndefined();
    expect(linkedPlan(preparation, '2027-01-04')).toBeUndefined();
    const original = { fast: 300, slow: 315, distanceMeters: 5000, finishSeconds: 1500 };
    expect(preparationTarget(original, preparation)).toEqual({ fast: 300, slow: 315, distanceMeters: 10000 });
    expect(original.distanceMeters).toBe(5000);
  });
});
