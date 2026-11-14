// Bibliothèque de thèmes et thèmes de saison (8d, §17.11) : logique pure.
// Un thème ne contient que des paramètres visuels et des références au catalogue : jamais de photo,
// de texte personnel, de lien, de statistique, de badge officiel ni de valeur de widget.
import type { AppearancePayload, AvatarPayload, BannerPayload, DecorationsPayload, Payload, ProfileDoc } from './model';

export interface ThemeStyle {
  appearance?: AppearancePayload; banner?: BannerPayload; avatar?: Pick<AvatarPayload, 'shape' | 'frame' | 'halo'>;
  decorations?: Pick<DecorationsPayload, 'icon' | 'plate' | 'card' | 'entry'>;
}
export const THEME_CATEGORIES = [
  ['espace', 'Espace'], ['cyberpunk', 'Cyberpunk'], ['nature', 'Nature'], ['retro', 'Rétro'], ['pixel', 'Pixel art'], ['minimaliste', 'Minimaliste'],
  ['neon', 'Néon'], ['sombre', 'Sombre'], ['pastel', 'Pastel'], ['saisonnier', 'Saisonnier'], ['autre', 'Autre'],
] as const;
export type ThemeCategory = (typeof THEME_CATEGORIES)[number][0];

const pick = <T extends object>(value: T | null | undefined, keys: readonly string[]) => {
  if (!value) return undefined;
  const out = Object.fromEntries(Object.entries(value).filter(([key, item]) => keys.includes(key) && item !== undefined));
  return Object.keys(out).length ? out : undefined;
};

/** Style partageable du profil courant. */
export function styleFromDoc(doc: ProfileDoc): ThemeStyle {
  const banner = doc.banner as BannerPayload | null | undefined;
  const style: ThemeStyle = {};
  if (doc.appearance) style.appearance = doc.appearance as unknown as AppearancePayload;
  // Une bannière photo n'est jamais partagée : seul son voile éventuel est gardé, sur la bannière du thème.
  if (banner && banner.source !== 'media') style.banner = pick(banner, ['source', 'presetId', 'colors', 'veil', 'particles']) as unknown as BannerPayload;
  else if (banner?.veil || banner?.particles) style.banner = pick({ source: 'default', veil: banner.veil, particles: banner.particles }, ['source', 'veil', 'particles']) as unknown as BannerPayload;
  const avatar = pick(doc.avatar as AvatarPayload | null | undefined, ['shape', 'frame', 'halo']);
  if (avatar) style.avatar = avatar as ThemeStyle['avatar'];
  const decorations = pick(doc.decorations as DecorationsPayload | null | undefined, ['icon', 'plate', 'card', 'entry']);
  if (decorations) style.decorations = decorations as ThemeStyle['decorations'];
  return style;
}

/** Appliquer un thème = en faire une copie indépendante dans le brouillon ; contenus et images restent ceux du titulaire. */
export function applyStyle(doc: ProfileDoc, style: ThemeStyle): { key: string; payload: Payload | null }[] {
  const avatar = { ...((doc.avatar as Payload | null | undefined) ?? { source: 'default' }) };
  for (const key of ['shape', 'frame', 'halo']) delete avatar[key];
  Object.assign(avatar, style.avatar ?? {});
  const currentBanner = doc.banner as BannerPayload | null | undefined;
  const banner = style.banner ? (currentBanner?.source === 'media' ? { ...currentBanner, veil: style.banner.veil, particles: style.banner.particles } : { ...style.banner }) : currentBanner?.source === 'media' ? currentBanner : null;
  if (banner) for (const key of Object.keys(banner) as (keyof BannerPayload)[]) if (banner[key] === undefined) delete banner[key];
  const decorations = { ...((doc.decorations as Payload | null | undefined) ?? {}) };
  for (const key of ['icon', 'plate', 'card', 'entry']) delete decorations[key];
  Object.assign(decorations, style.decorations ?? {});
  const changes = [
    { key: 'appearance', payload: (style.appearance as Payload | undefined) ?? null },
    { key: 'banner', payload: (banner as Payload | null) ?? null },
    { key: 'avatar', payload: avatar.source === 'default' && Object.keys(avatar).length === 1 ? null : avatar },
    { key: 'decorations', payload: Object.keys(decorations).length ? decorations : null },
  ];
  return changes.filter((change) => JSON.stringify(change.payload) !== JSON.stringify(doc[change.key] ?? null));
}

/** Thèmes de saison (§17.11) : proposés seulement pendant leur période (mois 1 à 12, bornes incluses). */
export const SEASONS = [
  { id: 'hiver', label: 'Hiver', from: 12, to: 2 }, { id: 'printemps', label: 'Printemps', from: 3, to: 5 },
  { id: 'ete', label: 'Été', from: 6, to: 8 }, { id: 'automne', label: 'Automne', from: 9, to: 11 },
] as const;
export function currentSeason(now: number) {
  const month = new Date(now).getMonth() + 1;
  return SEASONS.find((season) => (season.from <= season.to ? month >= season.from && month <= season.to : month >= season.from || month <= season.to))!;
}
