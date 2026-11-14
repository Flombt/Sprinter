import { describe, expect, it, vi } from 'vitest';
import {
  AppConfigStore, CACHE_KEY, DEFAULT_APP_CONFIG, REFRESH_AFTER_MS, compareVersions, parseAppConfig, updateRequired, type Fetcher,
} from '../src/account/configStore';
import { createMemoryKeyValueStore } from '../src/account/kvStore';
import { readBackendConfig } from '../src/account/env';

const backend = { url: 'https://example.supabase.co', publishableKey: 'sb_publishable_test' };
const ok = (rows: unknown): ReturnType<Fetcher> => Promise.resolve({ ok: true, status: 200, json: async () => rows });
const rows = (entries: Record<string, unknown>) => Object.entries(entries).map(([key, value]) => ({ key, value }));

describe('configuration distante (échec ouvert)', () => {
  it('reste inactive et ne fait aucun appel sans backend configuré', async () => {
    const fetch = vi.fn<Fetcher>();
    const store = new AppConfigStore({ backend: null, kv: createMemoryKeyValueStore(), fetch });
    await store.initialize();
    expect(await store.refresh()).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
    expect(store.getSnapshot()).toEqual(DEFAULT_APP_CONFIG);
    expect(Object.values(store.getSnapshot().flags).every((value) => value === false)).toBe(true);
  });

  it('refuse une URL non sécurisée hors développement local', () => {
    expect(readBackendConfig({ EXPO_PUBLIC_SUPABASE_URL: 'http://evil.example', EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'k' })).toBeNull();
    expect(readBackendConfig({ EXPO_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321/', EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'k' }))
      .toEqual({ url: 'http://127.0.0.1:54321', publishableKey: 'k' });
    expect(readBackendConfig({ EXPO_PUBLIC_SUPABASE_URL: 'https://x.supabase.co' })).toBeNull();
  });

  it('applique les flags valides et ignore les valeurs invalides ou inconnues', () => {
    const config = parseAppConfig(rows({ accounts_enabled: true, sync_enabled: 'yes', unknown_flag: true, leaderboard_enabled: true }));
    expect(config.flags.accounts_enabled).toBe(true);
    expect(config.flags.sync_enabled).toBe(false);
    expect(config.flags.leaderboard_enabled).toBe(true);
    expect('unknown_flag' in config.flags).toBe(false);
  });

  it('n’active jamais une fonction sans son socle', () => {
    const config = parseAppConfig(rows({ accounts_enabled: false, sync_enabled: true, routes_sync_enabled: true, profiles_enabled: true }));
    expect(config.flags).toMatchObject({ sync_enabled: false, routes_sync_enabled: false, profiles_enabled: false });
    const noSync = parseAppConfig(rows({ accounts_enabled: true, routes_sync_enabled: true, profiles_enabled: false, profile_sharing_enabled: true }));
    expect(noSync.flags).toMatchObject({ routes_sync_enabled: false, profile_sharing_enabled: false });
  });

  it('compare les versions et n’exige une mise à jour qu’avec une version minimale valide', () => {
    expect(compareVersions('1.2.10', '1.2.9')).toBe(1);
    expect(compareVersions('1.0.0', '1.0.0')).toBe(0);
    const config = parseAppConfig(rows({ min_version: { ios: '1.1.0', android: 'n/a' } }));
    expect(updateRequired(config, 'ios', '1.0.9')).toBe(true);
    expect(updateRequired(config, 'ios', '1.1.0')).toBe(false);
    expect(updateRequired(config, 'android', '0.1.0')).toBe(false);
    expect(updateRequired(config, 'web', '0.1.0')).toBe(false);
    expect(updateRequired(DEFAULT_APP_CONFIG, 'ios', '0.0.1')).toBe(false);
  });

  it('borne le message de maintenance', () => {
    const config = parseAppConfig(rows({ maintenance: { enabled: true, message: ` ${'x'.repeat(400)} ` } }));
    expect(config.maintenance.enabled).toBe(true);
    expect(config.maintenance.message).toHaveLength(280);
  });

  it('lit app_config avec la seule clé publique et met la réponse en cache', async () => {
    const kv = createMemoryKeyValueStore();
    const fetch = vi.fn<Fetcher>(() => ok(rows({ accounts_enabled: true })));
    const store = new AppConfigStore({ backend, kv, fetch, now: () => 1_000 });
    expect(await store.refresh()).toBe(true);
    expect(fetch).toHaveBeenCalledWith('https://example.supabase.co/rest/v1/app_config?select=key,value', expect.objectContaining({
      headers: { apikey: 'sb_publishable_test', Accept: 'application/json' },
    }));
    expect(store.getSnapshot().flags.accounts_enabled).toBe(true);
    expect(JSON.parse(kv.data.get(CACHE_KEY)!)).toMatchObject({ fetchedAt: 1_000 });
  });

  it('échoue en mode ouvert : erreur réseau, statut HTTP ou délai dépassé', async () => {
    const kv = createMemoryKeyValueStore({ [CACHE_KEY]: JSON.stringify({ fetchedAt: 0, rows: rows({ accounts_enabled: true }) }) });
    const failing = new AppConfigStore({ backend, kv, fetch: () => Promise.reject(new Error('offline')), now: () => REFRESH_AFTER_MS * 2 });
    await failing.initialize();
    await expect(failing.refresh()).resolves.toBe(false);
    expect(failing.getSnapshot().flags.accounts_enabled).toBe(true);

    const http = new AppConfigStore({ backend, kv: createMemoryKeyValueStore(), fetch: () => Promise.resolve({ ok: false, status: 503, json: async () => ({}) }) });
    await expect(http.refresh()).resolves.toBe(false);
    expect(http.getSnapshot()).toEqual(DEFAULT_APP_CONFIG);

    vi.useFakeTimers();
    try {
      const hanging = new AppConfigStore({
        backend, kv: createMemoryKeyValueStore(), timeoutMs: 50,
        fetch: (_url, init) => new Promise((_resolve, reject) => init?.signal?.addEventListener('abort', () => reject(new Error('aborted')))),
      });
      const pending = hanging.refresh();
      await vi.advanceTimersByTimeAsync(60);
      await expect(pending).resolves.toBe(false);
    } finally { vi.useRealTimers(); }
  });

  it('utilise le cache au lancement et ne relit le serveur qu’au-delà d’une heure', async () => {
    let now = 10_000;
    const kv = createMemoryKeyValueStore({ [CACHE_KEY]: JSON.stringify({ fetchedAt: now - 1000, rows: rows({ accounts_enabled: true, sync_enabled: true }) }) });
    const fetch = vi.fn<Fetcher>(() => ok(rows({ accounts_enabled: true, sync_enabled: false })));
    const store = new AppConfigStore({ backend, kv, fetch, now: () => now });
    await store.initialize();
    expect(store.getSnapshot().flags.sync_enabled).toBe(true);
    expect(fetch).not.toHaveBeenCalled();
    now += REFRESH_AFTER_MS + 1;
    await store.refreshIfStale();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(store.getSnapshot().flags.sync_enabled).toBe(false);
  });

  it('ignore un cache illisible', async () => {
    const store = new AppConfigStore({ backend, kv: createMemoryKeyValueStore({ [CACHE_KEY]: '{oops' }), fetch: () => Promise.reject(new Error('offline')) });
    await expect(store.initialize()).resolves.toBeUndefined();
    expect(store.getSnapshot()).toEqual(DEFAULT_APP_CONFIG);
  });
});

describe('coupure côté serveur (§13.5)', () => {
  it('met la synchronisation en pause sans bloquer les éléments', async () => {
    const { classify } = await import('../src/sync/remote');
    const error = classify({ message: 'sync_disabled', code: 'P0001' }, 400);
    expect(error.kind).toBe('rate');
    expect(error.retryAfterMs).toBe(30 * 60_000);
    expect(classify({ message: 'feature_disabled', code: 'P0001' }, 400)).toMatchObject({ kind: 'rate', retryAfterMs: 30 * 60_000, code: 'feature_disabled' });
    expect(classify({ message: 'bad_batch', code: '22023' }, 400).kind).toBe('client');
    expect(classify({ message: 'TypeError: Network request failed' }, 0).kind).toBe('network');
    expect(classify({ message: 'JWT expired', code: 'PGRST301' }, 401).kind).toBe('auth');
  });
});
