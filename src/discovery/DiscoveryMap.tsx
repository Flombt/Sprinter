import { useCallback, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import {
  discoveryKinds,
  type DiscoveryItem,
  type DiscoveryPoint,
} from '../../supabase/functions/_shared/discovery-model';
import { Button, Copy, Icon, EmptyState } from '../ui/components';
import { useTheme } from '../ui/theme';
import { radii, spacing } from '../ui/tokens';
import { Chip, ChipRow, ResultRow } from './components';
import { kindTitle, sectors } from './catalog';
import { MapBackdrop } from './MapBackdrop';
import MapCanvas from './MapCanvas';
import OfflineMap from './OfflineMap';
import {
  mapClusters,
  inRegion,
  regionAround,
  zoomRegion,
  type DiscoveryRegion,
  type MapCluster,
} from './mapModel';

export function DiscoveryMap({
  items,
  center,
  onOpen,
  offline,
}: {
  items: DiscoveryItem[];
  center: DiscoveryPoint;
  onOpen: (id: string) => void;
  offline: boolean;
}) {
  const { colors } = useTheme();
  const initial = useMemo(() => regionAround(center, 11), [center]);
  const [region, setRegion] = useState(initial);
  const [camera, setCamera] = useState(initial);
  const [area, setArea] = useState<DiscoveryRegion>();
  const [kind, setKind] = useState<DiscoveryItem['kind'] | 'all'>('all');
  const [selection, setSelection] = useState<string[]>([]);
  const [width, setWidth] = useState(320);
  const [limit, setLimit] = useState(10);
  const height = 350;
  const matching = useMemo(
    () => items.filter((item) => (kind === 'all' || item.kind === kind) && item.point),
    [items, kind],
  );
  const clusters = useMemo(() => mapClusters(matching, region, width, height), [matching, region, width]);
  const listed = selection.length
    ? matching.filter((item) => selection.includes(item.id))
    : matching.filter((item) => item.point && inRegion(item.point, area ?? region));
  const move = useCallback((next: DiscoveryRegion) => {
    setSelection([]);
    setRegion(next);
  }, []);
  const navigate = (next: DiscoveryRegion) => {
    move(next);
    setCamera(next);
  };
  const select = (cluster: MapCluster) => {
    const first = cluster.items[0];
    if (first && cluster.items.length === 1) onOpen(first.id);
    else {
      setSelection(cluster.items.map((item) => item.id));
      setLimit(10);
    }
  };
  const Canvas = offline ? OfflineMap : MapCanvas;

  return (
    <View style={{ gap: spacing.lg }}>
      <ChipRow label="Catégories de la carte">
        <Chip
          title="Tous"
          selected={kind === 'all'}
          onPress={() => {
            setKind('all');
            setSelection([]);
          }}
        />
        {discoveryKinds
          .filter((key) => items.some((item) => item.kind === key && item.point))
          .map((key) => (
            <Chip
              key={key}
              title={kindTitle[key]}
              selected={kind === key}
              onPress={() => {
                setKind(key);
                setSelection([]);
              }}
            />
          ))}
      </ChipRow>
      <View
        style={{ height, borderRadius: radii.hero, backgroundColor: colors.field, overflow: 'hidden' }}
        onLayout={(event) => setWidth(Math.max(1, event.nativeEvent.layout.width))}
      >
        <Canvas
          region={region}
          camera={camera}
          width={width}
          height={height}
          clusters={clusters}
          onMove={move}
          onSelect={select}
        />
      </View>
      {!!selection.length && (
        <Copy variant="caption" accessibilityLiveRegion="polite">
          {selection.length} fiches à ce repère. Consulte la liste sous la carte.
        </Copy>
      )}
      <ChipRow label="Commandes de la carte">
        <Chip
          title="Recentrer"
          icon="locate-outline"
          onPress={() => {
            setArea(undefined);
            navigate(initial);
          }}
        />
        <Chip
          title="Zoom +"
          accessibilityLabel="Agrandir la carte"
          onPress={() => navigate(zoomRegion(region, 0.5))}
        />
        <Chip
          title="Zoom −"
          accessibilityLabel="Réduire le zoom de la carte"
          onPress={() => navigate(zoomRegion(region, 2))}
        />
      </ChipRow>
      <Button
        title="Rechercher dans cette zone"
        icon="search-outline"
        secondary
        onPress={() => {
          setArea(region);
          setSelection([]);
          setLimit(10);
        }}
      />
      <Copy variant="emphasis" accessibilityRole="header" accessibilityLiveRegion="polite">
        {selection.length
          ? 'Fiches regroupées'
          : `${listed.length} ${listed.length === 1 ? 'fiche' : 'fiches'} dans la zone${area ? ' recherchée' : ''}`}
      </Copy>
      {!listed.length && (
        <EmptyState
          icon="map-outline"
          title="Aucun repère ici"
          body="Déplace la carte ou élargis le zoom. Les fiches sans coordonnées sont accessibles via la recherche."
        />
      )}
      {listed.slice(0, limit).map((item) => (
        <ResultRow key={item.id} item={item} onPress={() => onOpen(item.id)} />
      ))}
      {listed.length > limit && (
        <Button title="Voir plus de fiches" variant="secondary" onPress={() => setLimit(limit + 10)} />
      )}
    </View>
  );
}

const overviewRegion = regionAround(sectors[0], 12);
export function MapOverview({ onPress, location }: { onPress: () => void; location?: DiscoveryPoint }) {
  const { colors } = useTheme();
  const [width, setWidth] = useState(320);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        location ? 'Ouvrir l’itinéraire vers ce repère' : 'Ouvrir la carte des lieux et des courses'
      }
      onPress={onPress}
      onLayout={(event) => setWidth(Math.max(1, event.nativeEvent.layout.width))}
      style={({ pressed }) => ({
        height: 126,
        borderRadius: radii.hero,
        overflow: 'hidden',
        justifyContent: 'flex-end',
        padding: spacing.md,
        opacity: pressed ? 0.8 : 1,
      })}
    >
      <MapBackdrop
        region={location ? regionAround(location, 3) : overviewRegion}
        width={width}
        height={126}
        captions
      />
      {location && (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: width / 2 - 15,
            top: 40,
            borderRadius: radii.pill,
            padding: 6,
            backgroundColor: colors.surface,
          }}
        >
          <Icon name="location" size={19} color={colors.accentText} />
        </View>
      )}
      <View
        style={{
          alignSelf: 'flex-start',
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          backgroundColor: colors.surface,
          paddingVertical: spacing.sm,
          paddingHorizontal: spacing.md,
          borderRadius: radii.pill,
        }}
      >
        <Icon name="map-outline" color={colors.accentText} size={18} />
        <Copy variant="emphasis">{location ? 'Itinéraire' : 'Ouvrir la carte'}</Copy>
        <Icon name="arrow-forward" color={colors.secondary} size={17} />
      </View>
    </Pressable>
  );
}
