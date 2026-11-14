/* eslint-disable @typescript-eslint/no-require-imports -- chargement paresseux volontaire : aucun module de compte au démarrage (§0.1). */
import { useSyncExternalStore } from 'react';
import { randomUUID } from 'expo-crypto';
import { backend } from './env';
import { accountKv } from './kv';
import { appConfig } from './config';
import { AccountStore, type AccountSnapshot } from './accountStore';
import { appVersion, deviceId, devicePlatform, localDay, osVersion } from './device';
import { appleCredential, appleSupported, googleIdToken, googleSupported } from './providers';

type ClientModule = typeof import('./supabaseClient');
// Chargement paresseux : la bibliothèque Supabase n'est évaluée qu'au premier usage du compte.
const clientModule = (): ClientModule => require('./supabaseClient') as ClientModule;

export const account = new AccountStore({
  loadClient: () => clientModule().getSupabase(),
  createEphemeralClient: () => {
    const { createClient } = require('@supabase/supabase-js') as typeof import('@supabase/supabase-js');
    const memory = new Map<string, string>();
    return createClient(backend!.url, backend!.publishableKey, {
      auth: {
        persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: 'sprinter-reauth',
        storage: { getItem: (k) => memory.get(k) ?? null, setItem: (k, v) => { memory.set(k, v); }, removeItem: (k) => { memory.delete(k); } },
      },
    });
  },
  clearSession: () => clientModule().sessionStorage.clear(),
  kv: accountKv,
  apple: appleSupported ? appleCredential : null,
  google: googleSupported ? googleIdToken : null,
  device: { id: deviceId, platform: devicePlatform, osVersion, appVersion, localDay: () => localDay() },
  functionsUrl: backend ? `${backend.url}/functions/v1` : '',
  publishableKey: backend?.publishableKey ?? '',
  async download(url, headers, fileName) {
    const { File, Paths } = require('expo-file-system') as typeof import('expo-file-system');
    const Sharing = require('expo-sharing') as typeof import('expo-sharing');
    const destination = new File(Paths.cache, fileName);
    if (destination.exists) destination.delete();
    const file = await File.downloadFileAsync(url, destination, { headers });
    if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(file.uri, { mimeType: 'application/zip', dialogTitle: 'Exporter mes données Sprinter' });
    return file.uri;
  },
  uuid: randomUUID,
});

let unsubscribe: (() => void) | null = null;
/** Démarre le module compte dès que `accounts_enabled` est actif ; sinon rien n'est chargé. */
export function startAccount() {
  if (!backend || unsubscribe) return;
  const evaluate = () => {
    if (appConfig.getSnapshot().flags.accounts_enabled) {
      void account.start(() => clientModule().sessionStorage.getItem('sprinter-auth'));
    }
  };
  unsubscribe = appConfig.subscribe(evaluate);
  evaluate();
}

export const useAccount = (): AccountSnapshot => useSyncExternalStore(account.subscribe, account.getSnapshot, account.getSnapshot);
/** Le compte n'est proposé que si le backend est configuré ET le flag actif (§14 phase 1). */
export const useAccountsEnabled = (): boolean =>
  useSyncExternalStore(appConfig.subscribe, () => !!backend && appConfig.getSnapshot().flags.accounts_enabled, () => false);