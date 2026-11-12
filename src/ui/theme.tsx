import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, Platform, useColorScheme, useWindowDimensions } from 'react-native';
import { Appearance } from '../core/types';
import { ACTIVE_PALETTE, buildPalettes, type ThemeColors } from './palettes';

export type Theme = ThemeColors;
export const defaultPalettes = buildPalettes(ACTIVE_PALETTE);
const ThemeContext = createContext({
  colors: defaultPalettes.dark,
  lightColors: defaultPalettes.light,
  reduceMotion: false,
  reduceTransparency: false,
});
export function ThemeProvider({
  appearance,
  children,
}: {
  appearance: Appearance;
  children: React.ReactNode;
}) {
  const system = useColorScheme();
  // Start conservatively while iOS accessibility preferences are being read.
  const [reduceMotion, setReduceMotion] = useState(true);
  const [reduceTransparency, setReduceTransparency] = useState(Platform.OS === 'ios');
  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (mounted) setReduceMotion(value);
      })
      .catch(() => undefined);
    if (Platform.OS === 'ios')
      void AccessibilityInfo.isReduceTransparencyEnabled()
        .then((value) => {
          if (mounted) setReduceTransparency(value);
        })
        .catch(() => undefined);
    const motion = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    const transparency =
      Platform.OS === 'ios'
        ? AccessibilityInfo.addEventListener('reduceTransparencyChanged', setReduceTransparency)
        : null;
    return () => {
      mounted = false;
      motion.remove();
      transparency?.remove();
    };
  }, []);
  const colors = (appearance === 'system' ? system === 'dark' : appearance === 'dark')
    ? defaultPalettes.dark
    : defaultPalettes.light;
  const value = useMemo(
    () => ({ colors, lightColors: defaultPalettes.light, reduceMotion, reduceTransparency }),
    [colors, reduceMotion, reduceTransparency],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
export const useTheme = () => useContext(ThemeContext);
export function useAdaptiveLayout() {
  const { width, fontScale } = useWindowDimensions();
  return { width, fontScale, largeText: fontScale >= 1.3, compact: width < 375 };
}
