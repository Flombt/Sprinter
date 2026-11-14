import type { Settings } from '../core/types';

/**
 * Réglages portables (§7.5) : synchronisés entre appareils. `backgroundEnabled` dépend d'une
 * permission système et reste propre à l'appareil, comme Apple Santé et Spotify.
 */
export const PORTABLE_KEYS = ['config', 'audioEnabled', 'hapticsEnabled', 'appearance', 'autoPauseEnabled', 'coaching'] as const;
export type PortableSettings = Pick<Settings, (typeof PORTABLE_KEYS)[number]>;

export function portableSettings(settings: Settings): PortableSettings {
  const out: Record<string, unknown> = {};
  for (const key of PORTABLE_KEYS) if (settings[key] !== undefined) out[key] = settings[key];
  return out as PortableSettings;
}

/** Applique des réglages reçus en gardant les réglages propres à l'appareil. */
export function mergePortable(local: Settings, remote: Record<string, unknown>): Partial<Settings> {
  const patch: Record<string, unknown> = {};
  for (const key of PORTABLE_KEYS) if (key in remote) patch[key] = remote[key];
  return patch as Partial<Settings>;
}

/** Empreinte stable (clés triées) pour détecter un changement réel et éviter les allers-retours. */
export function settingsHash(value: unknown): string {
  const stable = (input: unknown): unknown => {
    if (Array.isArray(input)) return input.map(stable);
    if (input && typeof input === 'object') {
      return Object.fromEntries(Object.keys(input as object).sort().map((key) => [key, stable((input as Record<string, unknown>)[key])]));
    }
    return input;
  };
  const text = JSON.stringify(stable(value));
  let hash = 5381;
  for (let index = 0; index < text.length; index++) hash = ((hash << 5) + hash + text.charCodeAt(index)) | 0;
  return `${text.length}:${(hash >>> 0).toString(16)}`;
}
