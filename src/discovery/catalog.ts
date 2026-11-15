import {
  addDiscoveryDays,
  isDatedKind,
  parisDay,
  validDate,
  type DiscoveryItem,
  type DiscoveryPoint,
  type Terrain,
} from '../../supabase/functions/_shared/discovery-model';
import { distance } from '../core/geo';

export const market = { id: 'nice', name: 'Nice', region: 'Côte d’Azur', countryCode: 'FR' } as const;
export const sectors = [
  { id: 'nice', name: 'Nice', latitude: 43.7009, longitude: 7.2684 },
  { id: 'cagnes', name: 'Cagnes-sur-Mer', latitude: 43.6646, longitude: 7.1491 },
  { id: 'villefranche', name: 'Villefranche-sur-Mer', latitude: 43.7035, longitude: 7.3104 },
  { id: 'vence', name: 'Vence', latitude: 43.7222, longitude: 7.1136 },
] as const;
export type SectorId = (typeof sectors)[number]['id'];
export const getSector = (id: SectorId) => sectors.find((sector) => sector.id === id) ?? sectors[0];
export const radiuses = [5, 10, 25, 50, 100] as const;
export type Radius = (typeof radiuses)[number];
export const raceDistances = [5, 10, 21.1, 42.195] as const;
export const categories = [
  ['race', 'Courses'],
  ['group', 'Sorties et séances'],
  ['club', 'Clubs'],
  ['spots', 'Lieux et parcours'],
] as const;
export type Period = 'all' | 'today' | 'weekend' | 'week' | 'month' | 'custom';

export interface DiscoveryFilters {
  distanceKm: (typeof raceDistances)[number] | null;
  terrain: Terrain | null;
  category: (typeof categories)[number][0] | null;
  beginner: boolean;
  free: boolean;
  accessible: boolean;
  registrationOpen: boolean;
  proximity: boolean;
}
export const defaultFilters: DiscoveryFilters = {
  distanceKm: null,
  terrain: null,
  category: null,
  beginner: false,
  free: false,
  accessible: false,
  registrationOpen: false,
  proximity: false,
};
export const isGroup = ({ kind }: DiscoveryItem) => kind === 'club_run' || kind === 'training';
export const isSpot = ({ kind }: DiscoveryItem) => kind === 'place' || kind === 'route';
export interface DateWindow {
  from: string;
  through: string;
}

export function dateWindow(period: Period, today: string, custom?: DateWindow): DateWindow | undefined {
  switch (period) {
    case 'all':
      return;
    case 'custom':
      return custom;
    case 'today':
      return { from: today, through: today };
    case 'week':
      return { from: today, through: addDiscoveryDays(today, 6) };
    case 'month':
      return { from: today, through: addDiscoveryDays(today, 29) };
    case 'weekend': {
      const dayOfWeek = new Date(`${today}T12:00:00Z`).getUTCDay();
      const saturday = addDiscoveryDays(today, dayOfWeek === 0 ? -1 : 6 - dayOfWeek);
      return { from: dayOfWeek === 0 ? today : saturday, through: addDiscoveryDays(saturday, 1) };
    }
  }
}

export function parseDateWindow(from: string, through: string): DateWindow | undefined {
  if (validDate(from) && validDate(through) && through >= from) return { from, through };
}

export function remaining(item: DiscoveryItem, now: number, today = parisDay(now)): boolean {
  const { schedule, reviewBy, state } = item;
  if (!schedule || state !== 'published' || (reviewBy && reviewBy < today)) return false;
  return schedule.endAt ? Date.parse(schedule.endAt) > now : (schedule.lastDay ?? schedule.day) >= today;
}

export function visibleInBrowse(item: DiscoveryItem, now: number, today = parisDay(now)): boolean {
  if (!isDatedKind(item.kind)) return item.state === 'published' || item.state === 'stale';
  if (item.schedule) return remaining(item, now, today);
  return item.state === 'published' && !!item.dateNote && (!item.reviewBy || item.reviewBy >= today);
}

export const normalizeSearch = (text: string) =>
  text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

export const terrainTitle = {
  road: 'Route',
  trail: 'Trail',
  track: 'Piste',
  mixed: 'Terrain mixte',
} as const;
export const kindTitle = {
  race: 'Course',
  club_run: 'Sortie collective',
  training: 'Séance',
  club: 'Club',
  place: 'Lieu',
  route: 'Parcours',
} as const;

export function checkedRecently(day: string, today: string, maxDays: number): boolean {
  return day <= today && addDiscoveryDays(day, maxDays) >= today;
}
export function verifiedPrice(item: DiscoveryItem, today: string): number | undefined {
  const days = isDatedKind(item.kind) ? 7 : 90;
  return item.price && checkedRecently(item.price.checkedOn, today, days) ? item.price.cents : undefined;
}
export function verifiedRegistration(item: DiscoveryItem, now: number, today: string) {
  return remaining(item, now, today) &&
    item.registration &&
    checkedRecently(item.registration.checkedOn, today, 7)
    ? item.registration
    : undefined;
}

export function distanceKm(point: DiscoveryPoint, origin: DiscoveryPoint): number {
  return distance(point, origin) / 1000;
}

export function filterCatalogue(
  items: readonly DiscoveryItem[],
  options: {
    filters: DiscoveryFilters;
    query: string;
    sector: SectorId;
    radius: Radius;
    position?: DiscoveryPoint;
    window?: DateWindow;
    now: number;
  },
): DiscoveryItem[] {
  const { filters, sector, radius, position, window, now } = options;
  const today = parisDay(now);
  const origin = position ?? getSector(sector);
  const words = normalizeSearch(options.query).split(' ').filter(Boolean);
  return items
    .flatMap((item) => {
      if (!visibleInBrowse(item, now, today)) return [];
      const approximate = [
        ...sectors,
        { name: 'Saint-Jean-Cap-Ferrat', latitude: 43.688188, longitude: 7.333971 },
      ].find((s) => normalizeSearch(s.name) === normalizeSearch(item.city));
      const point = item.point ?? approximate;
      const km = point ? distanceKm(point, origin) : undefined;
      if (km === undefined ? !!position : km > radius) return [];
      if (
        window &&
        (!item.schedule ||
          item.schedule.day > window.through ||
          (item.schedule.lastDay ?? item.schedule.day) < window.from)
      )
        return [];
      const matchesCategory =
        filters.category === 'group'
          ? isGroup(item)
          : filters.category === 'spots'
            ? isSpot(item)
            : item.kind === filters.category;
      if (filters.category && !matchesCategory) return [];
      if (
        filters.terrain &&
        item.terrain !== filters.terrain &&
        !(filters.terrain === 'trail' && item.terrain === 'mixed')
      )
        return [];
      if (
        filters.distanceKm !== null &&
        (item.kind !== 'race' || !item.distancesKm?.some((km) => Math.abs(km - filters.distanceKm!) < 0.011))
      )
        return [];
      if (filters.beginner && item.beginner !== true) return [];
      if (filters.free && verifiedPrice(item, today) !== 0) return [];
      if (filters.accessible && item.accessible !== true) return [];
      if (filters.registrationOpen && verifiedRegistration(item, now, today)?.state !== 'open') return [];
      const searchable = normalizeSearch(
        [
          item.title,
          item.city,
          item.venue,
          item.address,
          item.organizer,
          item.setting,
          item.terrain && terrainTitle[item.terrain],
          kindTitle[item.kind],
          item.summary,
          isGroup(item) && 'footing sortie séance',
          item.terrain === 'track' && 'piste athlétisme',
          item.distancesKm?.map((km) => `${km} km`).join(' '),
        ]
          .filter(Boolean)
          .join(' '),
      );
      const compact = searchable.replace(/ /g, '');
      if (words.some((word) => !searchable.includes(word) && !compact.includes(word))) return [];
      return [{ item, km: km ?? Infinity }];
    })
    .sort((a, b) => {
      const dayA = a.item.schedule?.day ?? '~';
      const dayB = b.item.schedule?.day ?? '~';
      if (filters.proximity && a.km !== b.km) return a.km - b.km;
      const timeA = a.item.schedule?.startAt ? Date.parse(a.item.schedule.startAt) : Infinity;
      const timeB = b.item.schedule?.startAt ? Date.parse(b.item.schedule.startAt) : Infinity;
      return (
        dayA.localeCompare(dayB) ||
        (timeA === timeB ? 0 : timeA - timeB) ||
        (a.km === b.km ? 0 : a.km - b.km) ||
        a.item.title.localeCompare(b.item.title, 'fr')
      );
    })
    .map(({ item }) => item);
}

export function mergeCatalogue(
  bundle: readonly DiscoveryItem[],
  feed: ReadonlyMap<string, DiscoveryItem | null>,
) {
  const merged = new Map(bundle.map((item) => [item.id, item]));
  for (const [id, item] of feed) {
    if (item) merged.set(id, item);
    else merged.delete(id);
  }
  return [...merged.values()];
}

const dayFormat = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeZone: 'UTC' });
const shortFormat = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const timeFormat = new Intl.DateTimeFormat('fr-FR', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Europe/Paris',
});
const kmFormat = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 3 });
export const dayLabel = (day: string, short = false) =>
  (short ? shortFormat : dayFormat).format(new Date(`${day}T12:00:00Z`));
export const kmLabel = (km: number) => `${kmFormat.format(km)} km`;
export function scheduleLabel(item: DiscoveryItem, short = false): string {
  const s = item.schedule;
  if (!s) return item.dateNote ?? 'Date à confirmer';
  const end = s.lastDay && s.day !== s.lastDay ? ` au ${dayLabel(s.lastDay, short)}` : '';
  const time = !short && s.startAt ? ` · ${timeFormat.format(new Date(s.startAt))} (heure de Paris)` : '';
  return `${dayLabel(s.day, short)}${end}${time}`;
}
