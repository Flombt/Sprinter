import type { DiscoveryItem } from '../../supabase/functions/_shared/discovery-model';
import type { IconName } from '../ui/components';
import type { DiscoveryRegion, MapCluster } from './mapModel';

export const itemIcon = {
  race: 'flag-outline',
  club: 'people-outline',
  club_run: 'walk-outline',
  training: 'stopwatch-outline',
  place: 'location-outline',
  route: 'trail-sign-outline',
} as const satisfies Record<DiscoveryItem['kind'], IconName>;

export interface MapCanvasProps {
  region: DiscoveryRegion;
  camera: DiscoveryRegion;
  width: number;
  height: number;
  clusters: MapCluster[];
  onMove: (region: DiscoveryRegion) => void;
  onSelect: (cluster: MapCluster) => void;
}

export function markerLabel(cluster: MapCluster) {
  return cluster.items.length === 1
    ? (cluster.items[0]?.title ?? 'Repère')
    : `${cluster.items.length} fiches à cet endroit`;
}
