import type { TextStyle } from 'react-native';

/** The paper surface uses the same neutrals in both modes. */
// prettier-ignore
const hero = {
  heroStart: '#F3F1E9', heroEnd: '#F3F1E9',
  heroText: '#152724', heroSecondary: '#4E615A', heroDecoration: '#A6B8AF',
};
// prettier-ignore
export const neutralPalettes = {
  light: {
    ...hero, dark: false, background: '#F3F1E9', surface: '#FBFAF6', raised: '#E7E9DF', field: '#F8F7F2',
    text: '#152724', secondary: '#4E615A', muted: '#4E615A', line: '#D6DDD4', controlLine: '#72857B',
    switchThumb: '#FFFFFF', danger: '#AD332B', dangerSurface: '#FCEDEA',
    glass: 'rgba(251,250,246,0.94)', scrim: 'rgba(5,16,12,0.60)', shadow: '#101A08',
  },
  dark: {
    ...hero, dark: true, background: '#101C1B', surface: '#172524', raised: '#253533', field: '#14201F',
    text: '#F3F6ED', secondary: '#B6C8BD', muted: '#A5B9AF', line: '#334641', controlLine: '#758E83',
    switchThumb: '#FFFFFF', danger: '#FFA59F', dangerSurface: '#392522',
    glass: 'rgba(23,37,36,0.94)', scrim: 'rgba(0,0,0,0.70)', shadow: '#000000',
  },
};
export type { ThemeColors } from './palettes';
export const paperColors = {
  line: '#D7D4CC',
  pressed: '#DDDAD2',
  badge: '#E3E0D8',
  badgeText: '#5F5D58',
  label: '#706C65',
  field: '#E6E3DC',
  placeholder: '#77736D',
} as const;
export const controlColors = {
  switchTrackOff: '#424248',
  choicePressed: '#36363A',
} as const;
export const mapPositionHalo = '#FFFFFF';
export const spacing = {
  none: 0,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  section: 40,
} as const;
export const radii = { sm: 6, control: 12, button: 12, card: 18, hero: 23, pill: 999 } as const;
export const layout = {
  touch: 44,
  button: 56,
  runButton: 72,
  toolbarButton: 48,
  input: 52,
  multiline: 112,
  screenGutter: 20,
  compactGutter: 14,
  contentWidth: 560,
  tabIcon: 22,
} as const;
export const editorial = {
  ink: '#FFFDF8',
  secondary: '#C2DED2',
  surface: '#142D28',
  scrim: 'rgba(9,27,24,0.82)',
  graph: '#A7DFCB',
  instrument: '#0C1615',
} as const;
export const interaction = {
  pressedOpacity: 0.78,
  disabledOpacity: 0.5,
  buttonScale: 0.97,
  pressDuration: 100,
  screenDuration: 160,
} as const;
export const motionDuration = {
  tab: 150,
  indicator: 200,
  detail: 280,
  sheet: 240,
  select: 130,
  chart: 300,
  media: 170,
} as const;
export const typography = {
  condensedTitle: {
    fontFamily: 'SprinterDisplay',
    fontSize: 42,
    lineHeight: 46,
    fontWeight: 'normal',
    letterSpacing: -0.5,
  },
  condensedMetric: {
    fontFamily: 'SprinterMetric',
    fontSize: 42,
    lineHeight: 46,
    fontWeight: 'normal',
    letterSpacing: -0.5,
    fontVariant: ['tabular-nums'],
  },
  hero: {
    fontFamily: 'SprinterDisplay',
    fontSize: 44,
    lineHeight: 48,
    fontWeight: 'normal',
    letterSpacing: -0.5,
  },
  editorialTitle: {
    fontFamily: 'SprinterDisplay',
    fontSize: 44,
    lineHeight: 44,
    letterSpacing: -0.7,
  },
  editorialSection: {
    fontFamily: 'SprinterDisplay',
    fontSize: 27,
    lineHeight: 30,
  },
  editorialCover: {
    fontFamily: 'SprinterDisplay',
    fontSize: 54,
    lineHeight: 49,
    letterSpacing: -0.9,
  },
  editorialNumber: {
    fontFamily: 'SprinterDisplay',
    fontSize: 64,
    lineHeight: 65,
    letterSpacing: -0.9,
    fontVariant: ['tabular-nums'],
  },
  display: {
    fontFamily: 'SprinterMetric',
    fontSize: 44,
    lineHeight: 52,
    fontWeight: 'normal',
    letterSpacing: -0.5,
    fontVariant: ['tabular-nums'],
  },
  distance: {
    fontFamily: 'SprinterMetric',
    fontSize: 64,
    lineHeight: 76,
    fontWeight: 'normal',
    letterSpacing: -1,
    fontVariant: ['tabular-nums'],
  },
  pace: {
    fontFamily: 'SprinterMetric',
    fontSize: 80,
    lineHeight: 96,
    fontWeight: 'normal',
    letterSpacing: -1,
    fontVariant: ['tabular-nums'],
  },
  title: {
    fontFamily: 'SprinterDisplay',
    fontSize: 34,
    lineHeight: 40,
    fontWeight: 'normal',
    letterSpacing: -0.3,
  },
  heading: {
    fontFamily: 'SprinterDisplay',
    fontSize: 27,
    lineHeight: 32,
    fontWeight: 'normal',
    letterSpacing: -0.2,
  },
  section: { fontSize: 20, lineHeight: 27, fontWeight: '600', letterSpacing: -0.4 },
  body: { fontSize: 15, lineHeight: 23, fontWeight: '400' },
  bodyCompact: { fontSize: 14, lineHeight: 20, fontWeight: '400', letterSpacing: -0.15 },
  emphasis: { fontSize: 15, lineHeight: 23, fontWeight: '600' },
  caption: { fontSize: 13, lineHeight: 19, fontWeight: '400' },
  small: { fontSize: 12, lineHeight: 18, fontWeight: '400' },
  label: { fontSize: 12, lineHeight: 18, fontWeight: '700', letterSpacing: 1.4, textTransform: 'uppercase' },
  button: { fontSize: 16, lineHeight: 23, fontWeight: '600' },
  tab: { fontSize: 11, lineHeight: 16, fontWeight: '600' },
  metric: {
    fontFamily: 'SprinterMetric',
    fontSize: 30,
    lineHeight: 36,
    fontWeight: 'normal',
    letterSpacing: -0.4,
    fontVariant: ['tabular-nums'],
  },
  metricLarge: {
    fontFamily: 'SprinterMetric',
    fontSize: 42,
    lineHeight: 48,
    fontWeight: 'normal',
    letterSpacing: -0.5,
    fontVariant: ['tabular-nums'],
  },
} satisfies Record<string, TextStyle>;
export type TextVariant = keyof typeof typography;
export const cardStyles = {
  default: { borderRadius: radii.card, padding: spacing.xl },
  hero: { borderRadius: radii.hero, padding: spacing.xxl },
  metric: { borderRadius: radii.card, padding: spacing.xl },
  list: { borderRadius: radii.card, padding: spacing.lg },
  setting: { borderRadius: radii.card, padding: spacing.lg },
  paper: { borderRadius: radii.card, padding: spacing.xl },
} as const;
