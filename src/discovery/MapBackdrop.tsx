import Svg, { Path } from 'react-native-svg';
import { StyleSheet, View } from 'react-native';
import { Copy } from '../ui/components';
import { useTheme } from '../ui/theme';
import { locateOnMap, type DiscoveryRegion } from './mapModel';
import contours from './nice-contours.json';
import { sectors } from './catalog';

export function MapBackdrop({
  region,
  width,
  height,
  captions = false,
}: {
  region: DiscoveryRegion;
  width: number;
  height: number;
  captions?: boolean;
}) {
  const { colors } = useTheme();
  const paths = contours
    .map(
      (ring) =>
        ring
          .map(([longitude, latitude], i) => {
            const { x, y } = locateOnMap({ longitude: longitude!, latitude: latitude! }, region);
            return `${i ? 'L' : 'M'}${(x * width).toFixed(1)},${(y * height).toFixed(1)}`;
          })
          .join('') + 'Z',
    )
    .join('');
  return (
    <View
      pointerEvents="none"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={[StyleSheet.absoluteFill, { backgroundColor: colors.accentSoft, overflow: 'hidden' }]}
    >
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Path d={paths} fill={colors.raised} stroke={colors.controlLine} strokeWidth={0.7} />
      </Svg>
      {captions &&
        sectors.map((sector) => {
          const { x, y } = locateOnMap(sector, region);
          return x > 0.15 && x < 0.82 && y > 0.1 && y < 0.82 ? (
            <Copy
              key={sector.id}
              variant="small"
              muted
              style={{ position: 'absolute', left: x * width - 22, top: y * height - 20 }}
            >
              {sector.name}
            </Copy>
          ) : null;
        })}
    </View>
  );
}
