import {
  addDiscoveryDays,
  type DiscoveryItem,
  parisDay,
  parisInstant,
  parisTimeZone,
  publicHttps,
  readDiscoveryItem,
  validDate,
  validPoint,
} from './discovery-model.ts';

const slug = 'liste-des-evenements-publics-recenses-par-loffice-du-tourisme-metropolitain-nice-cote-dazur';
export const datasetPage = `https://www.data.gouv.fr/datasets/${slug}`;
const metadataUrl = `https://www.data.gouv.fr/api/1/datasets/${slug}/`;
const resourceId = '4d57cbed-521f-44be-a2e4-da313cddd089';
export const apidaeSource = 'apidae-nice';
const resourceHost = 'opendata.nicecotedazur.org';
const text = (value: unknown) => typeof value === 'string' ? value : '';
const object = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const list = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const label = (value: unknown) => text(object(value).libelleFr);
const clean = (value: unknown) => text(value).replace(/[<>]/g, '').replace(/\s+/g, ' ').trim();
const searchKey = (value: string) =>
  value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^\da-z]+/g, ' ').trim();

interface Candidate {
  externalId: string;
  fingerprint: string;
  item: DiscoveryItem;
}
export interface Checkpoint {
  url: string | null;
  etag: string | null;
  modified: string | null;
  hash: string | null;
}
export type Metrics = Record<string, number | boolean>;
type Result = { state: 'ok' | 'unchanged'; checkpoint: Checkpoint; metrics: Metrics; rows: Candidate[] };

export function verifiedResource(metadata: unknown): string {
  const data = object(metadata);
  if (data.license !== 'lov2') throw new Error('provider_license_changed');
  const resource = list(data.resources).map(object).find((item) => item.id === resourceId && item.format === 'json');
  const address = text(resource?.url).replace(/^http:/, 'https:');
  let url: URL;
  try {
    url = new URL(address);
  } catch {
    throw new Error('provider_resource_missing');
  }
  if (
    url.protocol !== 'https:' || url.hostname !== resourceHost || url.port || url.username || url.password ||
    url.hash || url.search ||
    !/^\/data\/storage\/f\/\d{4}-\d{2}-\d{2}T[\d:.]+Z\/events-public\.json$/.test(url.pathname)
  ) {
    throw new Error('provider_resource_rejected');
  }
  return url.href;
}

export function normalizeApidae(input: unknown, checkedOn: string): { rows: Candidate[]; metrics: Metrics } {
  const data = object(input);
  if (
    data.formatVersion !== 'v002' || !Array.isArray(data.objetsTouristiques) ||
    typeof data.numFound !== 'number' || !Number.isSafeInteger(data.numFound) ||
    data.numFound < data.objetsTouristiques.length || data.objetsTouristiques.length > 2000 || !validDate(checkedOn)
  ) {
    throw new Error('provider_schema_changed');
  }
  const rows = new Map<string, Candidate>();
  let skippedPeriods = 0;
  let duplicateIds = 0;
  let runningEntries = 0;
  for (const raw of data.objetsTouristiques) {
    const row = object(raw);
    if (
      row.state !== 'PUBLISHED' || row.type !== 'FETE_ET_MANIFESTATION' ||
      !Number.isSafeInteger(row.id) || (row.id as number) <= 0
    ) continue;
    const title = clean(label(row.nom));
    const category = object(row.informationsFeteEtManifestation);
    const tags = [...list(category.typesManifestation), ...list(category.categories), ...list(category.themes)].map(
      label,
    ).join(' ');
    const kindText = searchKey(`${title} ${tags}`);
    if (!/\b(?:marathon|semi marathon|trail|running|course a pied|10 km|footing)\b/.test(kindText)) continue;
    runningEntries++;

    const location = object(row.localisation);
    const address = object(location.adresse);
    const city = clean(object(address.commune).nom);
    const geo = object(location.geolocalisation);
    const geoJson = object(geo.geoJson);
    const pair = list(geoJson.coordinates);
    const point = geo.valide === true && geoJson.type === 'Point' && pair.length === 2
      ? { latitude: pair[1], longitude: pair[0] }
      : undefined;
    const officialUrl = list(object(row.informations).moyensCommunication).map(object)
      .filter((contact) => object(contact.type).id === 205).map((contact) => object(contact.coordonnees).fr)
      .find(publicHttps) ?? datasetPage;

    for (const rawPeriod of list(object(row.ouverture).periodesOuvertures)) {
      const period = object(rawPeriod);
      const day = period.dateDebut;
      const lastDay = period.dateFin;
      // A recurring template, a gap in the calendar or a club timetable is not an occurrence.
      if (
        !Number.isSafeInteger(period.identifiant) || (period.identifiant as number) <= 0 ||
        !validDate(day) || !validDate(lastDay) || lastDay < day || lastDay > addDiscoveryDays(day, 6) ||
        period.tousLesAns !== false || period.type !== 'OUVERTURE_TOUS_LES_JOURS'
      ) {
        skippedPeriods++;
        continue;
      }
      if (lastDay < checkedOn) continue;
      const startAt = parisInstant(day, period.horaireOuverture);
      const endAt = parisInstant(lastDay, period.horaireFermeture);
      const id = `apidae-${row.id}-${period.identifiant}`;
      const item = readDiscoveryItem({
        id,
        kind: 'race',
        state: 'published',
        market: 'nice',
        countryCode: 'FR',
        title,
        city,
        summary: 'Rendez-vous recensé par l’Office de tourisme. Programme à vérifier auprès de l’organisateur.',
        schedule: {
          day,
          ...(lastDay !== day ? { lastDay } : {}),
          timeZone: parisTimeZone,
          ...(startAt ? { startAt } : {}),
          ...(startAt && endAt && endAt > startAt ? { endAt } : {}),
        },
        ...(validPoint(point) ? { point } : {}),
        officialUrl,
        sources: [{
          kind: 'open_data',
          name: 'Office de tourisme métropolitain Nice Côte d’Azur',
          url: datasetPage,
          externalId: id,
          checkedOn,
          license: 'Licence Ouverte 2.0',
        }],
      });
      if (!item) {
        skippedPeriods++;
        continue;
      }
      if (rows.has(id)) {
        duplicateIds++;
        continue;
      }
      rows.set(id, {
        externalId: id,
        fingerprint: `${searchKey(title)}|${day}|${searchKey(city)}`.slice(0, 250),
        item,
      });
      if (rows.size > 400) throw new Error('provider_too_many_candidates');
    }
  }
  return {
    rows: [...rows.values()],
    metrics: {
      reported: data.numFound,
      received: data.objetsTouristiques.length,
      partial: data.numFound !== data.objetsTouristiques.length,
      runningEntries,
      skippedPeriods,
      duplicateIds,
      candidates: rows.size,
    },
  };
}

async function boundedBody(response: Response, limit: number): Promise<Uint8Array<ArrayBuffer>> {
  if ((Number(response.headers.get('content-length')) || 0) > limit || !response.body) {
    throw new Error('provider_payload_bounds');
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const next = await reader.read();
      if (next.done) break;
      size += next.value.byteLength;
      if (size > limit) throw new Error('provider_payload_bounds');
      chunks.push(next.value);
    }
  } catch (error) {
    await reader.cancel().catch(() => undefined);
    throw error;
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

async function resource(url: string, headers: Headers, request: typeof fetch, maxBytes: number) {
  let problem = 'provider_unavailable';
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt) await new Promise((resolve) => setTimeout(resolve, 300 * 2 ** (attempt - 1)));
    try {
      const response = await request(url, { headers, redirect: 'error', signal: AbortSignal.timeout(10_000) });
      if (response.status === 304) return { headers: response.headers, bytes: null };
      if (response.ok) return { headers: response.headers, bytes: await boundedBody(response, maxBytes) };
      await response.body?.cancel();
      problem = `provider_http_${response.status}`;
      if (response.status >= 400 && response.status < 500 && response.status !== 429) break;
    } catch (error) {
      if (error instanceof Error && error.message === 'provider_payload_bounds') throw error;
    }
  }
  throw new Error(problem);
}

const decode = (bytes: Uint8Array): unknown => {
  try {
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch {
    throw new Error('provider_json_invalid');
  }
};

export async function readApidae(checkpoint: Checkpoint | null, request = fetch, now = Date.now()): Promise<Result> {
  const headers = new Headers({ Accept: 'application/json' });
  const metadata = await resource(metadataUrl, headers, request, 512_000);
  if (!metadata.bytes) throw new Error('provider_metadata_missing');
  const url = verifiedResource(decode(metadata.bytes));
  if (checkpoint?.url === url) {
    if (checkpoint.etag) headers.set('if-none-match', checkpoint.etag);
    if (checkpoint.modified) headers.set('if-modified-since', checkpoint.modified);
  }
  const document = await resource(url, headers, request, 10_000_000);
  if (!document.bytes) {
    if (checkpoint?.url !== url || !checkpoint.hash) throw new Error('provider_unexpected_304');
    return { state: 'unchanged', checkpoint, metrics: {}, rows: [] };
  }
  const digest = await crypto.subtle.digest('SHA-256', document.bytes);
  const hash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
  const next = {
    url,
    hash,
    etag: document.headers.get('etag')?.slice(0, 512) ?? null,
    modified: document.headers.get('last-modified')?.slice(0, 128) ?? null,
  };
  if (checkpoint?.hash === hash) return { state: 'unchanged', checkpoint: next, metrics: {}, rows: [] };
  return { state: 'ok', checkpoint: next, ...normalizeApidae(decode(document.bytes), parisDay(now)) };
}
