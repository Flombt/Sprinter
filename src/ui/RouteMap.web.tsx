import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import type { TrackPoint } from '../core/types';
import type { RouteCoordinate } from '../routes/types';
import { Copy, Icon } from './components';
import { useTheme } from './theme';
import { radii } from './tokens';
export default function RouteMap({ points, reference = [], height = 220 }: { points: TrackPoint[]; reference?: RouteCoordinate[][]; current?: RouteCoordinate; height?: number; interactive?: boolean }) {
  const { colors } = useTheme();
  const recorded: RouteCoordinate[][] = []; let previous = -1;
  for (const point of points) { if (point.segment !== previous) recorded.push([]); recorded.at(-1)!.push(point.fix); previous = point.segment; }
  const all = [...recorded, ...reference].flat();
  if (!all.length) return <View style={{ height, borderRadius: radii.card, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', gap: 12 }}><Icon name="map-outline" /><Copy muted>Aucun tracé disponible.</Copy></View>;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of all) { minX = Math.min(minX, p.longitude); maxX = Math.max(maxX, p.longitude); minY = Math.min(minY, p.latitude); maxY = Math.max(maxY, p.latitude); }
  const dx = Math.max(.0001, maxX - minX), dy = Math.max(.0001, maxY - minY), step = Math.max(1, Math.ceil(all.length / 1500));
  const path = (segments: RouteCoordinate[][]) => segments.map(segment => segment.filter((_, i) => i === 0 || i === segment.length - 1 || i % step === 0)
    .map((p, i) => `${i ? 'L' : 'M'}${25 + (p.longitude - minX) / dx * 270},${height - 35 - (p.latitude - minY) / dy * (height - 70)}`).join(' ')).join(' ');
  return <View style={{ height, borderRadius: radii.card, backgroundColor: colors.surface, overflow: 'hidden' }}><Svg viewBox={`0 0 320 ${height}`} width="100%" height={height}>
    <Path d={path(reference)} fill="none" stroke={colors.routeReference} strokeWidth={3} /><Path d={path(recorded)} fill="none" stroke={colors.accentText} strokeWidth={4} /></Svg>
    <Copy muted style={{ position: 'absolute', bottom: 8, left: 12, fontSize: 10 }}>Aperçu du tracé · carte Apple sur iPhone</Copy></View>;
}
