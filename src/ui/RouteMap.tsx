import { useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { TrackPoint } from '../core/types';
import { Copy, Icon } from './components';
import { useTheme } from './theme';
import { radii } from './tokens';
import type { RouteCoordinate } from '../routes/types';

export default function RouteMap({ points, reference = [], current, height = 220, interactive = false }: { points: TrackPoint[]; reference?: RouteCoordinate[][]; current?: RouteCoordinate; height?: number; interactive?: boolean }) {
  const { colors } = useTheme(); const ref = useRef<MapView>(null);
  const [ready, setReady] = useState(false);
  const groups = useMemo(() => {
    const result = new Map<number, { latitude: number; longitude: number }[]>();
    const step = Math.max(1, Math.ceil(points.length / 1500));
    for (const [index, point] of points.entries()) {
      // Only the map preview is simplified; the complete GPS route remains in storage.
      if (index % step !== 0 && index !== points.length - 1 && point.segment === points[index - 1]?.segment && point.segment === points[index + 1]?.segment) continue;
      const group = result.get(point.segment) ?? []; group.push({ latitude: point.fix.latitude, longitude: point.fix.longitude }); result.set(point.segment, group);
    }
    return [...result.values()];
  }, [points, points.length]);
  const guides = useMemo(() => {
    const step = Math.max(1, Math.ceil(reference.reduce((n, s) => n + s.length, 0) / 1500));
    return reference.map(segment => segment.filter((_, i) => i === 0 || i === segment.length - 1 || i % step === 0));
  }, [reference]);
  const routeCoordinates = guides.flat(), recorded = groups.flat();
  const coordinates = [...routeCoordinates, ...recorded]; const first = routeCoordinates[0] ?? recorded[0], last = routeCoordinates.at(-1) ?? recorded.at(-1);
  const bucket = Math.floor(points.length / 10);
  useEffect(() => {
    if (ready && !interactive && coordinates.length > 1) ref.current?.fitToCoordinates(coordinates, { edgePadding: { top: 42, right: 35, bottom: 35, left: 35 }, animated: false });
  }, [ready, interactive, bucket]);
  if (!first) return <View style={{ height, borderRadius: radii.card, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
    <Icon name="map-outline" color={colors.secondary} size={28} /><Copy muted>Aucun point GPS enregistré.</Copy></View>;
  return <View accessibilityLabel={`Parcours enregistré : ${points.length} points. Référence : ${reference.reduce((n, s) => n + s.length, 0)} points et ${reference.length} segments.`} style={{ height, borderRadius: radii.card, overflow: 'hidden' }}>
    <MapView ref={ref} style={{ flex: 1 }} userInterfaceStyle={colors.dark ? 'dark' : 'light'}
      initialRegion={{ ...first, latitudeDelta: .008, longitudeDelta: .008 }}
      onMapReady={() => { setReady(true); if (coordinates.length > 1) ref.current?.fitToCoordinates(coordinates, { edgePadding: { top: 42, right: 35, bottom: 35, left: 35 }, animated: false }); }}
      scrollEnabled={interactive} zoomEnabled={interactive} rotateEnabled={false} pitchEnabled={false} toolbarEnabled={false}>
      {groups.filter(g => g.length > 1).map((group, index) => <Polyline key={index} coordinates={group} strokeWidth={5} strokeColor={colors.accentText} />)}
      {guides.filter(g => g.length > 1).map((group, index) => <Polyline key={`guide:${index}`} coordinates={group} strokeWidth={3} strokeColor={colors.routeReference} />)}
      <Marker coordinate={first} title={reference.length ? 'Début du tracé visible' : 'Départ'} pinColor={colors.routeStart} />
      {last && coordinates.length > 1 && <Marker coordinate={last} title={reference.length ? 'Fin du tracé visible' : 'Arrivée'} pinColor={colors.routeFinish} />}
      {current && <Marker coordinate={current} title="Dernière position GPS précise" pinColor={colors.routePosition} />}
    </MapView>
  </View>;
}
