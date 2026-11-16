import { editorial, neutralPalettes } from './tokens';

export type PaletteName = 'tempo' | 'signal' | 'cobalt';
export const ACTIVE_PALETTE: PaletteName = 'tempo';

export type ZoneColors = { color: string; text: string; soft: string; onColor: string };
type Mode = keyof typeof neutralPalettes;
type PaletteColors = { accent: ZoneColors; on?: ZoneColors; fast: ZoneColors; slow: ZoneColors };

const swatch = (color: string, text: string, soft: string, onColor: string): ZoneColors => ({
  color,
  text,
  soft,
  onColor,
});

const paletteChoices: Record<PaletteName, Record<Mode, PaletteColors>> = {
  tempo: {
    dark: {
      accent: swatch('#9CDECA', '#9CDECA', '#24443B', '#0B1F19'),
      on: swatch('#19C7B0', '#19C7B0', '#163732', '#101011'),
      fast: swatch('#D69005', '#F0AD33', '#3A2D12', '#101011'),
      slow: swatch('#8B99F9', '#9DA8FA', '#131839', '#101011'),
    },
    light: {
      accent: swatch('#106C5E', '#106C5E', '#DCECE4', '#FFFDF8'),
      on: swatch('#107F70', '#0E7164', '#D8F8F4', '#FFFFFF'),
      fast: swatch('#9A6804', '#865B03', '#FCEFD4', '#FFFFFF'),
      slow: swatch('#2541F4', '#2541F4', '#D5DAFB', '#FFFFFF'),
    },
  },
  signal: {
    dark: {
      accent: swatch('#C6F135', '#C6F135', '#313914', '#101011'),
      fast: swatch('#F77864', '#FF8B77', '#391813', '#101011'),
      slow: swatch('#64A1F7', '#72A9FF', '#132339', '#101011'),
    },
    light: {
      accent: swatch('#657D08', '#566907', '#F3FAD6', '#FFFFFF'),
      fast: swatch('#DF280C', '#BD220A', '#FBDAD5', '#FFFFFF'),
      slow: swatch('#0D6CF2', '#0B5DD0', '#D5E5FB', '#FFFFFF'),
    },
  },
  cobalt: {
    dark: {
      accent: swatch('#8D96FC', '#A7ADFF', '#12163A', '#101011'),
      on: swatch('#26B57A', '#6AD5A0', '#193429', '#101011'),
      fast: swatch('#DB8D06', '#D68905', '#3A2C12', '#101011'),
      slow: swatch('#D979EC', '#EA97F5', '#311636', '#101011'),
    },
    light: {
      accent: swatch('#3B4BFF', '#2F3FE0', '#D4D8FC', '#FFFFFF'),
      on: swatch('#1C8258', '#18724C', '#DBF5EA', '#FFFFFF'),
      fast: swatch('#9F6604', '#8B5904', '#FCEDD4', '#FFFFFF'),
      slow: swatch('#BF20DF', '#A11BBB', '#F2D9F8', '#FFFFFF'),
    },
  },
};

function buildTheme(mode: Mode, { accent, on = accent, fast, slow }: PaletteColors, hero: ZoneColors) {
  const neutral = neutralPalettes[mode];
  return {
    ...neutral,
    accent: accent.color,
    accentInk: accent.onColor,
    accentText: accent.text,
    accentSoft: accent.soft,
    switchOn: accent.color,
    heroAction: hero.color,
    heroActionText: hero.onColor,
    zone: { on, fast, slow },
    warning: { text: fast.text, soft: fast.soft },
    info: { text: slow.text, soft: slow.soft },
    routePosition: accent.color,
    routeStart: on.color,
    routeFinish: neutral.text,
    routeReference: slow.color,
  };
}

export type ThemeColors = ReturnType<typeof buildTheme>;

export function buildPalettes(name: PaletteName) {
  const { light, dark } = paletteChoices[name];
  const darkColors = buildTheme('dark', dark, light.accent);
  const instrument = buildTheme('dark', { ...dark, accent: dark.on ?? dark.accent }, light.accent);
  return {
    light: buildTheme('light', light, light.accent),
    dark: darkColors,
    instrument: { ...instrument, background: editorial.instrument, surface: '#142220' },
  };
}
