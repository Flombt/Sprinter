import { Platform, StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { GlassContainer, GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { useTheme } from './theme';
import { spacing } from './tokens';

export function FloatingMaterial() {
  const { colors, reduceTransparency } = useTheme();
  const nativeGlass = !reduceTransparency && Platform.OS === 'ios' && isLiquidGlassAvailable();
  return <View pointerEvents="none" accessible={false} style={StyleSheet.absoluteFill}>
    {nativeGlass ? <GlassContainer spacing={spacing.sm} style={StyleSheet.absoluteFill}>
      <GlassView colorScheme={colors.dark ? 'dark' : 'light'} glassEffectStyle="regular" style={StyleSheet.absoluteFill} />
    </GlassContainer> : <>
      {!reduceTransparency && Platform.OS !== 'android' &&
        <BlurView tint={colors.dark ? 'dark' : 'light'} intensity={65} style={StyleSheet.absoluteFill} />}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: reduceTransparency ? colors.surface : colors.glass }]} />
    </>}
  </View>;
}
