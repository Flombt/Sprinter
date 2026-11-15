export const discoveryKinds = ['race', 'club_run', 'training', 'club', 'place', 'route'] as const;
export type DiscoveryKind = (typeof discoveryKinds)[number];
export const terrains = ['road', 'trail', 'track', 'mixed'] as const;
export type Terrain = (typeof terrains)[number];
export const visibleStates = ['published', 'stale', 'cancelled', 'postponed'] as const;
export type VisibleState = (typeof visibleStates)[number];
const registrationStates = ['open', 'closed', 'sold_out'] as const;
const sourceKinds = ['organizer', 'institution', 'open_data'] as const;
export const parisTimeZone = 'Europe/Paris';
export const catalogVersion = 1;
export const maxCatalogItems = 600;

export interface DiscoveryPoint {
  latitude: number;
  longitude: number;
}

export interface DiscoverySource {
  kind: (typeof sourceKinds)[number];
  name: string;
  url: string;
  checkedOn: string;
  externalId?: string;
  license?: string;
}

export interface DiscoverySchedule {
  day: string;
  lastDay?: string;
  startAt?: string;
  endAt?: string;
  timeZone: typeof parisTimeZone;
}

export interface DiscoveryTrack {
  segments: DiscoveryPoint[][];
  sourceUrl: string;
  license: string;
  credit: string;
}

export interface DiscoveryItem {
  id: string;
  kind: DiscoveryKind;
  state: VisibleState;
  market: string;
  countryCode: string;
  title: string;
  summary: string;
  city: string;
  officialUrl: string;
  sources: DiscoverySource[];
  schedule?: DiscoverySchedule;
  dateNote?: string;
  reviewBy?: string;
  point?: DiscoveryPoint;
  venue?: string;
  address?: string;
  terrain?: Terrain;
  setting?: string;
  distancesKm?: number[];
  elevationGainM?: number;
  organizer?: string;
  clubId?: string;
  beginner?: boolean;
  accessible?: boolean;
  registration?: { state: (typeof registrationStates)[number]; checkedOn: string; url?: string };
  price?: { cents: number; checkedOn: string };
  facts?: { label: string; text: string }[];
  mediaKey?: string;
  track?: DiscoveryTrack;
  featured?: boolean;
}

const asObject = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const member = <T extends string>(value: unknown, values: readonly T[]): value is T =>
  typeof value === 'string' && values.some((option) => option === value);
const numberIn = (value: unknown, min: number, max: number): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
const cleanText = (value: unknown, max: number): value is string =>
  typeof value === 'string' && value.length <= max && value.trim() === value && value.length > 0 &&
  // deno-lint-ignore no-control-regex
  !/[<>\x00-\x1F\x7F\u202A-\u202E\u2066-\u2069]/u.test(value);
const maybe = (value: unknown, valid: (input: unknown) => boolean) => value === undefined || valid(value);
export const discoveryId = (value: unknown): value is string =>
  typeof value === 'string' && /^[a-z0-9][a-z0-9-]{1,98}[a-z0-9]$/.test(value);

/** Accept only external HTTPS sites. Provider fetches have their own fixed allowlist. */
export function publicHttps(value: unknown): value is string {
  if (!cleanText(value, 1000) || !value.startsWith('https://') || /[\\\s]/.test(value)) return false;
  try {
    const url = new URL(value);
    return !url.username && !url.password && !url.port &&
      /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/i.test(url.hostname) &&
      !/\.(?:local|localhost|internal|test|invalid|example|onion|home|lan)$/i.test(url.hostname);
  } catch {
    return false;
  }
}

export function validDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^(?:19|20|21|22)\d{2}-\d{2}-\d{2}$/.test(value)) return false;
  const instant = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(instant) && new Date(instant).toISOString().slice(0, 10) === value;
}

export function addDiscoveryDays(day: string, count: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + count * 86_400_000).toISOString().slice(0, 10);
}

const parisClock = new Intl.DateTimeFormat('sv-SE', {
  timeZone: parisTimeZone,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});
export function parisDay(instant: number): string {
  const parts = parisClock.formatToParts(instant);
  const part = (name: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === name)?.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

function parisWallClock(instant: number): string {
  const values = new Map(parisClock.formatToParts(instant).map((part) => [part.type, part.value]));
  return `${values.get('year')}-${values.get('month')}-${values.get('day')}T${values.get('hour')}:${
    values.get('minute')
  }:${values.get('second')}`;
}

/** Gaps and overlaps at DST transitions need a source with an explicit offset. */
export function parisInstant(day: string, time: unknown): string | undefined {
  if (!validDate(day) || typeof time !== 'string' || !/^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(time)) return;
  const local = `${day}T${time.length === 5 ? `${time}:00` : time}`;
  const utc = Date.parse(`${local}Z`);
  const candidates = new Set<number>();
  for (const probe of [utc - 43_200_000, utc + 43_200_000]) {
    const offset = Date.parse(`${parisWallClock(probe)}Z`) - probe;
    const instant = utc - offset;
    if (parisWallClock(instant) === local) candidates.add(instant);
  }
  const match = candidates.values().next().value;
  return candidates.size === 1 && match !== undefined ? new Date(match).toISOString() : undefined;
}

function instantOn(value: unknown, day: string, end = false): value is string {
  if (
    typeof value !== 'string' || !validDate(value.slice(0, 10)) ||
    !/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,3})?(?:Z|[+-](?:0\d|1[0-4]):[0-5]\d)$/.test(value)
  ) return false;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) &&
    (parisDay(parsed) === day || (end && parsed === Date.parse(parisInstant(addDiscoveryDays(day, 1), '00:00') ?? '')));
}

function validSchedule(value: unknown): value is DiscoverySchedule {
  const { day, lastDay, startAt, endAt, timeZone } = asObject(value);
  return timeZone === parisTimeZone && validDate(day) &&
    (lastDay === undefined || (validDate(lastDay) && lastDay >= day)) &&
    (startAt === undefined || instantOn(startAt, day)) &&
    (endAt === undefined ||
      (typeof startAt === 'string' && instantOn(endAt, (lastDay as string | undefined) ?? day, true) &&
        Date.parse(endAt) > Date.parse(startAt)));
}

export function validPoint(value: unknown): value is DiscoveryPoint {
  const point = asObject(value);
  return numberIn(point.latitude, -90, 90) && numberIn(point.longitude, -180, 180);
}

export function isDatedKind(kind: DiscoveryKind): boolean {
  return kind === 'race' || kind === 'club_run' || kind === 'training';
}

function validSource(value: unknown): value is DiscoverySource {
  const source = asObject(value);
  return member(source.kind, sourceKinds) && publicHttps(source.url) && cleanText(source.name, 140) &&
    validDate(source.checkedOn) && maybe(source.license, (v) => cleanText(v, 140)) &&
    maybe(source.externalId, (v) => cleanText(v, 120));
}

function validTrack(value: unknown): value is DiscoveryTrack {
  const { segments, sourceUrl, license, credit } = asObject(value);
  if (
    !publicHttps(sourceUrl) || !cleanText(credit, 200) ||
    !member(license, ['CC0-1.0', 'CC-BY-3.0', 'CC-BY-SA-3.0', 'CC-BY-4.0', 'CC-BY-SA-4.0', 'LO-2.0'] as const) ||
    !Array.isArray(segments) || !segments.length || segments.length > 32
  ) return false;
  let points = 0;
  for (const segment of segments) {
    if (
      !Array.isArray(segment) || segment.length < 3 || (points += segment.length) > 4000 || !segment.every(validPoint)
    ) return false;
    const distinct = new Set(segment.map((p: DiscoveryPoint) => `${p.latitude},${p.longitude}`));
    if (distinct.size < 3) return false;
  }
  return true;
}

/** Validation at the trust boundary for the bundle, the local cache and remote revisions. */
export function readDiscoveryItem(value: unknown): DiscoveryItem | null {
  const row = asObject(value);
  const { kind, state, sources, schedule, registration, price } = row;
  if (
    !discoveryId(row.id) || !discoveryId(row.market) || !member(kind, discoveryKinds) ||
    !member(state, visibleStates) ||
    !cleanText(row.countryCode, 2) || !/^[A-Z]{2}$/.test(row.countryCode) ||
    !cleanText(row.title, 120) || !cleanText(row.summary, 500) || !cleanText(row.city, 100) ||
    !publicHttps(row.officialUrl) ||
    !Array.isArray(sources) || !sources.length || sources.length > 6 || !sources.every(validSource)
  ) return null;

  if (isDatedKind(kind)) {
    if (schedule !== undefined ? !validSchedule(schedule) : kind !== 'race' || !cleanText(row.dateNote, 100)) {
      return null;
    }
  } else if (schedule !== undefined || row.dateNote !== undefined) return null;
  if (row.clubId !== undefined && ((kind !== 'club_run' && kind !== 'training') || !discoveryId(row.clubId))) {
    return null;
  }
  if (
    !maybe(row.dateNote, (v) => cleanText(v, 100)) || !maybe(row.reviewBy, validDate) ||
    !maybe(row.point, validPoint) ||
    !maybe(row.terrain, (v) => member(v, terrains)) || !maybe(row.mediaKey, discoveryId) ||
    ![row.venue, row.address, row.setting, row.organizer].every((v) => maybe(v, (s) => cleanText(s, 180))) ||
    ![row.beginner, row.accessible, row.featured].every((v) => maybe(v, (b) => typeof b === 'boolean')) ||
    !maybe(row.elevationGainM, (v) => numberIn(v, 0, 30000)) ||
    !maybe(row.distancesKm, (v) =>
      Array.isArray(v) && v.length > 0 && v.length <= 8 &&
      v.every((km) => numberIn(km, 0.1, 1000)) && new Set(v).size === v.length) ||
    !maybe(
      row.facts,
      (v) =>
        Array.isArray(v) && v.length <= 10 &&
        v.every((f) => cleanText(asObject(f).label, 60) && cleanText(asObject(f).text, 500)),
    ) ||
    (row.track !== undefined && (kind !== 'route' || !validTrack(row.track)))
  ) return null;

  if (registration !== undefined) {
    const reg = asObject(registration);
    if (
      !isDatedKind(kind) || !member(reg.state, registrationStates) || !validDate(reg.checkedOn) ||
      !maybe(reg.url, publicHttps)
    ) return null;
  }
  if (price !== undefined) {
    const fee = asObject(price);
    if (!numberIn(fee.cents, 0, 1_000_000) || !Number.isInteger(fee.cents) || !validDate(fee.checkedOn)) return null;
  }

  // The public contract never forwards raw provider properties or unreviewed media URLs.
  const fields = [
    'id',
    'kind',
    'state',
    'market',
    'countryCode',
    'title',
    'summary',
    'city',
    'officialUrl',
    'sources',
    'schedule',
    'dateNote',
    'reviewBy',
    'point',
    'venue',
    'address',
    'terrain',
    'setting',
    'distancesKm',
    'elevationGainM',
    'organizer',
    'clubId',
    'beginner',
    'accessible',
    'registration',
    'price',
    'facts',
    'mediaKey',
    'track',
    'featured',
  ];
  return Object.fromEntries(
    fields.filter((field) => row[field] !== undefined).map((field) => [field, row[field]]),
  ) as unknown as DiscoveryItem;
}
