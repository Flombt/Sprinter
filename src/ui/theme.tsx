import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, Platform, useColorScheme, useWindowDimensions } from 'react-native';
import { Appearance } from '../core/types';
import { ACTIVE_PALETTE, buildPalettes, type PaletteName, type ThemeColors } from './palettes';

export type Theme = ThemeColors;
type DevPalette = { name: PaletteName; select: (name: PaletteName) => void };
type ThemeValue = {
  colors: ThemeColors;
  lightColors: ThemeColors;
  reduceMotion: boolean;
  reduceTransparency: boolean;
  devPalette?: DevPalette;
};
type ThemeProviderProps = { appearance: Appearance; children: React.ReactNode };

export const defaultPalettes = buildPalettes(ACTIVE_PALETTE);
const ThemeContext = createContext<ThemeValue>({
  colors: defaultPalettes.dark,
  lightColors: defaultPalettes.light,
  reduceMotion: false,
  reduceTransparency: false,
});
export function ThemeProvider(props: ThemeProviderProps) {
  return __DEV__ ? <DevThemeProvider {...props} /> : <ResolvedThemeProvider {...props} />;
}

function DevThemeProvider(props: ThemeProviderProps) {
  const [name, select] = useState<PaletteName>(ACTIVE_PALETTE);
  const devPalette = useMemo(() => ({ name, select }), [name]);
  return <ResolvedThemeProvider {...props} devPalette={devPalette} />;
}

function ResolvedThemeProvider({
  appearance,
  children,
  devPalette,
}: ThemeProviderProps & { devPalette?: DevPalette }) {
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
  const name = devPalette?.name ?? ACTIVE_PALETTE;
  const palettes = useMemo(
    () => name === ACTIVE_PALETTE ? defaultPalettes : buildPalettes(name),
    [name],
  );
  const dark = appearance === 'system' ? system === 'dark' : appearance === 'dark';
  const colors = dark ? palettes.dark : palettes.light;
  const value = useMemo(
    () => ({ colors, lightColors: palettes.light, reduceMotion, reduceTransparency, devPalette }),
    [colors, palettes.light, reduceMotion, reduceTransparency, devPalette],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
export const useTheme = () => useContext(ThemeContext);
export function useAdaptiveLayout() {
  const { width, fontScale } = useWindowDimensions();
  return { width, fontScale, largeText: fontScale >= 1.3, compact: width < 375 };
}
