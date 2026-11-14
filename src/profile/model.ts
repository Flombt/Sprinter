// Modèle du profil personnalisé (§17). Un profil est un ensemble d'éléments indépendants ; un élément
// absent ou supprimé reprend sa valeur par défaut (thème Sprinter, avatar de remplacement, profil vide).
// La validation reflète celle du serveur (0015_profiles.sql) pour signaler un problème avant l'envoi.
import type { RunRecord } from '../core/types';

export type Kind = 'identity' | 'appearance' | 'avatar' | 'banner' | 'about' | 'status' | 'layout' | 'widget';
export type Payload = Record<string, unknown>;
export interface Crop { x: number; y: number; zoom: number }
export interface IdentityPayload { name?: string }
export interface AppearancePayload { theme: string; accent?: string }
export interface AvatarPayload { source: 'default' | 'library' | 'media'; libraryId?: string; mediaId?: string; crop?: Crop }
export interface BannerPayload { source: 'default' | 'preset' | 'color' | 'gradient' | 'media'; presetId?: string; colors?: string[]; mediaId?: string; crop?: Crop }
export interface AboutPayload { bio?: string }
export interface StatusPayload { emoji?: string; text?: string; expiresAt?: string | null }
export interface LayoutPayload { order: string[] }
export type StatId = 'seniority' | 'runs' | 'distance' | 'best_effort';
export type WidgetType = 'text' | 'interests' | 'stats';
export interface WidgetPayload { type: WidgetType; title?: string; text?: string; tags?: string[]; stats?: StatId[] }

/** Contenu courant d'un profil : clé → contenu, ou null pour la valeur par défaut. */
export type ProfileDoc = Record<string, Payload | null>;

export const LIMITS = { widgets: 8, bio: 190, statusText: 80, statusEmoji: 16, name: 40, widgetTitle: 40, widgetText: 280, tags: 12, tagLength: 24, stats: 4 } as const;
export const BASE_KEYS = ['identity', 'appearance', 'avatar', 'banner', 'about', 'status', 'layout'] as const;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const KEY = /^(identity|appearance|avatar|banner|about|status|layout|widget:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/;
const ID = /^[a-z0-9-]{1,32}$/;
const HEX = /^#[0-9a-fA-F]{6}$/;
const CONTROL = /[\u0001-\u0008\u000b\u000c\u000e-\u001f\u007f]/;
export const STAT_IDS: StatId[] = ['seniority', 'runs', 'distance', 'best_effort'];

export const isElementKey = (key: string) => KEY.test(key);
export const kindOf = (key: string) => key.split(':')[0] as Kind;
export const widgetKey = (uuid: string) => `widget:${uuid.toLowerCase()}`;

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

/** null si le contenu est valide, sinon le même code court que le serveur. */
export function validatePayload(kind: Kind, payload: Payload): string | null {
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) return 'payload_type';
  if (new TextEncoder().encode(JSON.stringify(payload)).length > 4096) return 'payload_size';
  const source = payload.source;
  switch (kind) {
    case 'identity': return keysOk(payload, ['name']) && textOk(payload.name, LIMITS.name) ? null : 'identity';
    case 'appearance': return keysOk(payload, ['theme', 'accent']) && idOk(payload.theme) && (payload.accent === undefined || idOk(payload.accent)) ? null : 'appearance';
    case 'avatar': return keysOk(payload, ['source', 'libraryId', 'mediaId', 'crop']) && ['default', 'library', 'media'].includes(source as string)
      && (source !== 'library' || idOk(payload.libraryId)) && (source === 'media' ? uuidOk(payload.mediaId) : payload.mediaId === undefined)
      && (payload.crop === undefined || cropOk(payload.crop)) ? null : 'avatar';
    case 'banner': {
      const colors = payload.colors;
      const colorsOk = Array.isArray(colors) && colors.length >= (source === 'color' ? 1 : 2) && colors.length <= 3 && colors.every((color) => typeof color === 'string' && HEX.test(color));
      return keysOk(payload, ['source', 'presetId', 'colors', 'mediaId', 'crop']) && ['default', 'preset', 'color', 'gradient', 'media'].includes(source as string)
        && (source !== 'preset' || idOk(payload.presetId)) && (!(source === 'color' || source === 'gradient') || colorsOk)
        && (source === 'media' ? uuidOk(payload.mediaId) : payload.mediaId === undefined)
        && (payload.crop === undefined || cropOk(payload.crop)) ? null : 'banner';
    }
    case 'about': return keysOk(payload, ['bio']) && textOk(payload.bio, LIMITS.bio) ? null : 'about';
    case 'status': {
      const filled = [payload.emoji, payload.text].some((value) => typeof value === 'string' && value.trim().length > 0);
      const expiry = payload.expiresAt;
      const expiryOk = expiry === undefined || expiry === null || (typeof expiry === 'string' && !Number.isNaN(Date.parse(expiry)));
      return keysOk(payload, ['emoji', 'text', 'expiresAt']) && textOk(payload.emoji, LIMITS.statusEmoji) && textOk(payload.text, LIMITS.statusText)
        && filled && expiryOk ? null : 'status';
    }
    case 'layout': {
      const order = payload.order;
      return keysOk(payload, ['order']) && Array.isArray(order) && order.length <= LIMITS.widgets
        && order.every((key) => typeof key === 'string' && key.startsWith('widget:') && KEY.test(key)) && new Set(order).size === order.length ? null : 'layout';
    }
    case 'widget': {
      const type = payload.type as WidgetType;
      const stats = payload.stats;
      return keysOk(payload, ['type', 'title', 'text', 'tags', 'stats']) && ['text', 'interests', 'stats'].includes(type)
        && textOk(payload.title, LIMITS.widgetTitle)
        && (payload.text === undefined || (type === 'text' && textOk(payload.text, LIMITS.widgetText)))
        && (payload.tags === undefined || (type === 'interests' && stringsOk(payload.tags, LIMITS.tags, LIMITS.tagLength)))
        && (stats === undefined || (type === 'stats' && Array.isArray(stats) && stats.length <= LIMITS.stats
          && stats.every((stat) => STAT_IDS.includes(stat as StatId)) && new Set(stats).size === stats.length)) ? null : 'widget';
    }
  }
  return 'kind';
}

/** Médias référencés par un contenu (avatar, bannière). */
export const payloadMedia = (payload: Payload | null | undefined): string[] =>
  payload && typeof payload.mediaId === 'string' ? [payload.mediaId] : [];

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
export const WIDGET_LABELS: Record<WidgetType, string> = { text: 'Texte libre', interests: 'Centres d’intérêt', stats: 'Statistiques' };
export const ELEMENT_LABELS: Record<Kind, string> = {
  identity: 'Nom de présentation', appearance: 'Apparence', avatar: 'Avatar', banner: 'Bannière', about: 'Présentation',
  status: 'Statut', layout: 'Disposition des widgets', widget: 'Widget',
};
