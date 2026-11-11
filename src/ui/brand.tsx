import { View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { Copy } from './components';
import { useTheme } from './theme';
import { palettes, spacing } from './tokens';

export function SpeedMark({ size = 30, color = palettes.dark.accent }: { size?: number; color?: string }) {
  return <Svg accessible={false} width={size} height={size * .8} viewBox="0 0 36 28">
    <Path d="M2 25 14 3h6L8 25Zm10 0L24 3h6L18 25Zm10 0L34 3h2L24 25Z" fill={color} />
  </Svg>;
}

export function RunnerGlyph({ size = 24, color }: { size?: number; color?: string }) {
  const { colors } = useTheme();
  const ink = color ?? colors.text;
  return <Svg accessible={false} width={size} height={size} viewBox="0 0 24 24">
    <Circle cx="16.5" cy="4.5" r="2" fill={ink} />
    <Path
      d="m11 8 3-1 3 4 3 1M14 8l-4 6 4 3-2 5M10 14l-3 5H3M11 8l-4 3H4"
      fill="none"
      stroke={ink}
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>;
}

export function Brand() {
  return <View accessibilityLabel="Sprinter" style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
    <SpeedMark size={28} />
    <Copy variant="heading" style={{ letterSpacing: .6 }}>SPRINTER</Copy>
  </View>;
}
