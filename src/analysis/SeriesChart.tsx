import React, { memo, useCallback, useMemo, useRef, useState } from 'react';
import { PanResponder, StyleSheet, View } from 'react-native';
import Svg, { Circle, G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import { duration, km, pace } from '../core/format';
import { Copy, Icon } from '../ui/components';
import { useAdaptiveLayout, useTheme } from '../ui/theme';
import { haptic } from '../ui/haptics';
import { nearestTimeIndex } from '../ui/nearestTimeIndex';
import { spacing, typography } from '../ui/tokens';
import type { Series, SeriesPoint } from './types';
export interface ChartBand {
  from: number;
  to: number;
  low: number;
  high: number;
  openSide?: 'fast' | 'slow';
}
/** Display-only decimation keeps local extrema. Calculations always use the full series. */
function displaySeries(series: Series): Series {
  const count = series.reduce((n, g) => n + g.length, 0),
    step = Math.max(1, Math.ceil(count / 350));
  return series.map((group) => {
    if (step === 1) return group;
    const result: SeriesPoint[] = [];
    for (let from = 0; from < group.length; from += step) {
      const end = Math.min(group.length, from + step);
      let low = from,
        high = from;
      for (let i = from + 1; i < end; i++) {
        if (group[i]!.value < group[low]!.value) low = i;
        if (group[i]!.value > group[high]!.value) high = i;
      }
      for (const index of [...new Set([from, low, high, end - 1])].sort((a, b) => a - b))
        result.push(group[index]!);
    }
    return result;
  });
}
const emptyBands: ChartBand[] = [];
const accessibilityActions = [
  { name: 'increment', label: 'Mesure suivante' },
  { name: 'decrement', label: 'Mesure précédente' },
];
const sampleTime = (point: SeriesPoint) => point.seconds;
const paceLabels = {
  fast: { label: 'Trop rapide', icon: 'arrow-down' },
  on: { label: 'Dans la cible', icon: 'checkmark-circle-outline' },
  slow: { label: 'Trop lent', icon: 'arrow-up' },
} as const;

function pointZone(point: SeriesPoint, band: ChartBand) {
  if (band.openSide !== 'fast' && point.value < band.low) return 'fast';
  if (band.openSide !== 'slow' && point.value > band.high) return 'slow';
  return 'on';
}

export const SeriesChart = memo(function SeriesChart({
  series,
  seconds,
  kind,
  bands = emptyBands,
  onSelect,
}: {
  series: Series;
  seconds: number;
  kind: 'pace' | 'speed' | 'altitude';
  bands?: ChartBand[];
  onSelect?: (sample: SeriesPoint) => void;
}) {
  const { colors } = useTheme();
  const { fontScale } = useAdaptiveLayout();
  const [width, setWidth] = useState(300);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const current = useRef<number | null>(null);
  const samples = useMemo(() => series.flat(), [series]);
  const displayed = useMemo(() => displaySeries(series), [series]);
  const extent = useMemo(() => {
    let minimum = Infinity;
    let maximum = -Infinity;
    for (const point of samples) {
      minimum = Math.min(minimum, point.value);
      maximum = Math.max(maximum, point.value);
    }
    for (const band of bands) {
      minimum = Math.min(minimum, band.low);
      maximum = Math.max(maximum, band.high);
    }
    const margin = Math.max(kind === 'pace' ? 5 : kind === 'speed' ? 0.5 : 1, (maximum - minimum) * 0.08);
    return { low: minimum - margin, high: maximum + margin };
  }, [samples, bands, kind]);
  const { low, high } = extent;
  const textSize = typography.small.fontSize * fontScale;
  const axis = Math.min(width * 0.42, Math.ceil(textSize * 3.9));
  const plotWidth = Math.max(1, width - axis - spacing.md);
  const chartHeight = 166 + textSize * 2;
  const x = (time: number) => axis + (time / Math.max(1, seconds)) * plotWidth;
  const y = (value: number) =>
    textSize + ((kind === 'pace' ? value - low : high - value) / (high - low)) * 139;
  const label = (value: number) =>
    kind === 'pace' ? pace(value) : kind === 'speed' ? value.toFixed(1) : Math.round(value).toString();

  const select = useCallback(
    (index: number) => {
      const sample = samples[index];
      if (!sample || current.current === index) return;
      const previous = current.current === null ? undefined : samples[current.current];
      if (previous && Math.floor(sample.meters / 1000) !== Math.floor(previous.meters / 1000))
        haptic.select();
      current.current = index;
      setSelectedIndex(index);
      onSelect?.(sample);
    },
    [samples, onSelect],
  );

  const pan = useMemo(() => {
    const selectAt = (locationX: number) => {
      const time = Math.max(0, Math.min(1, (locationX - axis) / plotWidth)) * seconds;
      select(nearestTimeIndex(samples, time, sampleTime));
    };
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: (event) => selectAt(event.nativeEvent.locationX),
      onPanResponderMove: (event) => selectAt(event.nativeEvent.locationX),
      onPanResponderTerminationRequest: () => true,
    });
  }, [axis, plotWidth, samples, seconds, select]);

  if (samples.length < 2) return <Copy muted>Pas assez de mesures fiables pour tracer cette évolution.</Copy>;
  const point = selectedIndex === null ? undefined : samples[selectedIndex];
  const band = point && bands.find(({ from, to }) =>
    point.seconds >= from && (point.seconds < to || (point.seconds === to && to === seconds)),
  );
  const zone = point && band ? pointZone(point, band) : undefined;
  const name = kind === 'pace' ? 'Allure' : kind === 'speed' ? 'Vitesse' : 'Altitude';
  const unit = kind === 'pace' ? 'min/km' : kind === 'speed' ? 'km/h' : 'm';
  const readout = point
    ? label(point.value) + ' ' + unit + ' · ' + duration(point.seconds) + ' · ' + km(point.meters) + ' km'
      + (zone ? ' · ' + paceLabels[zone].label : '')
    : null;

  return (
    <View onLayout={(event) => setWidth(Math.max(100, event.nativeEvent.layout.width))}>
      <View style={{ height: chartHeight }}>
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <Svg width={width} height={chartHeight}>
            {bands.map((band, index) => {
              const left = x(band.from);
              const right = x(band.to);
              if (right <= left) return null;
              const top = y(low);
              const bottom = y(high);
              const fastLimit = band.openSide === 'fast' ? top : y(band.low);
              const slowLimit = band.openSide === 'slow' ? bottom : y(band.high);
              const limits = fastLimit === slowLimit
                ? [{ at: fastLimit, dash: undefined }]
                : [{ at: fastLimit, dash: '6 4' }, { at: slowLimit, dash: '1 4' }];
              const zones = [
                { from: top, to: fastLimit, fill: colors.zone.fast.soft },
                { from: fastLimit, to: slowLimit, fill: colors.zone.on.soft },
                { from: slowLimit, to: bottom, fill: colors.zone.slow.soft },
              ];
              return (
                <G key={index}>
                  {zones.map(({ from, to, fill }) => to > from && (
                    <Rect key={fill} x={left} y={from} width={right - left} height={to - from} fill={fill} />
                  ))}
                  {limits.filter(({ at }) => at > top && at < bottom).map(({ at, dash }) => (
                    <Line
                      key={at}
                      x1={left}
                      x2={right}
                      y1={at}
                      y2={at}
                      stroke={colors.zone.on.color}
                      strokeWidth={1.5}
                      strokeDasharray={dash}
                    />
                  ))}
                </G>
              );
            })}
            {[low, (low + high) / 2, high].map((value) => (
              <React.Fragment key={value}>
                <Line
                  x1={axis}
                  x2={width - spacing.md}
                  y1={y(value)}
                  y2={y(value)}
                  stroke={colors.line}
                  strokeDasharray="3 5"
                />
                <SvgText x={0} y={y(value) + spacing.xs} fill={colors.secondary} fontSize={textSize}>
                  {label(value)}
                </SvgText>
              </React.Fragment>
            ))}
            {displayed.map((group, index) =>
              group.length === 1 ? (
                <Circle
                  key={index}
                  cx={x(group[0]!.seconds)}
                  cy={y(group[0]!.value)}
                  r={2}
                  fill={colors.text}
                />
              ) : (
                <Path
                  key={index}
                  d={group
                    .map(
                      (sample, i) =>
                        (i ? 'L' : 'M') + x(sample.seconds).toFixed(1) + ',' + y(sample.value).toFixed(1),
                    )
                    .join(' ')}
                  fill="none"
                  stroke={colors.text}
                  strokeWidth={2.5}
                  strokeLinejoin="round"
                />
              ),
            )}
            {point && (
              <>
                <Line
                  x1={x(point.seconds)}
                  x2={x(point.seconds)}
                  y1={textSize}
                  y2={139 + textSize}
                  stroke={colors.secondary}
                  strokeDasharray="3 5"
                />
                <Circle
                  cx={x(point.seconds)}
                  cy={y(point.value)}
                  r={5}
                  fill={zone ? colors.zone[zone].color : colors.secondary}
                  stroke={colors.background}
                  strokeWidth={1.5}
                />
              </>
            )}
            <SvgText x={axis} y={chartHeight - spacing.sm} fill={colors.secondary} fontSize={textSize}>
              0:00
            </SvgText>
            <SvgText
              x={width - spacing.md}
              y={chartHeight - spacing.sm}
              fill={colors.secondary}
              fontSize={textSize}
              textAnchor="end"
            >
              {duration(seconds)}
            </SvgText>
          </Svg>
        </View>
        <View
          {...pan.panHandlers}
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={name + ' en fonction du temps actif'}
          accessibilityHint="Glissez sur le graphique ou ajustez pour lire une mesure."
          accessibilityValue={readout ? { text: readout } : undefined}
          accessibilityActions={accessibilityActions}
          onAccessibilityAction={(event) => {
            const step = event.nativeEvent.actionName === 'increment' ? 1 : -1;
            select(Math.min(samples.length - 1, Math.max(0, (selectedIndex ?? -1) + step)));
          }}
          style={StyleSheet.absoluteFill}
        />
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
        {zone && <Icon name={paceLabels[zone].icon} size={16} color={colors.zone[zone].text} />}
        <Copy variant="small" style={{ flexShrink: 1, color: zone ? colors.zone[zone].text : colors.secondary }}>
          {readout ?? unit + ' · temps actif. Les données manquantes ne sont pas reliées.'}
        </Copy>
      </View>
    </View>
  );
});
