// Catalogue intégré du profil personnalisé (§17.3) : thèmes complets, couleurs, avatars et bannières.
// Les identifiants sont stables : ils sont enregistrés côté serveur (validation par motif) et un
// identifiant inconnu retombe sur le style Sprinter au rendu.
import type { IconName } from '../ui/components';

export interface ProfileTheme {
  id: string;
  label: string;
  background: string;
  surface: string;
  text: string;
  muted: string;
  accent: string;
  accentInk: string;
  line: string;
  banner: [string, string];
  dark: boolean;
}

const theme = (id: string, label: string, dark: boolean, background: string, surface: string, text: string, muted: string,
  accent: string, accentInk: string, line: string, banner: [string, string]): ProfileTheme =>
  ({ id, label, dark, background, surface, text, muted, accent, accentInk, line, banner });

/** Le thème Sprinter suit le mode clair ou sombre de l'app ; les autres univers ont leur propre palette. */
export const SPRINTER_DARK = theme('sprinter', 'Sprinter', true, '#101011', '#1C1C1F', '#F4F4F5', '#A6A6AE', '#19C7B0', '#101011', '#2E2E33', ['#19C7B0', '#0B3D36']);
export const SPRINTER_LIGHT = theme('sprinter', 'Sprinter', false, '#F6F6F7', '#FFFFFF', '#111113', '#55555C', '#0E7164', '#FFFFFF', '#E1E1E4', ['#107F70', '#9FE7DD']);

export const THEMES: ProfileTheme[] = [
  SPRINTER_DARK,
  theme('espace', 'Espace', true, '#0B1026', '#151B3B', '#EEF0FF', '#A9B0D6', '#8D96FC', '#0B1026', '#262D57', ['#1B1F5E', '#6A3FB5']),
  theme('cyberpunk', 'Cyberpunk', true, '#0D0221', '#1A0B3A', '#F5F1FF', '#BFB0E0', '#FF4FA8', '#0D0221', '#33205E', ['#FF2E97', '#00C2D1']),
  theme('nature', 'Nature', false, '#F3F6EE', '#FFFFFF', '#1C2A17', '#4F5E48', '#2F6B2A', '#FFFFFF', '#DCE5D3', ['#7FB069', '#2F6B2A']),
  theme('retro', 'Rétro', false, '#FFF4E0', '#FFFBF2', '#3B2416', '#6E4F3A', '#A8401F', '#FFFFFF', '#F1DFC0', ['#F4A259', '#BC4B51']),
  theme('pixel', 'Pixel art', true, '#1D1F33', '#2A2D47', '#F2F2F2', '#B7B9D1', '#7CE38B', '#1D1F33', '#3B3F62', ['#5B6EE1', '#7CE38B']),
  theme('minimaliste', 'Minimaliste', false, '#FFFFFF', '#F4F4F5', '#18181B', '#52525B', '#18181B', '#FFFFFF', '#E4E4E7', ['#E4E4E7', '#A1A1AA']),
  theme('neon', 'Néon', true, '#050505', '#121212', '#F7F7F7', '#ABABAB', '#39FF14', '#050505', '#262626', ['#39FF14', '#00E5FF']),
  theme('sombre', 'Sombre', true, '#000000', '#141414', '#EDEDED', '#A3A3A3', '#C9C9C9', '#000000', '#2A2A2A', ['#2B2B2B', '#5A5A5A']),
  theme('pastel', 'Pastel', false, '#FFF7FB', '#FFFFFF', '#2D2433', '#5F5468', '#8E4FA8', '#FFFFFF', '#F1E4EE', ['#FBC8D4', '#C5B8F0']),
];

/** Couleurs d'accent du catalogue, déclinées pour fond sombre et fond clair (contraste vérifié en test). */
export const ACCENTS: { id: string; label: string; onDark: string; onLight: string }[] = [
  { id: 'menthe', label: 'Menthe', onDark: '#19C7B0', onLight: '#0E7164' },
  { id: 'citron', label: 'Citron vert', onDark: '#C6F135', onLight: '#566907' },
  { id: 'indigo', label: 'Indigo', onDark: '#8D96FC', onLight: '#2F3FE0' },
  { id: 'rose', label: 'Rose', onDark: '#FF7AB6', onLight: '#B0215F' },
  { id: 'orange', label: 'Orange', onDark: '#FF9F43', onLight: '#A34A00' },
  { id: 'ciel', label: 'Ciel', onDark: '#5BC0FF', onLight: '#00639E' },
  { id: 'violet', label: 'Violet', onDark: '#C08CFF', onLight: '#6B2FB3' },
  { id: 'or', label: 'Or', onDark: '#F5C542', onLight: '#7A5A00' },
];

export const AVATARS: { id: string; label: string; icon: IconName; colors: [string, string] }[] = [
  { id: 'eclair', label: 'Éclair', icon: 'flash', colors: ['#19C7B0', '#0B3D36'] },
  { id: 'fusee', label: 'Fusée', icon: 'rocket', colors: ['#6A3FB5', '#1B1F5E'] },
  { id: 'feuille', label: 'Feuille', icon: 'leaf', colors: ['#7FB069', '#2F6B2A'] },
  { id: 'planete', label: 'Planète', icon: 'planet', colors: ['#8D96FC', '#151B3B'] },
  { id: 'flamme', label: 'Flamme', icon: 'flame', colors: ['#FF9F43', '#BC4B51'] },
  { id: 'etoile', label: 'Étoile', icon: 'star', colors: ['#F5C542', '#A8401F'] },
  { id: 'coeur', label: 'Cœur', icon: 'heart', colors: ['#FF7AB6', '#8E4FA8'] },
  { id: 'patte', label: 'Patte', icon: 'paw', colors: ['#C08CFF', '#3B3F62'] },
  { id: 'manette', label: 'Manette', icon: 'game-controller', colors: ['#5B6EE1', '#1D1F33'] },
  { id: 'musique', label: 'Musique', icon: 'musical-notes', colors: ['#FF2E97', '#0D0221'] },
  { id: 'trophee', label: 'Trophée', icon: 'trophy', colors: ['#C6F135', '#566907'] },
  { id: 'soleil', label: 'Soleil', icon: 'sunny', colors: ['#F4A259', '#F5C542'] },
];

export const BANNERS: { id: string; label: string; colors: [string, string]; icon?: IconName }[] = [
  { id: 'aube', label: 'Aube', colors: ['#F4A259', '#8E4FA8'] },
  { id: 'piste', label: 'Piste', colors: ['#BC4B51', '#5B2333'], icon: 'flag' },
  { id: 'foret', label: 'Forêt', colors: ['#2F6B2A', '#0F2A10'], icon: 'leaf' },
  { id: 'ocean', label: 'Océan', colors: ['#00639E', '#5BC0FF'], icon: 'water' },
  { id: 'cosmos', label: 'Cosmos', colors: ['#0B1026', '#6A3FB5'], icon: 'planet' },
  { id: 'neon', label: 'Néon', colors: ['#39FF14', '#00E5FF'], icon: 'flash' },
  { id: 'nuit', label: 'Nuit', colors: ['#141414', '#3B3F62'], icon: 'moon' },
];

/** Couleurs proposées pour une bannière unie ou en dégradé. */
export const SWATCHES = ['#19C7B0', '#0E7164', '#C6F135', '#8D96FC', '#3B4BFF', '#FF7AB6', '#B0215F', '#FF9F43',
  '#F5C542', '#2F6B2A', '#00639E', '#6A3FB5', '#101011', '#5A5A5A', '#F4F4F5', '#FFF4E0'];

export function findTheme(id: string | undefined, dark: boolean): ProfileTheme {
  if (!id || id === 'sprinter') return dark ? SPRINTER_DARK : SPRINTER_LIGHT;
  return THEMES.find((item) => item.id === id) ?? (dark ? SPRINTER_DARK : SPRINTER_LIGHT);
}

// ---------------------------------------------------------------------------------------
// Lisibilité (§17.8) : contraste WCAG et correction par couleur de secours.
// ---------------------------------------------------------------------------------------
function luminance(hex: string) {
  const value = Number.parseInt(hex.slice(1, 7), 16);
  const channel = (shift: number) => {
    const srgb = ((value >> shift) & 255) / 255;
    return srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(16) + 0.7152 * channel(8) + 0.0722 * channel(0);
}
export function contrastRatio(first: string, second: string) {
  const a = luminance(first), b = luminance(second);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}
/** Couleur de texte lisible sur un fond : la préférée si elle passe, sinon noir ou blanc. */
export function readableOn(background: string, preferred: string, minimum = 4.5) {
  if (contrastRatio(preferred, background) >= minimum) return preferred;
  return contrastRatio('#FFFFFF', background) >= contrastRatio('#101011', background) ? '#FFFFFF' : '#101011';
}

/** Thème effectif : univers choisi, accent éventuel, puis vérification de lisibilité. */
export function resolveTheme(themeId: string | undefined, accentId: string | undefined, appDark: boolean): ProfileTheme {
  const base = findTheme(themeId, appDark);
  const accent = ACCENTS.find((item) => item.id === accentId);
  if (!accent) return base;
  const color = base.dark ? accent.onDark : accent.onLight;
  const usable = contrastRatio(color, base.surface) >= 3 ? color : base.accent;
  return { ...base, accent: usable, accentInk: readableOn(usable, base.dark ? '#101011' : '#FFFFFF') };
}
