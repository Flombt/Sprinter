// Modèle du profil personnalisé (§17). Un profil est un ensemble d'éléments indépendants ; un élément
// absent ou supprimé reprend sa valeur par défaut (thème Sprinter, avatar de remplacement, profil vide).
// La validation reflète celle du serveur (0015_profiles.sql) pour signaler un problème avant l'envoi.
import type { RunRecord } from '../core/types';

export type Kind = 'identity' | 'appearance' | 'avatar' | 'banner' | 'about' | 'status' | 'layout' | 'widget' | 'decorations' | 'badges' | 'statuses' | 'config';
export type Payload = Record<string, unknown>;
export interface Crop { x: number; y: number; zoom: number }
export interface IdentityPayload { name?: string }
export type FontId = 'system' | 'serif' | 'mono' | 'rounded';
export interface AppearancePayload {
  theme: string; accent?: string; colors?: { accent?: string; secondary?: string; background?: string; surface?: string };
  font?: FontId; cards?: 'flat' | 'outlined' | 'raised'; buttons?: 'pill' | 'rounded' | 'square'; frame?: boolean;
}
export interface AvatarPayload {
  source: 'default' | 'library' | 'media'; libraryId?: string; mediaId?: string; posterId?: string; crop?: Crop;
  shape?: 'circle' | 'rounded' | 'square'; frame?: 'none' | 'thin' | 'thick' | 'double' | 'gradient'; halo?: boolean;
}
export interface BannerPayload {
  source: 'default' | 'preset' | 'color' | 'gradient' | 'media'; presetId?: string; colors?: string[]; mediaId?: string; posterId?: string; crop?: Crop;
  veil?: number; particles?: boolean;
}
export interface AboutPayload { bio?: string; long?: string; quote?: string }
export interface StatusPayload { emoji?: string; text?: string; expiresAt?: string | null }
export interface LayoutPayload { order: string[] }
export type StatId = 'seniority' | 'runs' | 'distance' | 'best_effort';
export type WidgetType = 'text' | 'interests' | 'stats' | 'goal' | 'gallery' | 'links' | 'mood' | 'counter' | 'favorites';
export type GoalSource = 'manual' | 'distance_year' | 'distance_month' | 'runs_year' | 'runs_month';
export interface WidgetPayload {
  type: WidgetType; title?: string; size?: 'compact' | 'wide';
  text?: string; tags?: string[]; stats?: StatId[];
  label?: string; target?: number; unit?: 'km' | 'courses' | 'minutes' | 'jours' | 'autre'; progress?: number; source?: GoalSource;
  images?: { mediaId: string; alt: string }[]; links?: { label: string; url: string }[];
  emoji?: string; message?: string; value?: number; items?: { kind: 'theme' | 'avatar' | 'banner'; id: string }[];
}
export interface DecorationsPayload { title?: string; icon?: string; plate?: string; card?: string; entry?: 'none' | 'fade' | 'slide' }
export interface BadgesPayload { show: string[] }
export interface StatusesPayload { items: { emoji?: string; text?: string }[] }
export interface ConfigPayload {
  name: string; appearance?: AppearancePayload; avatar?: Pick<AvatarPayload, 'shape' | 'frame' | 'halo'>; banner?: BannerPayload;
  decorations?: DecorationsPayload; order?: string[]; sizes?: Record<string, 'compact' | 'wide'>;
}

/** Contenu courant d'un profil : clé → contenu, ou null pour la valeur par défaut. */
export type ProfileDoc = Record<string, Payload | null>;

export const LIMITS = {
  widgets: 8, bio: 190, statusText: 80, statusEmoji: 16, name: 40, widgetTitle: 40, widgetText: 280, tags: 12, tagLength: 24, stats: 4,
  configurations: 5, gallery: 5, links: 5, statusTemplates: 10, long: 1000, quote: 140, decorationTitle: 24, imageBytes: 5 * 1024 * 1024, animationBytes: 8 * 1024 * 1024,
} as const;
export const BASE_KEYS = ['identity', 'appearance', 'avatar', 'banner', 'about', 'status', 'layout'] as const;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const KEY = /^(identity|appearance|avatar|banner|about|status|layout|decorations|badges|statuses|(widget|config):[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/;
const ID = /^[a-z0-9-]{1,32}$/;
const HEX = /^#[0-9a-fA-F]{6}$/;
const CONTROL = /[\u0001-\u0008\u000b\u000c\u000e-\u001f\u007f]/;
export const STAT_IDS: StatId[] = ['seniority', 'runs', 'distance', 'best_effort'];

export const isElementKey = (key: string) => KEY.test(key);
export const kindOf = (key: string) => key.split(':')[0] as Kind;
export const widgetKey = (uuid: string) => `widget:${uuid.toLowerCase()}`;
export const configKey = (uuid: string) => `config:${uuid.toLowerCase()}`;

const keysOk = (payload: Payload, allowed: string[]) => Object.keys(payload).every((key) => allowed.includes(key));
const textOk = (value: unknown, max: number) => value === undefined || value === null
  || (typeof value === 'string' && [...value].length <= max && !CONTROL.test(value));
const between = (value: unknown, min: number, max: number) => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
const cropOk = (value: unknown) => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const crop = value as Payload;
  return keysOk(crop, ['x', 'y', 'zoom']) && (crop.x === undefined || between(crop.x, -1, 1))
    && (crop.y === undefined || between(crop.y, -1, 1)) && (crop.zoom === undefined || between(crop.zoom, 1, 4));
};
const idOk = (value: unknown) => typeof value === 'string' && ID.test(value);
const uuidOk = (value: unknown) => typeof value === 'string' && UUID.test(value);
const stringsOk = (value: unknown, maxItems: number, maxLength: number) => Array.isArray(value) && value.length <= maxItems
  && value.every((item) => typeof item === 'string' && item.length > 0 && textOk(item, maxLength));

const HTTPS = /^https:\/\/[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+(:[0-9]{2,5})?(\/[^\s<>"]*)?$/;
const BADGE_IDS = ['membre_1an', 'membre_3ans', 'courses_10', 'courses_100', 'distance_100', 'distance_1000', 'classement'];
const oneOf = (value: unknown, allowed: readonly string[]) => typeof value === 'string' && allowed.includes(value);
const objectOk = (value: unknown): value is Payload => typeof value === 'object' && value !== null && !Array.isArray(value);
const filledText = (value: unknown, max: number) => typeof value === 'string' && value.trim().length > 0 && textOk(value, max);
const WIDGET_KEYS: Record<WidgetType, string[]> = {
  text: ['text'], interests: ['tags'], stats: ['stats'], goal: ['label', 'target', 'unit', 'progress', 'source'], gallery: ['images'],
  links: ['links'], mood: ['emoji', 'message'], counter: ['label', 'value', 'unit'], favorites: ['items'],
};
const ESSENTIAL_WIDGETS: WidgetType[] = ['text', 'interests', 'stats'];

/** Les réglages propres au studio (8b) sont refusés tant que le studio est coupé, comme côté serveur. */
function studioOnly(kind: Kind, payload: Payload): boolean {
  const has = (...keys: string[]) => keys.some((key) => key in payload);
  return ['decorations', 'badges', 'statuses', 'config'].includes(kind)
    || (kind === 'appearance' && !keysOk(payload, ['theme', 'accent']))
    || (kind === 'avatar' && has('shape', 'frame', 'halo', 'posterId'))
    || (kind === 'banner' && has('veil', 'particles', 'posterId'))
    || (kind === 'about' && has('long', 'quote'))
    || (kind === 'widget' && (!ESSENTIAL_WIDGETS.includes(payload.type as WidgetType) || has('size')));
}

/** null si le contenu est valide, sinon le même code court que le serveur (0015 et 0016). */
export function validatePayload(kind: Kind, payload: Payload, studio = true): string | null {
  if (!objectOk(payload)) return 'payload_type';
  if (new TextEncoder().encode(JSON.stringify(payload)).length > (kind === 'config' ? 6144 : 4096)) return 'payload_size';
  if (!studio && studioOnly(kind, payload)) return 'studio_disabled';
  const source = payload.source;
  switch (kind) {
    case 'identity': return keysOk(payload, ['name']) && textOk(payload.name, LIMITS.name) ? null : 'identity';
    case 'appearance': {
      const colors = payload.colors;
      return keysOk(payload, ['theme', 'accent', 'colors', 'font', 'cards', 'buttons', 'frame']) && idOk(payload.theme)
        && (payload.accent === undefined || idOk(payload.accent))
        && (colors === undefined || (objectOk(colors) && keysOk(colors, ['accent', 'secondary', 'background', 'surface'])
          && Object.values(colors).every((color) => typeof color === 'string' && HEX.test(color))))
        && (payload.font === undefined || oneOf(payload.font, ['system', 'serif', 'mono', 'rounded']))
        && (payload.cards === undefined || oneOf(payload.cards, ['flat', 'outlined', 'raised']))
        && (payload.buttons === undefined || oneOf(payload.buttons, ['pill', 'rounded', 'square']))
        && (payload.frame === undefined || typeof payload.frame === 'boolean') ? null : 'appearance';
    }
    case 'avatar': return keysOk(payload, ['source', 'libraryId', 'mediaId', 'posterId', 'crop', 'shape', 'frame', 'halo'])
      && oneOf(source, ['default', 'library', 'media'])
      && (source !== 'library' || idOk(payload.libraryId)) && (source === 'media' ? uuidOk(payload.mediaId) : payload.mediaId === undefined && payload.posterId === undefined)
      && (payload.posterId === undefined || uuidOk(payload.posterId)) && (payload.crop === undefined || cropOk(payload.crop))
      && (payload.shape === undefined || oneOf(payload.shape, ['circle', 'rounded', 'square']))
      && (payload.frame === undefined || oneOf(payload.frame, ['none', 'thin', 'thick', 'double', 'gradient']))
      && (payload.halo === undefined || typeof payload.halo === 'boolean') ? null : 'avatar';
    case 'banner': {
      const colors = payload.colors;
      const colorsOk = Array.isArray(colors) && colors.length >= (source === 'color' ? 1 : 2) && colors.length <= 3 && colors.every((color) => typeof color === 'string' && HEX.test(color));
      return keysOk(payload, ['source', 'presetId', 'colors', 'mediaId', 'posterId', 'crop', 'veil', 'particles'])
        && oneOf(source, ['default', 'preset', 'color', 'gradient', 'media'])
        && (source !== 'preset' || idOk(payload.presetId)) && (!(source === 'color' || source === 'gradient') || colorsOk)
        && (source === 'media' ? uuidOk(payload.mediaId) : payload.mediaId === undefined && payload.posterId === undefined)
        && (payload.posterId === undefined || uuidOk(payload.posterId)) && (payload.crop === undefined || cropOk(payload.crop))
        && (payload.veil === undefined || between(payload.veil, 0, 0.6)) && (payload.particles === undefined || typeof payload.particles === 'boolean') ? null : 'banner';
    }
    case 'about': return keysOk(payload, ['bio', 'long', 'quote']) && textOk(payload.bio, LIMITS.bio) && textOk(payload.long, LIMITS.long)
      && textOk(payload.quote, LIMITS.quote) ? null : 'about';
    case 'status': {
      const filled = [payload.emoji, payload.text].some((value) => typeof value === 'string' && value.trim().length > 0);
      const expiry = payload.expiresAt;
      const expiryOk = expiry === undefined || expiry === null || (typeof expiry === 'string' && !Number.isNaN(Date.parse(expiry)));
      return keysOk(payload, ['emoji', 'text', 'expiresAt']) && textOk(payload.emoji, LIMITS.statusEmoji) && textOk(payload.text, LIMITS.statusText)
        && filled && expiryOk ? null : 'status';
    }
    case 'statuses': {
      const items = payload.items;
      return keysOk(payload, ['items']) && Array.isArray(items) && items.length <= LIMITS.statusTemplates
        && items.every((item) => objectOk(item) && keysOk(item, ['emoji', 'text']) && textOk(item.emoji, LIMITS.statusEmoji) && textOk(item.text, LIMITS.statusText)
          && (filledText(item.emoji, LIMITS.statusEmoji) || filledText(item.text, LIMITS.statusText))) ? null : 'statuses';
    }
    case 'layout': {
      const order = payload.order;
      return keysOk(payload, ['order']) && Array.isArray(order) && order.length <= LIMITS.widgets
        && order.every((key) => typeof key === 'string' && key.startsWith('widget:') && KEY.test(key)) && new Set(order).size === order.length ? null : 'layout';
    }
    case 'decorations': return keysOk(payload, ['title', 'icon', 'plate', 'card', 'entry']) && textOk(payload.title, LIMITS.decorationTitle)
      && !(typeof payload.title === 'string' && /(officiel|certifi|vérifi|verifi|sprinter)/i.test(payload.title))
      && (payload.icon === undefined || idOk(payload.icon))
      && (payload.plate === undefined || (idOk(payload.plate) && !/^(officiel|official|badge|sprinter)/.test(payload.plate as string)))
      && (payload.card === undefined || idOk(payload.card)) && (payload.entry === undefined || oneOf(payload.entry, ['none', 'fade', 'slide'])) ? null : 'decorations';
    case 'badges': {
      const show = payload.show;
      return keysOk(payload, ['show']) && Array.isArray(show) && show.length <= 6 && show.every((id) => oneOf(id, BADGE_IDS)) ? null : 'badges';
    }
    case 'config': {
      if (!keysOk(payload, ['name', 'appearance', 'avatar', 'banner', 'decorations', 'order', 'sizes']) || !filledText(payload.name, 40)) return 'config';
      if (payload.appearance !== undefined && validatePayload('appearance', payload.appearance as Payload)) return 'config';
      if (payload.banner !== undefined && validatePayload('banner', payload.banner as Payload)) return 'config';
      if (payload.decorations !== undefined && validatePayload('decorations', payload.decorations as Payload)) return 'config';
      if (payload.avatar !== undefined && (!objectOk(payload.avatar) || !keysOk(payload.avatar, ['shape', 'frame', 'halo'])
        || validatePayload('avatar', { ...payload.avatar, source: 'default' }))) return 'config';
      if (payload.order !== undefined && validatePayload('layout', { order: payload.order })) return 'config';
      const sizes = payload.sizes;
      if (sizes !== undefined && !(objectOk(sizes) && Object.entries(sizes).every(([key, size]) => KEY.test(key) && key.startsWith('widget:') && oneOf(size, ['compact', 'wide'])))) return 'config';
      return null;
    }
    case 'widget': {
      const type = payload.type as WidgetType;
      const allowed = WIDGET_KEYS[type];
      if (!allowed || !keysOk(payload, ['type', 'title', 'size', ...allowed]) || !textOk(payload.title, LIMITS.widgetTitle)
        || (payload.size !== undefined && !oneOf(payload.size, ['compact', 'wide']))) return 'widget';
      const stats = payload.stats, images = payload.images, links = payload.links, items = payload.items;
      const ok = {
        text: () => textOk(payload.text, LIMITS.widgetText),
        interests: () => payload.tags === undefined || stringsOk(payload.tags, LIMITS.tags, LIMITS.tagLength),
        stats: () => stats === undefined || (Array.isArray(stats) && stats.length <= LIMITS.stats && stats.every((stat) => STAT_IDS.includes(stat as StatId)) && new Set(stats).size === stats.length),
        goal: () => textOk(payload.label, 60) && (payload.target === undefined || between(payload.target, 0.01, 1_000_000))
          && (payload.progress === undefined || between(payload.progress, 0, 1_000_000)) && (payload.unit === undefined || oneOf(payload.unit, ['km', 'courses', 'minutes', 'jours', 'autre']))
          && (payload.source === undefined || oneOf(payload.source, ['manual', 'distance_year', 'distance_month', 'runs_year', 'runs_month'])),
        gallery: () => images === undefined || (Array.isArray(images) && images.length <= LIMITS.gallery
          && images.every((image) => objectOk(image) && keysOk(image, ['mediaId', 'alt']) && uuidOk(image.mediaId) && filledText(image.alt, 140))),
        links: () => links === undefined || (Array.isArray(links) && links.length <= LIMITS.links
          && links.every((link) => objectOk(link) && keysOk(link, ['label', 'url']) && textOk(link.label, 40) && typeof link.url === 'string' && link.url.length <= 200 && HTTPS.test(link.url))),
        mood: () => textOk(payload.emoji, LIMITS.statusEmoji) && textOk(payload.message, 140),
        counter: () => textOk(payload.label, 40) && textOk(payload.unit, 16) && (payload.value === undefined || between(payload.value, -1e9, 1e9)),
        favorites: () => items === undefined || (Array.isArray(items) && items.length <= 6
          && items.every((item) => objectOk(item) && keysOk(item, ['kind', 'id']) && oneOf(item.kind, ['theme', 'avatar', 'banner']) && idOk(item.id))),
      }[type];
      return ok() ? null : 'widget';
    }
  }
  return 'kind';
}

/** Médias référencés par un contenu (avatar, bannière). */
export function payloadMedia(payload: Payload | null | undefined): string[] {
  if (!payload) return [];
  const banner = payload.banner as Payload | undefined;
  const images = Array.isArray(payload.images) ? (payload.images as Payload[]).map((image) => image?.mediaId) : [];
  return [...new Set([payload.mediaId, payload.posterId, banner?.mediaId, banner?.posterId, ...images]
    .filter((id): id is string => typeof id === 'string' && UUID.test(id)))];
}

// ---------------------------------------------------------------------------------------
// Statut (§17.4) : permanent ou avec expiration automatique, sur tous les appareils.
// ---------------------------------------------------------------------------------------
export type StatusDuration = 'permanent' | '30m' | '1h' | '4h' | 'today' | '1w';
export const STATUS_DURATIONS: { value: StatusDuration; label: string }[] = [
  { value: 'permanent', label: 'Sans limite' }, { value: '30m', label: '30 min' }, { value: '1h', label: '1 h' },
  { value: '4h', label: '4 h' }, { value: 'today', label: 'Aujourd’hui' }, { value: '1w', label: '7 jours' },
];
export function statusExpiry(duration: StatusDuration, now: number): string | null {
  const minutes = { '30m': 30, '1h': 60, '4h': 240, '1w': 7 * 24 * 60 } as const;
  if (duration === 'permanent') return null;
  if (duration === 'today') { const end = new Date(now); end.setHours(23, 59, 59, 0); return end.toISOString(); }
  return new Date(now + minutes[duration] * 60_000).toISOString();
}
/** Statut à afficher, ou null s'il est vide ou expiré. */
export function activeStatus(payload: Payload | null | undefined, now: number): StatusPayload | null {
  if (!payload) return null;
  const status = payload as StatusPayload;
  if (status.expiresAt && Date.parse(status.expiresAt) <= now) return null;
  return (status.emoji?.trim() || status.text?.trim()) ? status : null;
}

// ---------------------------------------------------------------------------------------
// Disposition des widgets (§17.5) : ordre défini par le titulaire, une colonne sur petit écran.
// ---------------------------------------------------------------------------------------
export function widgetKeys(doc: ProfileDoc): string[] {
  return Object.keys(doc).filter((key) => key.startsWith('widget:') && doc[key]).sort();
}
export function orderedWidgets(doc: ProfileDoc): string[] {
  const present = widgetKeys(doc);
  const order = ((doc.layout as LayoutPayload | null)?.order ?? []).filter((key) => present.includes(key));
  return [...order, ...present.filter((key) => !order.includes(key))];
}
export function moveInOrder(order: string[], key: string, delta: number): string[] {
  const from = order.indexOf(key), to = from + delta;
  if (from < 0 || to < 0 || to >= order.length) return order;
  const next = [...order];
  next.splice(from, 1);
  next.splice(to, 0, key);
  return next;
}

// ---------------------------------------------------------------------------------------
// Statistiques privées calculées sur cet appareil (§17.5) : période et définition affichées.
// ---------------------------------------------------------------------------------------
export interface StatValue { id: StatId; label: string; value: string; definition: string }
const MIN_DISTANCE = 1000, MIN_SECONDS = 300;
export function computeStats(history: RunRecord[], ids: StatId[], now: number): StatValue[] {
  const runs = history.filter((run) => run.endedAt !== null && !run.healthKit && run.distanceMeters >= MIN_DISTANCE && run.activeSeconds >= MIN_SECONDS);
  const first = runs.reduce<number | null>((min, run) => (min === null || run.startedAt < min ? run.startedAt : min), null);
  const best5k = runs.reduce<number | null>((best, run) => {
    const seconds = run.bestEfforts?.['5000'];
    return typeof seconds === 'number' && (best === null || seconds < best) ? seconds : best;
  }, null);
  const definition = 'Courses Sprinter enregistrées sur cet appareil, d’au moins 1 km et 5 min, depuis la première.';
  const out: Record<StatId, StatValue> = {
    seniority: { id: 'seniority', label: 'Coureur depuis', definition: 'Date de la première course Sprinter enregistrée sur cet appareil.',
      value: first === null ? '—' : new Date(first).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }) },
    runs: { id: 'runs', label: 'Courses', definition, value: runs.length.toLocaleString('fr-FR') },
    distance: { id: 'distance', label: 'Distance cumulée', definition,
      value: `${(runs.reduce((sum, run) => sum + run.distanceMeters, 0) / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 0 })} km` },
    best_effort: { id: 'best_effort', label: 'Meilleur 5 km', definition: 'Meilleur segment de 5 km mesuré par le GPS sur cet appareil.',
      value: best5k === null ? '—' : `${Math.floor(best5k / 60)} min ${String(Math.round(best5k % 60)).padStart(2, '0')} s` },
  };
  void now;
  return ids.map((id) => out[id]);
}

export const STAT_LABELS: Record<StatId, string> = { seniority: 'Ancienneté', runs: 'Nombre de courses', distance: 'Distance cumulée', best_effort: 'Meilleur 5 km' };
export const WIDGET_LABELS: Record<WidgetType, string> = {
  text: 'Texte libre', interests: 'Centres d’intérêt', stats: 'Statistiques', goal: 'Objectif', gallery: 'Galerie', links: 'Liens',
  mood: 'Humeur', counter: 'Compteur', favorites: 'Favoris',
};
export const ESSENTIAL_WIDGET_TYPES = ESSENTIAL_WIDGETS;
export const ELEMENT_LABELS: Record<Kind, string> = {
  identity: 'Nom de présentation', appearance: 'Apparence', avatar: 'Avatar', banner: 'Bannière', about: 'Présentation',
  status: 'Statut', layout: 'Disposition des widgets', widget: 'Widget', decorations: 'Décorations', badges: 'Badges affichés',
  statuses: 'Statuts enregistrés', config: 'Configuration',
};

// ---------------------------------------------------------------------------------------
// Studio avancé (8b) : historique d'édition, styles par défaut et configurations.
// ---------------------------------------------------------------------------------------
export interface EditStep { key: string; before: Payload | null; after: Payload | null }
/** Annuler / Rétablir pendant une session d'édition (les étapes portent la valeur avant et après). */
export class EditHistory {
  private past: EditStep[][] = [];
  private future: EditStep[][] = [];
  constructor(private limit = 50) {}
  record(steps: EditStep[]) {
    const useful = steps.filter((step) => JSON.stringify(step.before) !== JSON.stringify(step.after));
    if (!useful.length) return;
    this.past.push(useful);
    if (this.past.length > this.limit) this.past.shift();
    this.future = [];
  }
  undo(): EditStep[] | null {
    const steps = this.past.pop();
    if (!steps) return null;
    this.future.push(steps);
    return [...steps].reverse().map((step) => ({ key: step.key, before: step.after, after: step.before }));
  }
  redo(): EditStep[] | null {
    const steps = this.future.pop();
    if (!steps) return null;
    this.past.push(steps);
    return steps;
  }
  get canUndo() { return this.past.length > 0; }
  get canRedo() { return this.future.length > 0; }
}

const STYLE_AVATAR = ['shape', 'frame', 'halo'] as const;
const STYLE_BANNER = ['veil', 'particles'] as const;
const strip = (payload: Payload | null | undefined, keys: readonly string[]): Payload | null => {
  if (!payload) return null;
  const next = { ...payload };
  for (const key of keys) delete next[key];
  return next;
};
const cleanAvatar = (payload: Payload | null) => (payload && payload.source === 'default' && Object.keys(payload).length === 1 ? null : payload);

/** « Restaurer l'apparence par défaut » : thème, couleurs, typographie, décorations et effets. Images, textes,
 *  statut, widgets et choix de partage restent inchangés (§17.2 n° 3). Renvoie les changements à appliquer. */
export function restoreDefaultStyle(doc: ProfileDoc): { key: string; payload: Payload | null }[] {
  return [
    { key: 'appearance', payload: null },
    { key: 'decorations', payload: null },
    { key: 'avatar', payload: cleanAvatar(strip(doc.avatar, STYLE_AVATAR)) },
    { key: 'banner', payload: strip(doc.banner, STYLE_BANNER) },
  ].filter((change) => JSON.stringify(change.payload) !== JSON.stringify(doc[change.key] ?? null));
}
export const DEFAULT_STYLE_SCOPE = 'Thème, couleurs, typographie, cartes, décorations et effets de l’avatar et de la bannière reviennent au style Sprinter. '
  + 'Votre avatar, votre bannière, votre présentation, votre statut, vos widgets et vos choix de partage restent inchangés.';

/** Configuration : apparence et disposition, jamais le contenu (textes, images d'avatar, statut). */
export function captureConfiguration(doc: ProfileDoc, name: string): ConfigPayload {
  const avatar = doc.avatar as AvatarPayload | null | undefined;
  const avatarStyle = Object.fromEntries(STYLE_AVATAR.filter((key) => avatar?.[key] !== undefined).map((key) => [key, avatar![key]]));
  const order = orderedWidgets(doc);
  const sizes = Object.fromEntries(order.map((key) => [key, ((doc[key] as WidgetPayload | null)?.size ?? 'compact')])) as Record<string, 'compact' | 'wide'>;
  const config: ConfigPayload = { name: [...name.trim()].slice(0, 40).join(''), order, sizes };
  if (doc.appearance) config.appearance = doc.appearance as unknown as AppearancePayload;
  if (doc.banner) config.banner = doc.banner as unknown as BannerPayload;
  if (doc.decorations) config.decorations = doc.decorations as unknown as DecorationsPayload;
  if (Object.keys(avatarStyle).length) config.avatar = avatarStyle;
  return config;
}

/** Appliquer une configuration : contenus privés, statut actif et visibilité conservés (§17.2 n° 5). */
export function applyConfiguration(doc: ProfileDoc, config: ConfigPayload): { key: string; payload: Payload | null }[] {
  const changes: { key: string; payload: Payload | null }[] = [
    { key: 'appearance', payload: (config.appearance as Payload | undefined) ?? null },
    { key: 'banner', payload: (config.banner as Payload | undefined) ?? null },
    { key: 'decorations', payload: (config.decorations as Payload | undefined) ?? null },
  ];
  const avatar = strip(doc.avatar, STYLE_AVATAR) ?? { source: 'default' };
  changes.push({ key: 'avatar', payload: cleanAvatar({ ...avatar, ...(config.avatar ?? {}) }) });
  const present = orderedWidgets(doc);
  const order = [...(config.order ?? []).filter((key) => present.includes(key)), ...present.filter((key) => !(config.order ?? []).includes(key))];
  changes.push({ key: 'layout', payload: order.length ? { order } : null });
  for (const key of present) {
    const size = config.sizes?.[key];
    const widget = doc[key] as Payload;
    if (size && widget.size !== size) changes.push({ key, payload: { ...widget, size } });
  }
  return changes.filter((change) => JSON.stringify(change.payload) !== JSON.stringify(doc[change.key] ?? null));
}

/** Progression d'un objectif : saisie manuelle, ou calculée sur cet appareil à partir des courses Sprinter. */
export function goalProgress(widget: WidgetPayload, history: RunRecord[], now: number): { value: number; computed: boolean } {
  const source = widget.source ?? 'manual';
  if (source === 'manual') return { value: widget.progress ?? 0, computed: false };
  const date = new Date(now);
  const start = source.endsWith('_year') ? new Date(date.getFullYear(), 0, 1).getTime() : new Date(date.getFullYear(), date.getMonth(), 1).getTime();
  const runs = history.filter((run) => run.endedAt !== null && !run.healthKit && run.startedAt >= start && run.startedAt <= now
    && run.distanceMeters >= MIN_DISTANCE && run.activeSeconds >= MIN_SECONDS);
  const value = source.startsWith('distance') ? Math.round(runs.reduce((sum, run) => sum + run.distanceMeters, 0) / 100) / 10 : runs.length;
  return { value, computed: true };
}
