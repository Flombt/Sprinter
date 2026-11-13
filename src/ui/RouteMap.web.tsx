import { memo, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import type { RouteCoordinate } from '../routes/types';
import { Copy } from './components';
import { MapPlaceholder } from './MapPlaceholder';
import { paceZones } from '../analysis/paceRoute';
import {
  EMPTY_REFERENCE,
  RecordedTrack,
  paceZoneColor,
  referenceSegments,
  type RouteMapProps,
} from './routeMapData';
import { useTheme } from './theme';
import { mapPositionHalo, radii, typography } from './tokens';

const MapSurface = memo(function MapSurface({
  points,
  paceParts,
  reference = EMPTY_REFERENCE,
  current,
  selected,
  height = 220,
  live = false,
  pointCount,
}: RouteMapProps & { pointCount: number }) {
  const { colors } = useTheme();
  const [size, setSize] = useState({ width: 320, height: typeof height === 'number' ? height : 240 });
  const [track] = useState(() => new RecordedTrack());
  const recorded = useMemo(() => track.update(points, pointCount), [track, points, pointCount]);
  const guides = useMemo(() => referenceSegments(reference), [reference]);
  const all = [...recorded.flat(), ...guides.flat(), ...(current ? [current] : [])];
  const { width, height: mapHeight } = size;
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const point of all) {
    minX = Math.min(minX, point.longitude);
    maxX = Math.max(maxX, point.longitude);
    minY = Math.min(minY, point.latitude);
    maxY = Math.max(maxY, point.latitude);
  }
  const longitudeScale = Math.max(0.01, Math.cos(((minY + maxY) * Math.PI) / 360));
  const scale = Math.min(
    Math.max(1, width - 64) / Math.max(0.0001, (maxX - minX) * longitudeScale),
    Math.max(1, mapHeight - 90) / Math.max(0.0001, maxY - minY),
  );
  const x = (point: RouteCoordinate) =>
    width / 2 + (point.longitude - (minX + maxX) / 2) * longitudeScale * scale;
  const y = (point: RouteCoordinate) => mapHeight / 2 - (point.latitude - (minY + maxY) / 2) * scale;
  const path = (segments: RouteCoordinate[][]) =>
    segments
      .map((segment) =>
        segment.map((point, index) => (index ? 'L' : 'M') + x(point) + ',' + y(point)).join(' '),
      )
      .join(' ');
  const start = recorded[0]?.[0] ?? guides[0]?.[0];
  const end = recorded.at(-1)?.at(-1) ?? guides.at(-1)?.at(-1);
  return (
    <View
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout;
        if (width > 0 && height > 0)
          setSize((previous) =>
            previous.width === width && previous.height === height ? previous : { width, height },
          );
      }}
      style={[
        height === 'fill' ? styles.fill : { height, borderRadius: radii.card },
        { overflow: 'hidden', backgroundColor: colors.field },
      ]}
    >
      {all.length > 0 ? (
        <>
          <Svg
            width={width}
            height={mapHeight}
            viewBox={'0 0 ' + width + ' ' + mapHeight}
            accessibilityLabel="Tracé GPS schématique"
          >
            <Path d={path(guides)} fill="none" stroke={colors.routeReference} strokeWidth={3} />
            {paceParts?.length ? (
              paceZones.map((zone) => {
                const segments = paceParts.filter((part) => part.zone === zone).map((part) => part.points);
                return (
                  segments.length > 0 && (
                    <Path
                      key={zone}
                      d={path(segments)}
                      fill="none"
                      stroke={paceZoneColor(zone, colors)}
                      strokeWidth={4}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  )
                );
              })
            ) : (
              <Path
                d={path(recorded)}
                fill="none"
                stroke={colors.text}
                strokeWidth={4}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
            {start && <Circle cx={x(start)} cy={y(start)} r={5} fill={colors.routeStart} />}
            {!live && end && end !== start && (
              <Circle cx={x(end)} cy={y(end)} r={5} fill={colors.routeFinish} />
            )}
            {current && (
              <Circle
                cx={x(current)}
                cy={y(current)}
                r={7}
                fill={colors.routePosition}
                stroke={mapPositionHalo}
                strokeWidth={2}
              />
            )}
            {selected && (
              <Circle cx={x(selected)} cy={y(selected)} r={7} fill={colors.accent} stroke={colors.text} />
            )}
          </Svg>
          {!live && (
            <Copy muted style={styles.caption}>
              Aperçu du tracé · carte Apple sur iPhone
            </Copy>
          )}
        </>
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
  return <MapSurface {...props} pointCount={props.points.length} />;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  caption: { position: 'absolute', bottom: 8, left: 12, fontSize: typography.small.fontSize },
});
