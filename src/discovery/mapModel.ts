import type { DiscoveryItem, DiscoveryPoint } from '../../supabase/functions/_shared/discovery-model';

export interface DiscoveryRegion extends DiscoveryPoint {
  latitudeDelta: number;
  longitudeDelta: number;
}
export interface MapCluster {
  id: string;
  point: DiscoveryPoint;
  items: DiscoveryItem[];
}

export function regionAround(point: DiscoveryPoint, radiusKm: number): DiscoveryRegion {
  const delta = Math.max(0.019, radiusKm / 80);
  return {
    latitude: point.latitude,
    longitude: point.longitude,
    latitudeDelta: delta,
    longitudeDelta: delta * 1.45,
  };
}

export function locateOnMap(point: DiscoveryPoint, region: DiscoveryRegion) {
  return {
    x: (point.longitude - region.longitude) / region.longitudeDelta + 0.5,
    y: (region.latitude - point.latitude) / region.latitudeDelta + 0.5,
  };
}

export function inRegion(point: DiscoveryPoint, region: DiscoveryRegion): boolean {
  const { x, y } = locateOnMap(point, region);
  return x >= 0 && x <= 1 && y >= 0 && y <= 1;
}

export function mapClusters(
  items: readonly DiscoveryItem[],
  region: DiscoveryRegion,
  width: number,
  height: number,
): MapCluster[] {
  const buckets = new Map<string, { item: DiscoveryItem; point: DiscoveryPoint }[]>();
  for (const item of items) {
    const point = item.point;
    if (!point || !inRegion(point, region)) continue;
    const { x, y } = locateOnMap(point, region);
    const key = `${Math.floor((x * width) / 52)}:${Math.floor((y * height) / 52)}`;
    const bucket = buckets.get(key) ?? [];
    bucket.push({ item, point });
    buckets.set(key, bucket);
  }
  return [...buckets.values()].map((matches) => ({
    id: matches.map(({ item }) => item.id).join(':'),
    point: {
      latitude: matches.reduce((total, { point }) => total + point.latitude, 0) / matches.length,
      longitude: matches.reduce((total, { point }) => total + point.longitude, 0) / matches.length,
    },
    items: matches.map(({ item }) => item),
  }));
}

export function zoomRegion(region: DiscoveryRegion, ratio: number): DiscoveryRegion {
  const next = Math.min(4, Math.max(0.0015, region.latitudeDelta * ratio));
  return {
    ...region,
    latitudeDelta: next,
    longitudeDelta: (next * region.longitudeDelta) / region.latitudeDelta,
  };
}
