import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { Copy } from './components';
import { MapPlaceholder } from './MapPlaceholder';
import {
  EMPTY_REFERENCE,
  RecordedTrack,
  paceZoneColor,
  referenceSegments,
  type RouteMapProps,
} from './routeMapData';
import { useTheme } from './theme';
import { mapPositionHalo, radii } from './tokens';

const edgePadding = { top: 60, right: 48, bottom: 52, left: 48 };
const localRegion = { latitudeDelta: 0.007, longitudeDelta: 0.007 };

function PositionMarker({
  position,
  color,
}: {
  position: NonNullable<RouteMapProps['current']>;
  color: string;
}) {
  const [tracksViewChanges, setTracksViewChanges] = useState(true);
  return (
    <Marker
      coordinate={position}
      title="Position GPS"
      tracksViewChanges={tracksViewChanges}
      anchor={{ x: 0.5, y: 0.5 }}
      centerOffset={{ x: 0, y: 0 }}
    >
      <View
        style={[styles.position, { backgroundColor: color }]}
        onLayout={() => setTracksViewChanges(false)}
      />
    </Marker>
  );
}

const MapSurface = memo(function MapSurface({
  points,
  paceParts,
  reference = EMPTY_REFERENCE,
  current,
  selected,
  initialPosition,
  height = 220,
  interactive = false,
  live = false,
  follow = false,
  satellite = false,
  command,
  onPan,
  pointCount,
}: RouteMapProps & { pointCount: number }) {
  const { colors, reduceMotion } = useTheme();
  const map = useRef<MapView>(null);
  const [ready, setReady] = useState(false);
  const [laidOut, setLaidOut] = useState(false);
  const followedPosition = useRef<RouteMapProps['current']>(undefined);
  const handledCommand = useRef(0);
  const lastFitBucket = useRef(-1);
  const [track] = useState(() => new RecordedTrack());
  const groups = useMemo(() => track.update(points, pointCount), [track, points, pointCount]);
  const guides = useMemo(() => referenceSegments(reference), [reference]);
  const recorded = useMemo(() => groups.flat(), [groups]);
  const guidance = useMemo(() => guides.flat(), [guides]);
  const route = recorded.length > 0 ? recorded : guidance;
  const visibleRoute = useMemo(
    () => (live ? route : [...guidance, ...recorded]),
    [live, route, guidance, recorded],
  );
  const anchor = (live ? current : undefined) ?? route[0] ?? current ?? initialPosition;
  const latest = current ?? recorded.at(-1);
  const readyForCamera = ready && laidOut;
  const fitBucket = live || interactive ? 0 : Math.floor(pointCount / 10);

  useEffect(() => {
    if (!readyForCamera || lastFitBucket.current === fitBucket) return;
    if (!live && visibleRoute.length < 2) return;
    lastFitBucket.current = fitBucket;
    if ((!live || !current) && visibleRoute.length > 1) {
      map.current?.fitToCoordinates(visibleRoute, { edgePadding, animated: false });
    }
  }, [readyForCamera, live, current, visibleRoute, fitBucket]);

  useEffect(() => {
    if (!readyForCamera || !command || handledCommand.current === command.revision) return;
    if (command.kind === 'route' && route.length > 1) {
      map.current?.fitToCoordinates(route, { edgePadding, animated: !reduceMotion });
    } else {
      const center = command.kind === 'route' ? route[0] : latest;
      if (!center) return;
      map.current?.animateToRegion({ ...center, ...localRegion }, reduceMotion ? 0 : 240);
    }
    handledCommand.current = command.revision;
    followedPosition.current = current;
  }, [readyForCamera, command, route, latest, current, reduceMotion]);

  useEffect(() => {
    if (!readyForCamera || !follow || !current || followedPosition.current === current) return;
    followedPosition.current = current;
    // Updating the center preserves the zoom selected by the runner.
    map.current?.animateCamera({ center: current }, { duration: reduceMotion ? 0 : 240 });
  }, [readyForCamera, follow, current, reduceMotion]);

  return (
    <View
      accessibilityLabel={live ? undefined : 'Tracé GPS du parcours'}
      onLayout={(event) => setLaidOut(event.nativeEvent.layout.height > 0)}
      style={[height === 'fill' ? styles.fill : { height, borderRadius: radii.card }, styles.clipped]}
    >
      {anchor ? (
        <MapView
          ref={map}
          style={StyleSheet.absoluteFill}
          initialRegion={{ ...anchor, ...localRegion }}
          mapType={satellite ? 'satellite' : 'standard'}
          userInterfaceStyle={colors.dark ? 'dark' : 'light'}
          onMapReady={() => setReady(true)}
          onPanDrag={interactive ? onPan : undefined}
          scrollEnabled={interactive}
          zoomEnabled={interactive}
          rotateEnabled={false}
          pitchEnabled={false}
          toolbarEnabled={false}
          showsCompass={false}
        >
          {guides.map(
            (group, index) =>
              group.length > 1 && (
                <Polyline
                  key={'reference-' + index}
                  coordinates={group}
                  strokeWidth={3}
                  strokeColor={colors.routeReference}
                />
              ),
          )}
          {paceParts?.length
            ? paceParts.map(({ points: part, zone }, index) => (
                <Polyline
                  key={index}
                  coordinates={part}
                  strokeWidth={5}
                  strokeColor={paceZoneColor(zone, colors)}
                  lineCap="round"
                  lineJoin="round"
                />
              ))
            : groups.map(
                (group, index) =>
                  group.length > 1 && (
                    <Polyline
                      key={index}
                      coordinates={group}
                      strokeWidth={5}
                      strokeColor={colors.text}
                      lineCap="round"
                      lineJoin="round"
                    />
                  ),
              )}
          {(!live || recorded.length > 1) && route[0] && (
            <Marker coordinate={route[0]} title="Départ" pinColor={colors.routeStart} />
          )}
          {!live && route.length > 1 && (
            <Marker coordinate={route.at(-1)!} title="Arrivée" pinColor={colors.routeFinish} />
          )}
          {selected && <Marker coordinate={selected} title="Mesure sélectionnée" pinColor={colors.accent} />}
          {current && (
            <PositionMarker key={colors.routePosition} position={current} color={colors.routePosition} />
          )}
        </MapView>
      ) : (
        <>
          <MapPlaceholder />
          {!live && (
            <Copy muted style={styles.caption}>
              Aucun tracé GPS disponible.
            </Copy>
          )}
        </>
      )}
    </View>
  );
});

export default function RouteMap(props: RouteMapProps) {
  // The engine mutates the array in place, so capture the length as a separate render prop.
  return <MapSurface {...props} pointCount={props.points.length} />;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  clipped: { overflow: 'hidden' },
  position: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 3,
    borderColor: mapPositionHalo,
  },
  caption: { position: 'absolute', bottom: 12, left: 14, right: 14, textAlign: 'center' },
});
