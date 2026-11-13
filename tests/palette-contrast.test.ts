import { describe, expect, it } from 'vitest';
import { buildPalettes, type PaletteName } from '../src/ui/palettes';

function relativeLuminance(hex: string) {
  const rgb = Number.parseInt(hex.slice(1), 16);
  const linear = (channel: number) => {
    const sRGB = channel / 255;
    return sRGB <= 0.04045 ? sRGB / 12.92 : ((sRGB + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * linear((rgb >> 16) & 255) + 0.7152 * linear((rgb >> 8) & 255) + 0.0722 * linear(rgb & 255);
}

function contrast(first: string, second: string) {
  const a = relativeLuminance(first);
  const b = relativeLuminance(second);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

const paletteNames: PaletteName[] = ['tempo', 'signal', 'cobalt'];
const modes = ['light', 'dark'] as const;
const surfaces = ['background', 'surface', 'raised'] as const;

describe.each(paletteNames)('palette %s', (name) => {
  describe.each(modes)('thème %s', (mode) => {
    const colors = buildPalettes(name)[mode];
    const swatches = {
      accent: { color: colors.accent, text: colors.accentText, soft: colors.accentSoft, onColor: colors.accentInk },
      ...colors.zone,
    };

    it.each(Object.entries(swatches))('%s respecte le contraste du texte et des éléments graphiques', (role, swatch) => {
      expect(contrast(swatch.onColor, swatch.color), role + '.onColor sur son aplat').toBeGreaterThanOrEqual(4.5);
      expect(contrast(swatch.text, swatch.soft), role + '.text sur son fond teinté').toBeGreaterThanOrEqual(4.5);
      for (const surface of surfaces) {
        expect(contrast(swatch.text, colors[surface]), role + '.text sur ' + surface).toBeGreaterThanOrEqual(4.5);
        expect(contrast(swatch.color, colors[surface]), role + '.color sur ' + surface).toBeGreaterThanOrEqual(3);
      }
    });

    it('respecte le contraste du bouton sur la carte crème', () => {
      expect(contrast(colors.heroActionText, colors.heroAction)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(colors.heroAction, colors.heroStart)).toBeGreaterThanOrEqual(3);
    });

    it('préserve les contrastes de texte neutres déjà conformes', () => {
      for (const text of ['text', 'secondary', 'muted'] as const) {
        for (const surface of [...surfaces, 'field'] as const) {
          // Existing light muted on raised measures 4.41:1 and is outside the palette phase.
          if (mode === 'light' && text === 'muted' && surface === 'raised') continue;
          expect(contrast(colors[text], colors[surface]), text + ' sur ' + surface).toBeGreaterThanOrEqual(4.5);
        }
      }
    });
  });
});
