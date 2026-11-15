import {
  catalogVersion,
  readDiscoveryItem,
  terrains,
  validDate,
  type DiscoveryItem,
} from '../../supabase/functions/_shared/discovery-model';
import {
  categories,
  defaultFilters,
  raceDistances,
  radiuses,
  sectors,
  type DiscoveryFilters,
  type Radius,
  type SectorId,
} from './catalog';
import type { KeyValueStore } from '../account/kvStore';

export interface DiscoverySave {
  item: DiscoveryItem;
  favorite: boolean;
  goal?: { addedOn: string; distanceKm: number };
}
export interface DiscoveryPreferences {
  version: 1;
  sector: SectorId;
  radius: Radius;
  filters: DiscoveryFilters;
  saves: DiscoverySave[];
}
export const maxSaves = 150;
export const emptyPreferences = (): DiscoveryPreferences => ({
  version: catalogVersion,
  sector: 'nice',
  radius: 25,
  filters: { ...defaultFilters },
  saves: [],
});
export const discoveryUserKey = (id: string) => `discovery:v1:user:${id}`;

export function readPreferences(raw: string | null): DiscoveryPreferences {
  if (raw === null) return emptyPreferences();
  if (raw.length > 6_000_000) throw new Error('Préférences de découverte trop volumineuses.');
  const data = JSON.parse(raw) as Partial<DiscoveryPreferences> | null;
  const errors = () => new Error('Préférences de découverte illisibles.');
  const filters = data?.filters;
  if (
    !data ||
    data.version !== catalogVersion ||
    !sectors.some((s) => s.id === data.sector) ||
    !radiuses.some((r) => r === data.radius) ||
    !filters ||
    (filters.distanceKm !== null && !raceDistances.includes(filters.distanceKm)) ||
    (filters.terrain !== null && !terrains.includes(filters.terrain)) ||
    (filters.category !== null && !categories.some(([kind]) => kind === filters.category)) ||
    (['beginner', 'free', 'accessible', 'registrationOpen', 'proximity'] as const).some(
      (key) => typeof filters[key] !== 'boolean',
    ) ||
    !Array.isArray(data.saves) ||
    data.saves.length > maxSaves
  )
    throw errors();
  const ids = new Set<string>();
  const saves = data.saves.map((save) => {
    const item = readDiscoveryItem(save?.item);
    if (
      !item ||
      ids.has(item.id) ||
      typeof save.favorite !== 'boolean' ||
      (save.goal !== undefined &&
        (!validDate(save.goal?.addedOn) || !item.distancesKm?.includes(save.goal.distanceKm))) ||
      (!save.favorite && !save.goal)
    )
      throw errors();
    ids.add(item.id);
    return { item, favorite: save.favorite, ...(save.goal ? { goal: save.goal } : {}) };
  });
  return { version: catalogVersion, sector: data.sector!, radius: data.radius!, filters, saves };
}

type SaveChange = { favorite: boolean } | { goal: DiscoverySave['goal'] };
export function updateSaved(
  data: DiscoveryPreferences,
  item: DiscoveryItem,
  change: SaveChange,
): DiscoveryPreferences {
  const previous = data.saves.find((save) => save.item.id === item.id);
  // A bookmarked copy keeps provenance/date but avoids storing large route geometry per account.
  const snapshot = { ...item, track: undefined };
  const next = { favorite: false, ...previous, ...change, item: snapshot };
  if (next.goal && !snapshot.distancesKm?.includes(next.goal.distanceKm)) next.goal = undefined;
  const saves = data.saves.filter((save) => save.item.id !== item.id);
  if (next.favorite || next.goal) saves.unshift(next);
  if (saves.length > maxSaves) throw new Error(`Tu peux enregistrer jusqu’à ${maxSaves} fiches.`);
  return { ...data, saves };
}

/** One serialized lane per account for save mutations and deletion. */
export function discoveryPreferenceStore(kv: KeyValueStore) {
  const lanes = new Map<string, Promise<unknown>>();
  function queue<T>(id: string, change: () => Promise<T>): Promise<T> {
    const previous = lanes.get(id) ?? Promise.resolve();
    const pending = previous.catch(() => undefined).then(change);
    lanes.set(id, pending);
    const settled = () => {
      if (lanes.get(id) === pending) lanes.delete(id);
    };
    void pending.then(settled, settled);
    return pending;
  }
  return {
    load: (id: string) => queue(id, async () => readPreferences(await kv.get(discoveryUserKey(id)))),
    change: (id: string, apply: (old: DiscoveryPreferences) => DiscoveryPreferences) =>
      queue(id, async () => {
        const key = discoveryUserKey(id);
        const updated = apply(readPreferences(await kv.get(key)));
        await kv.set(key, JSON.stringify(updated));
        return updated;
      }),
    forget: (id: string) => queue(id, () => kv.remove(discoveryUserKey(id))),
  };
}
