import { BlurView } from 'expo-blur';
import { GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from 'expo-glass-effect';
import { LinearGradient } from 'expo-linear-gradient';
import { Platform, StyleSheet, View } from 'react-native';
import { useTheme } from './theme';

export function hasNativeGlass(reduceTransparency: boolean) {
  return (
    !reduceTransparency && Platform.OS === 'ios' && isLiquidGlassAvailable() && isGlassEffectAPIAvailable()
  );
}

type GlassSurfaceProps = {
  radius: number;
  kind?: 'control' | 'dock' | 'solid';
  color?: string;
  pressed?: boolean;
};

export function GlassSurface({ radius, kind = 'control', color, pressed }: GlassSurfaceProps) {
  const { colors, reduceTransparency } = useTheme();
  const solid = kind === 'solid';
  const dock = kind === 'dock';
  const native = !solid && hasNativeGlass(reduceTransparency);
  const blur = dock && !reduceTransparency && !native && Platform.OS !== 'android';
  const scheme = colors.dark ? 'dark' : 'light';
  const tint = colors.dark
    ? dock
      ? 'rgba(24,24,28,0.78)'
      : 'rgba(35,35,40,0.80)'
    : dock
      ? 'rgba(255,255,255,0.78)'
      : 'rgba(255,255,255,0.84)';
  const base =
    solid || reduceTransparency || (!native && !blur)
      ? pressed && reduceTransparency && !solid
        ? colors.raised
        : (color ?? colors.surface)
      : 'transparent';
  const edge = solid ? 'rgba(255,255,255,0.19)' : colors.dark ? 'rgba(255,255,255,0.13)' : '#FFFFFF';
  const fill = [StyleSheet.absoluteFill, { borderRadius: radius }];

  return (
    <View
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={[fill, { backgroundColor: base, overflow: 'hidden' }]}
    >
      {native && <GlassView colorScheme={scheme} glassEffectStyle="regular" tintColor={tint} style={fill} />}
      {blur && (
        <>
          <BlurView tint={scheme} intensity={40} style={StyleSheet.absoluteFill} />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: tint }]} />
        </>
      )}
      {!reduceTransparency && (
        <LinearGradient
          colors={[edge, 'rgba(255,255,255,0)']}
          locations={[0, solid ? 0.48 : 0.85]}
          style={StyleSheet.absoluteFill}
        />
      )}
      {pressed && (
        <View
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor:
                !reduceTransparency && colors.dark && !solid ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)',
            },
          ]}
        />
      )}
      {!solid && <View style={[fill, { borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line }]} />}
    </View>
  );
}
