/* eslint-disable @typescript-eslint/no-require-imports -- le client Supabase est chargé seulement si le backend est configuré. */
import { useSyncExternalStore } from 'react';
import { randomUUID } from 'expo-crypto';
import { backend } from './env';
import { accountKv } from './kv';
import { AccountStore, isSignedIn, type AccountSnapshot } from './accountStore';
import { appVersion, deviceId, devicePlatform, localDay, osVersion } from './device';
import { appleCredential, appleSupported, googleIdToken, googleSupported } from './providers';

type ClientModule = typeof import('./supabaseClient');
// Chargement paresseux pour les builds sans configuration backend.
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

/** Restaure le compte avant l'accès à l'application, indépendamment des options cloud. */
export function startAccount() {
  if (backend) void account.start(() => clientModule().sessionStorage.getItem('sprinter-auth'));
}

export const useAccount = (): AccountSnapshot => useSyncExternalStore(account.subscribe, account.getSnapshot, account.getSnapshot);
export const hasSignedInAccount = () => isSignedIn(account.getSnapshot());
