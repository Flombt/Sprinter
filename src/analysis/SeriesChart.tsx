import React, { useState } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import { duration, pace } from '../core/format';
import { Copy } from '../ui/components';
import { useTheme } from '../ui/theme';
import type { Series, SeriesPoint } from './types';
export interface ChartBand { from: number; to: number; low: number; high: number }
/** Display-only decimation keeps local extrema. Calculations always use the full series. */
function displaySeries(series: Series): Series {
  const count = series.reduce((n, g) => n + g.length, 0), step = Math.max(1, Math.ceil(count / 350));
  return series.map(group => {
    if (step === 1) return group;
    const result: SeriesPoint[] = [];
    for (let from = 0; from < group.length; from += step) {
      const end = Math.min(group.length, from + step); let low = from, high = from;
      for (let i = from + 1; i < end; i++) { if (group[i]!.value < group[low]!.value) low = i; if (group[i]!.value > group[high]!.value) high = i; }
      for (const index of [...new Set([from, low, high, end - 1])].sort((a, b) => a - b)) result.push(group[index]!);
    }
    return result;
  });
}
export function SeriesChart({ series, seconds, kind, bands = [] }: { series: Series; seconds: number; kind: 'pace' | 'speed' | 'altitude'; bands?: ChartBand[] }) {
  const { colors } = useTheme(); const [width, setWidth] = useState(300);
  let minimum = Infinity, maximum = -Infinity, count = 0;
  for (const group of series) for (const p of group) { minimum = Math.min(minimum, p.value); maximum = Math.max(maximum, p.value); count++; }
  if (count < 2) return <Copy muted>Pas assez de mesures fiables pour tracer cette évolution.</Copy>;
  for (const band of bands) { minimum = Math.min(minimum, band.low); maximum = Math.max(maximum, band.high); }
  const margin = Math.max(kind === 'pace' ? 5 : kind === 'speed' ? .5 : 1, (maximum - minimum) * .08);
  const low = minimum - margin, high = maximum + margin;
  const x = (time: number) => 47 + time / Math.max(1, seconds) * (width - 59);
  const y = (value: number) => 13 + (kind === 'pace' ? value - low : high - value) / Math.max(.001, high - low) * 139;
  const label = (n: number) => kind === 'pace' ? pace(n) : kind === 'speed' ? n.toFixed(1) : Math.round(n).toString();
  return <View onLayout={e => setWidth(Math.max(100, e.nativeEvent.layout.width))} accessibilityLabel={`${kind === 'pace' ? 'Allure' : kind === 'speed' ? 'Vitesse' : 'Altitude'} en fonction du temps actif. Les interruptions ne sont pas reliées.`}>
    <Svg width={width} height={188}>
      {bands.map((b, i) => <Rect key={i} x={x(b.from)} y={Math.min(y(b.low), y(b.high))} width={Math.max(0, x(b.to) - x(b.from))} height={Math.max(2, Math.abs(y(b.high) - y(b.low)))} fill={colors.accentText} opacity={.14} />)}
      {[low, (low + high) / 2, high].map(value => <React.Fragment key={value}><Line x1={47} x2={width - 12} y1={y(value)} y2={y(value)} stroke={colors.line} strokeDasharray="3 5" /><SvgText x={0} y={y(value) + 4} fill={colors.secondary} fontSize={10}>{label(value)}</SvgText></React.Fragment>)}
      {displaySeries(series).map((group, i) => group.length === 1 ? <Circle key={i} cx={x(group[0]!.seconds)} cy={y(group[0]!.value)} r={2} fill={colors.accentText} />
        : <Path key={i} d={group.map((p, j) => `${j ? 'L' : 'M'}${x(p.seconds).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ')} fill="none" stroke={colors.accentText} strokeWidth={2.5} strokeLinejoin="round" />)}
      <SvgText x={47} y={179} fill={colors.secondary} fontSize={10}>0:00</SvgText><SvgText x={width - 12} y={179} fill={colors.secondary} fontSize={10} textAnchor="end">{duration(seconds)}</SvgText>
    </Svg><Copy muted variant="small">{kind === 'pace' ? 'min/km · allure lissée' : kind === 'speed' ? 'km/h · calculés depuis l’allure fiable' : 'm · altitude filtrée avec précision verticale suffisante'} · temps actif. Les données manquantes ne sont pas reliées.</Copy>
  </View>;
}
