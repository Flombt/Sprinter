import { memo, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import type { TrackPoint } from '../core/types';
import { Copy, Icon } from './components';
import { MapPlaceholder } from './MapPlaceholder';
import { RecordedTrack, routeProjection } from './routeMapData';
import { useTheme } from './theme';
import { spacing } from './tokens';

const Trace = memo(function Trace({
  points,
  count,
  height,
  emptyLabel,
}: {
  points: readonly TrackPoint[];
  count: number;
  height: number;
  emptyLabel: string;
}) {
  const { colors } = useTheme();
  const [width, setWidth] = useState(320);
  const [track] = useState(() => new RecordedTrack(96));
  const segments = useMemo(() => track.update(points, count), [points, count, track]);
  const drawing = useMemo(() => {
    if (!segments.length) return null;
    const { x, y } = routeProjection(segments.flat(), width, height, 24, 26);
    const path = segments
      .map((segment) =>
        segment
          .map((point, i) => (i ? 'L' : 'M') + x(point).toFixed(1) + ',' + y(point).toFixed(1))
          .join(' '),
      )
      .join(' ');
    const start = segments[0]![0]!;
    const end = segments.at(-1)!.at(-1)!;
    return { path, start: { x: x(start), y: y(start) }, end: { x: x(end), y: y(end) } };
  }, [segments, width, height]);
  return (
    <View
      onLayout={(event) => {
        const measured = event.nativeEvent.layout.width;
        if (measured > 0) setWidth(measured);
      }}
      style={{
        height,
        backgroundColor: colors.raised,
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
      }}
    >
      <MapPlaceholder reticle={false} />
      {drawing ? (
        <Svg
          accessibilityLabel="Tracé GPS de la sortie"
          accessibilityRole="image"
          style={styles.drawing}
          width={width}
          height={height}
          viewBox={'0 0 ' + width + ' ' + height}
        >
          <Path
            d={drawing.path}
            fill="none"
            stroke={colors.accentText}
            strokeWidth={3}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          <Circle
            cx={drawing.start.x}
            cy={drawing.start.y}
            r={4}
            fill={colors.surface}
            stroke={colors.accentText}
            strokeWidth={2}
          />
          <Circle
            cx={drawing.end.x}
            cy={drawing.end.y}
            r={4.5}
            fill={colors.accentText}
            stroke={colors.surface}
            strokeWidth={1.5}
          />
        </Svg>
      ) : (
        <View style={[styles.drawing, styles.empty, { backgroundColor: colors.surface }]}>
          <Icon name="git-commit-outline" color={colors.secondary} size={17} />
          <Copy muted variant="small" style={{ textAlign: 'center', flexShrink: 1 }}>
            {emptyLabel}
          </Copy>
        </View>
      )}
    </View>
  );
});

export function RouteTrace({
  points,
  height,
  emptyLabel = 'Aucun tracé GPS',
}: {
  points: readonly TrackPoint[];
  height: number;
  emptyLabel?: string;
}) {
  return <Trace points={points} count={points.length} height={height} emptyLabel={emptyLabel} />;
}

const styles = StyleSheet.create({
  drawing: { position: 'relative', zIndex: 1 },
  empty: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    marginHorizontal: spacing.sm,
    borderRadius: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
});
