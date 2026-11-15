import { normalizeApidae, readApidae, verifiedResource } from '../_shared/discovery-apidae.ts';
import { parisInstant, readDiscoveryItem } from '../_shared/discovery-model.ts';

function equal(actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${JSON.stringify(actual)} !== ${JSON.stringify(expected)}`);
  }
}

const url = 'https://opendata.nicecotedazur.org/data/storage/f/2026-11-14T06:00:48.793Z/events-public.json';
const metadata = (uri: string, license = 'lov2') => ({
  license,
  resources: [{ id: '4d57cbed-521f-44be-a2e4-da313cddd089', format: 'json', url: uri }],
});
const occurrence = {
  identifiant: 17,
  dateDebut: '2027-03-27',
  dateFin: '2027-03-28',
  horaireOuverture: '21:30:00',
  horaireFermeture: '08:30:00',
  tousLesAns: false,
  type: 'OUVERTURE_TOUS_LES_JOURS',
};
const row = {
  type: 'FETE_ET_MANIFESTATION',
  state: 'PUBLISHED',
  id: 12,
  nom: { libelleFr: 'Trail synthétique' },
  localisation: {
    adresse: { commune: { nom: 'Nice' } },
    geolocalisation: { valide: true, geoJson: { type: 'Point', coordinates: [7.24, 43.7] } },
  },
  ouverture: { periodesOuvertures: [occurrence] },
  illustrations: [{ rights: 'inconnu' }],
};
const payload = (rows: unknown[]) => ({ formatVersion: 'v002', numFound: 400, objetsTouristiques: rows });

Deno.test('Apidae vérifie l’hôte, le chemin, la ressource et la licence', () => {
  equal(verifiedResource(metadata(url.replace('https:', 'http:'))), url);
  for (
    const invalid of [
      metadata(url, 'notspecified'),
      metadata(url.replace('opendata.nicecotedazur.org', '127.0.0.1')),
      metadata(`${url}?forward=1`),
    ]
  ) {
    let rejected = false;
    try {
      verifiedResource(invalid);
    } catch {
      rejected = true;
    }
    equal(rejected, true);
  }
});

Deno.test('Normalisation partielle, déduplication et aucune assimilation des récurrences', () => {
  const recurring = { ...row, id: 99, ouverture: { periodesOuvertures: [{ ...occurrence, tousLesAns: true }] } };
  const expired = {
    ...row,
    id: 101,
    ouverture: { periodesOuvertures: [{ ...occurrence, dateDebut: '2025-01-01', dateFin: '2025-01-01' }] },
  };
  const result = normalizeApidae(payload([row, row, recurring, expired, { ...row, state: 'DELETED' }]), '2026-11-15');
  equal(result.metrics, {
    reported: 400,
    received: 5,
    partial: true,
    runningEntries: 4,
    skippedPeriods: 1,
    duplicateIds: 1,
    candidates: 1,
  });
  const item = result.rows[0]!.item;
  equal(item.schedule?.startAt, '2027-03-27T20:30:00.000Z');
  equal(item.schedule?.endAt, '2027-03-28T06:30:00.000Z');
  equal(item.price, undefined);
  equal(item.mediaKey, undefined);
  equal(item.point, { latitude: 43.7, longitude: 7.24 });
  equal(readDiscoveryItem({ ...item, schedule: { ...item.schedule, endAt: '2027-03-29T06:30:00Z' } }), null);
});

Deno.test('Heures ambiguës et inexistantes pendant les changements d’heure', () => {
  equal(parisInstant('2027-03-28', '02:15'), undefined);
  equal(parisInstant('2026-10-25', '02:15'), undefined);
  equal(parisInstant('2027-01-09', '10:00'), '2027-01-09T09:00:00.000Z');
  equal(parisInstant('2027-05-09', '10:00'), '2027-05-09T08:00:00.000Z');
});

Deno.test('Rejeu ETag et empreinte idempotents', async () => {
  let cached = false;
  let conditional = false;
  const request: typeof fetch = async (input, init) => {
    if (String(input).includes('/api/1/datasets/')) return Response.json(metadata(url));
    equal(String(input), url);
    conditional = new Headers(init?.headers).get('if-none-match') === '"one"';
    return cached ? new Response(null, { status: 304 }) : Response.json(payload([row]), { headers: { etag: '"one"' } });
  };
  const first = await readApidae(null, request, Date.parse('2026-11-15T12:00:00Z'));
  equal(first.rows.length, 1);
  equal(first.checkpoint.hash?.length, 64);
  cached = true;
  const replay = await readApidae(first.checkpoint, request);
  equal(replay.state, 'unchanged');
  equal(replay.rows, []);
  equal(conditional, true);
});

Deno.test('Document invalide jamais importé', async () => {
  const request: typeof fetch = async (input) =>
    String(input) === url ? new Response('{') : Response.json(metadata(url));
  let result: string | undefined;
  try {
    await readApidae(null, request);
  } catch (error) {
    result = (error as Error).message;
  }
  equal(result, 'provider_json_invalid');
});
