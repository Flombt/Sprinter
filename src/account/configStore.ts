import type { BackendConfig } from './env';
import type { KeyValueStore } from './kvStore';

/**
 * Configuration distante de l'app (`public.app_config`, §10.4 Config).
 * Règle d'or : ÉCHEC OUVERT. Hors ligne, erreur serveur ou réponse invalide, l'app
 * continue avec la dernière valeur connue ou, à défaut, avec les valeurs par défaut
 * (toutes les fonctions nouvelles éteintes). Aucun écran n'attend le réseau.
 */
export const FLAG_KEYS = [
  'accounts_enabled', 'sync_enabled', 'routes_sync_enabled', 'support_enabled', 'leaderboard_enabled',
  'profiles_enabled', 'profile_studio_enabled', 'profile_sharing_enabled', 'theme_library_enabled', 'profile_cards_enabled',
] as const;
export type FlagKey = (typeof FLAG_KEYS)[number];

export interface AppConfig {
  flags: Record<FlagKey, boolean>;
  minVersion: { ios: string | null; android: string | null };
  maintenance: { enabled: boolean; message: string | null };
  /** Horodatage de la dernière lecture réussie (ms), null si jamais lue. */
  fetchedAt: number | null;
}

export const DEFAULT_APP_CONFIG: AppConfig = {
  flags: Object.fromEntries(FLAG_KEYS.map((key) => [key, false])) as Record<FlagKey, boolean>,
  minVersion: { ios: null, android: null },
  maintenance: { enabled: false, message: null },
  fetchedAt: null,
};

const SEMVER = /^\d{1,4}\.\d{1,4}\.\d{1,4}$/;
export const CACHE_KEY = 'app_config.cache.v1';
/** Âge au-delà duquel une relecture est tentée en arrière-plan (lancement, retour au premier plan). */
export const REFRESH_AFTER_MS = 60 * 60 * 1000;
/** Durée de validité annoncée du cache ; au-delà, la valeur reste utilisée mais est signalée comme ancienne. */
export const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
export const FETCH_TIMEOUT_MS = 5000;

/** Tolérant : clé inconnue ignorée, valeur invalide remplacée par le défaut de cette clé. */
export function parseAppConfig(rows: unknown, fetchedAt: number | null = null): AppConfig {
  const config: AppConfig = {
    flags: { ...DEFAULT_APP_CONFIG.flags },
    minVersion: { ...DEFAULT_APP_CONFIG.minVersion },
    maintenance: { ...DEFAULT_APP_CONFIG.maintenance },
    fetchedAt,
  };
  if (!Array.isArray(rows)) return config;
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const { key, value } = row as { key?: unknown; value?: unknown };
    if (typeof key !== 'string') continue;
    if ((FLAG_KEYS as readonly string[]).includes(key)) {
      if (typeof value === 'boolean') config.flags[key as FlagKey] = value;
    } else if (key === 'min_version' && value && typeof value === 'object') {
      const { ios, android } = value as { ios?: unknown; android?: unknown };
      config.minVersion = {
        ios: typeof ios === 'string' && SEMVER.test(ios) ? ios : null,
        android: typeof android === 'string' && SEMVER.test(android) ? android : null,
      };
    } else if (key === 'maintenance' && value && typeof value === 'object') {
      const { enabled, message } = value as { enabled?: unknown; message?: unknown };
      config.maintenance = {
        enabled: enabled === true,
        message: typeof message === 'string' && message.trim() ? message.trim().slice(0, 280) : null,
      };
    }
  }
  // Une fonction dépendante n'est jamais active sans son socle.
  if (!config.flags.accounts_enabled) {
    for (const key of FLAG_KEYS) if (key !== 'accounts_enabled') config.flags[key] = false;
  }
  if (!config.flags.sync_enabled) config.flags.routes_sync_enabled = false;
  if (!config.flags.profiles_enabled) {
    config.flags.profile_studio_enabled = false;
    config.flags.profile_sharing_enabled = false;
    config.flags.theme_library_enabled = false;
    config.flags.profile_cards_enabled = false;
  }
  return config;
}

export function compareVersions(a: string, b: string): number {
  const left = a.split('.').map(Number), right = b.split('.').map(Number);
  for (let index = 0; index < 3; index++) {
    const difference = (left[index] ?? 0) - (right[index] ?? 0);
    if (difference) return Math.sign(difference);
  }
  return 0;
}

/** Vrai seulement si une version minimale valide est connue et supérieure à la version installée. */
export function updateRequired(config: AppConfig, platform: string, appVersion: string | null | undefined): boolean {
  const minimum = platform === 'ios' ? config.minVersion.ios : platform === 'android' ? config.minVersion.android : null;
  if (!minimum || !appVersion || !SEMVER.test(appVersion)) return false;
  return compareVersions(appVersion, minimum) < 0;
}

export type Fetcher = (input: string, init?: { headers?: Record<string, string>; signal?: AbortSignal }) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

export interface AppConfigDependencies {
  backend: BackendConfig | null;
  kv: KeyValueStore;
  fetch: Fetcher;
  now?: () => number;
  timeoutMs?: number;
}

export class AppConfigStore {
  private value: AppConfig = DEFAULT_APP_CONFIG;
  private listeners = new Set<() => void>();
  private initialized: Promise<void> | null = null;
  private inFlight: Promise<boolean> | null = null;
  constructor(private deps: AppConfigDependencies) {}
  getSnapshot = () => this.value;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private now() { return (this.deps.now ?? Date.now)(); }
  private set(value: AppConfig) {
    this.value = value;
    for (const listener of [...this.listeners]) { try { listener(); } catch { /* un observateur ne bloque pas la config */ } }
  }
  get enabled() { return this.deps.backend !== null; }
  /** Charge le cache local puis relit le serveur en arrière-plan si nécessaire. Ne lève jamais. */
  initialize(): Promise<void> {
    if (!this.deps.backend) return Promise.resolve();
    this.initialized ??= (async () => {
      try {
        const raw = await this.deps.kv.get(CACHE_KEY);
        if (raw) {
          const cached = JSON.parse(raw) as { fetchedAt?: unknown; rows?: unknown };
          if (typeof cached.fetchedAt === 'number') this.set(parseAppConfig(cached.rows, cached.fetchedAt));
        }
      } catch { /* cache illisible : valeurs par défaut */ }
      void this.refreshIfStale();
    })();
    return this.initialized;
  }
  isStale() { return this.value.fetchedAt === null || this.now() - this.value.fetchedAt > CACHE_TTL_MS; }
  refreshIfStale(): Promise<boolean> {
    if (this.value.fetchedAt !== null && this.now() - this.value.fetchedAt < REFRESH_AFTER_MS) return Promise.resolve(false);
    return this.refresh();
  }
  /** Relit `app_config`. Renvoie vrai si une nouvelle valeur a été appliquée. */
  refresh(): Promise<boolean> {
    const backend = this.deps.backend;
    if (!backend) return Promise.resolve(false);
    this.inFlight ??= (async () => {
      const controller = typeof AbortController === 'undefined' ? null : new AbortController();
      const timer = setTimeout(() => controller?.abort(), this.deps.timeoutMs ?? FETCH_TIMEOUT_MS);
      try {
        const response = await this.deps.fetch(`${backend.url}/rest/v1/app_config?select=key,value`, {
          headers: { apikey: backend.publishableKey, Accept: 'application/json' },
          signal: controller?.signal,
        });
        if (!response.ok) return false;
        const rows = await response.json();
        if (!Array.isArray(rows)) return false;
        const fetchedAt = this.now();
        this.set(parseAppConfig(rows, fetchedAt));
        try { await this.deps.kv.set(CACHE_KEY, JSON.stringify({ fetchedAt, rows })); } catch { /* cache facultatif */ }
        return true;
      } catch {
        return false;
      } finally {
        clearTimeout(timer);
        this.inFlight = null;
      }
    })();
    return this.inFlight;
  }
}
