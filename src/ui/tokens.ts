import type { TextStyle } from 'react-native';

/** Sprinter's existing identity, expressed as semantic roles rather than screen colours. */
const brand = {
  accent: '#D1F17D', accentInk: '#22300F', heroStart: '#D8F697', heroEnd: '#C5E77D',
  heroText: '#20300F', heroSecondary: '#3C5025', heroAction: '#243317', heroActionText: '#F4F8EA', heroDecoration: '#34431C',
  routeReference: '#6D9FDA', routeStart: '#719B35', routeFinish: '#F0A57E', routePosition: '#4395E6',
};
export const palettes = {
  light: {
    ...brand, dark: false, background: '#F5F6EF', surface: '#FFFFFF', raised: '#E9EDDF', field: '#F7F8F3',
    text: '#192015', secondary: '#56624F', muted: '#606D59', line: '#D9DECF', controlLine: '#859176',
    accentText: '#4E6A22', accentSoft: '#E6EED4', switchOn: '#597735', switchThumb: '#FFFFFF',
    orange: '#91501A', blue: '#326797', danger: '#AD332B', dangerSurface: '#FCEDEA',
    glass: 'rgba(255,255,255,0.90)', scrim: 'rgba(10,16,8,0.48)', shadow: '#101A08',
  },
  dark: {
    ...brand, dark: true, background: '#101210', surface: '#1B1E1A', raised: '#252923', field: '#20251C',
    text: '#F5F6F0', secondary: '#B1B9A9', muted: '#A1AC98', line: '#343C2E', controlLine: '#78866D',
    accentText: '#D1F17D', accentSoft: '#2F3C22', switchOn: '#728F4B', switchThumb: '#F5F6F0',
    orange: '#FFC28B', blue: '#A5CCF3', danger: '#FFA59F', dangerSurface: '#392522',
    glass: 'rgba(27,30,26,0.90)', scrim: 'rgba(0,0,0,0.64)', shadow: '#000000',
  },
};
export type ThemeColors = typeof palettes.light;
export const spacing = { none: 0, xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32, section: 40 } as const;
export const radii = { sm: 8, control: 14, button: 18, card: 24, hero: 28, pill: 999 } as const;
export const layout = { touch: 44, button: 56, input: 52, multiline: 112, screenGutter: 24, compactGutter: 16, contentWidth: 560, tabIcon: 22 } as const;
export const interaction = { pressedOpacity: .78, disabledOpacity: .5, buttonScale: .985, screenDuration: 160 } as const;
export const typography = {
  hero: { fontSize: 44, lineHeight: 48, fontWeight: '700', letterSpacing: -1.8 },
  display: { fontSize: 44, lineHeight: 52, fontWeight: '600', letterSpacing: -1.5, fontVariant: ['tabular-nums'] },
  distance: { fontSize: 64, lineHeight: 76, fontWeight: '600', letterSpacing: -2, fontVariant: ['tabular-nums'] },
  pace: { fontSize: 80, lineHeight: 96, fontWeight: '600', letterSpacing: -3, fontVariant: ['tabular-nums'] },
  title: { fontSize: 32, lineHeight: 39, fontWeight: '700', letterSpacing: -.9 },
  heading: { fontSize: 24, lineHeight: 31, fontWeight: '700', letterSpacing: -.6 },
  section: { fontSize: 20, lineHeight: 27, fontWeight: '600', letterSpacing: -.4 },
  body: { fontSize: 15, lineHeight: 23, fontWeight: '400' },
  emphasis: { fontSize: 15, lineHeight: 23, fontWeight: '600' },
  caption: { fontSize: 13, lineHeight: 19, fontWeight: '400' },
  small: { fontSize: 11, lineHeight: 17, fontWeight: '400' },
  label: { fontSize: 11, lineHeight: 17, fontWeight: '700', letterSpacing: 1.4, textTransform: 'uppercase' },
  button: { fontSize: 16, lineHeight: 23, fontWeight: '600' },
  tab: { fontSize: 11, lineHeight: 16, fontWeight: '600' },
  metric: { fontSize: 27, lineHeight: 35, fontWeight: '600', letterSpacing: -.8, fontVariant: ['tabular-nums'] },
  metricLarge: { fontSize: 39, lineHeight: 47, fontWeight: '600', letterSpacing: -1, fontVariant: ['tabular-nums'] },
} satisfies Record<string, TextStyle>;
export type TextVariant = keyof typeof typography;
export const cardStyles = {
  default: { borderRadius: radii.card, padding: spacing.xl },
  hero: { borderRadius: radii.hero, padding: spacing.xxl },
  metric: { borderRadius: radii.card, padding: spacing.xl },
  list: { borderRadius: radii.card, padding: spacing.lg },
  setting: { borderRadius: radii.card, padding: spacing.lg },
} as const;
