import type { TextStyle } from 'react-native';

/** Shared identity, including the secondary screens and native controls. */
const brand = {
  accent: '#FF5C35', accentInk: '#FFFFFF', heroStart: '#F2F0E9', heroEnd: '#F2F0E9',
  heroText: '#171719', heroSecondary: '#65615C', heroAction: '#FF5C35', heroActionText: '#FFFFFF', heroDecoration: '#C3BFB6',
  routeReference: '#6D9FDA', routeStart: '#719B35', routeFinish: '#F0A57E', routePosition: '#4395E6',
};
export const palettes = {
  light: {
    ...brand, dark: false, background: '#F2F0E9', surface: '#FFFFFF', raised: '#E7E4DD', field: '#F7F6F2',
    text: '#171719', secondary: '#606066', muted: '#67676F', line: '#D7D4CC', controlLine: '#8D8B87',
    accentText: '#B63113', accentSoft: '#FBE7DF', switchOn: '#D24321', switchThumb: '#FFFFFF',
    orange: '#91501A', blue: '#326797', danger: '#AD332B', dangerSurface: '#FCEDEA',
    glass: 'rgba(255,255,255,0.90)', scrim: 'rgba(10,16,8,0.48)', shadow: '#101A08',
  },
  dark: {
    ...brand, dark: true, background: '#101011', surface: '#1B1B1E', raised: '#252528', field: '#151517',
    text: '#FAF9F6', secondary: '#A0A0A7', muted: '#94949C', line: '#303034', controlLine: '#73737B',
    accentText: '#FF8D6E', accentSoft: '#322019', switchOn: '#FF5C35', switchThumb: '#FFFFFF',
    orange: '#FFC28B', blue: '#A5CCF3', danger: '#FFA59F', dangerSurface: '#392522',
    glass: 'rgba(25,25,28,0.94)', scrim: 'rgba(0,0,0,0.64)', shadow: '#000000',
  },
};
export type ThemeColors = typeof palettes.light;
export const spacing = { none: 0, xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32, section: 40 } as const;
export const radii = { sm: 6, control: 12, button: 12, card: 18, hero: 20, pill: 999 } as const;
export const layout = { touch: 44, button: 56, input: 52, multiline: 112, screenGutter: 24, compactGutter: 16, contentWidth: 560, tabIcon: 22 } as const;
export const interaction = {
  pressedOpacity: .78,
  disabledOpacity: .5,
  buttonScale: .97,
  pressDuration: 100,
  screenDuration: 160,
} as const;
export const typography = {
  hero: { fontFamily: 'SprinterDisplay', fontSize: 44, lineHeight: 48, fontWeight: 'normal', letterSpacing: -.5 },
  display: { fontFamily: 'SprinterMetric', fontSize: 44, lineHeight: 52, fontWeight: 'normal', letterSpacing: -.5, fontVariant: ['tabular-nums'] },
  distance: { fontFamily: 'SprinterMetric', fontSize: 64, lineHeight: 76, fontWeight: 'normal', letterSpacing: -1, fontVariant: ['tabular-nums'] },
  pace: { fontFamily: 'SprinterMetric', fontSize: 80, lineHeight: 96, fontWeight: 'normal', letterSpacing: -1, fontVariant: ['tabular-nums'] },
  title: { fontFamily: 'SprinterDisplay', fontSize: 34, lineHeight: 40, fontWeight: 'normal', letterSpacing: -.3 },
  heading: { fontFamily: 'SprinterDisplay', fontSize: 27, lineHeight: 32, fontWeight: 'normal', letterSpacing: -.2 },
  section: { fontSize: 20, lineHeight: 27, fontWeight: '600', letterSpacing: -.4 },
  body: { fontSize: 15, lineHeight: 23, fontWeight: '400' },
  emphasis: { fontSize: 15, lineHeight: 23, fontWeight: '600' },
  caption: { fontSize: 13, lineHeight: 19, fontWeight: '400' },
  small: { fontSize: 12, lineHeight: 18, fontWeight: '400' },
  label: { fontSize: 12, lineHeight: 18, fontWeight: '700', letterSpacing: 1.4, textTransform: 'uppercase' },
  button: { fontSize: 16, lineHeight: 23, fontWeight: '600' },
  tab: { fontSize: 11, lineHeight: 16, fontWeight: '600' },
  metric: { fontFamily: 'SprinterMetric', fontSize: 30, lineHeight: 36, fontWeight: 'normal', letterSpacing: -.4, fontVariant: ['tabular-nums'] },
  metricLarge: { fontFamily: 'SprinterMetric', fontSize: 42, lineHeight: 48, fontWeight: 'normal', letterSpacing: -.5, fontVariant: ['tabular-nums'] },
} satisfies Record<string, TextStyle>;
export type TextVariant = keyof typeof typography;
export const cardStyles = {
  default: { borderRadius: radii.card, padding: spacing.xl },
  hero: { borderRadius: radii.hero, padding: spacing.xxl },
  metric: { borderRadius: radii.card, padding: spacing.xl },
  list: { borderRadius: radii.card, padding: spacing.lg },
  setting: { borderRadius: radii.card, padding: spacing.lg },
} as const;
