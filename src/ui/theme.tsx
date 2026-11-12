import React, { createContext, useContext, useEffect, useState } from 'react';
import { AccessibilityInfo, Platform, useColorScheme, useWindowDimensions } from 'react-native';
import { Appearance } from '../core/types';
import { palettes, type ThemeColors } from './tokens';

export type Theme = ThemeColors;
const ThemeContext = createContext({ colors: palettes.dark, reduceMotion: false, reduceTransparency: false });
export function ThemeProvider({ appearance, children }: { appearance: Appearance; children: React.ReactNode }) {
  const system = useColorScheme();
  // Start conservatively while iOS accessibility preferences are being read.
  const [reduceMotion, setReduceMotion] = useState(true);
  const [reduceTransparency, setReduceTransparency] = useState(Platform.OS === 'ios');
  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(value => { if (mounted) setReduceMotion(value); }).catch(() => undefined);
    if (Platform.OS === 'ios') void AccessibilityInfo.isReduceTransparencyEnabled().then(value => { if (mounted) setReduceTransparency(value); }).catch(() => undefined);
    const motion = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    const transparency = Platform.OS === 'ios' ? AccessibilityInfo.addEventListener('reduceTransparencyChanged', setReduceTransparency) : null;
    return () => { mounted = false; motion.remove(); transparency?.remove(); };
  }, []);
  return <ThemeContext.Provider value={{ colors: (appearance === 'system' ? system === 'dark' : appearance === 'dark') ? palettes.dark : palettes.light,
    reduceMotion, reduceTransparency }}>{children}</ThemeContext.Provider>;
}
export const useTheme = () => useContext(ThemeContext);
export function useAdaptiveLayout() {
  const { width, fontScale } = useWindowDimensions();
  return { width, fontScale, largeText: fontScale >= 1.3, compact: width < 375 };
}
