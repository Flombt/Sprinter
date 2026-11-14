import { AppState, Platform } from 'react-native';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { getRandomBytes } from 'expo-crypto';
import { backend } from './env';
import { accountKv } from './kv';
import { createEncryptedSessionStorage, SESSION_PREFIX } from './secureSession';

/**
 * Client Supabase unique (§6.3). Chargé à la demande par le module compte : sans compte,
 * ce fichier et la bibliothèque Supabase ne sont jamais évalués au démarrage.
 */
const webStorage = {
  getItem: (key: string) => accountKv.get(SESSION_PREFIX + key),
  setItem: (key: string, value: string) => accountKv.set(SESSION_PREFIX + key, value),
  removeItem: (key: string) => accountKv.remove(SESSION_PREFIX + key),
  clear: () => accountKv.removePrefix(SESSION_PREFIX),
};

export const sessionStorage = Platform.OS === 'web'
  ? webStorage
  : createEncryptedSessionStorage({ secrets: SecureStore, kv: accountKv, random: getRandomBytes });

let client: SupabaseClient | null = null;
let appStateBound = false;

export function getSupabase(): SupabaseClient | null {
  if (!backend) return null;
  if (!client) {
    client = createClient(backend.url, backend.publishableKey, {
      auth: {
        storage: sessionStorage,
        storageKey: 'sprinter-auth',
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
      global: { headers: { 'x-client-info': `sprinter-app/${Platform.OS}` } },
    });
  }
  if (!appStateBound && Platform.OS !== 'web') {
    appStateBound = true;
    // Rafraîchissement du jeton seulement au premier plan (doc Supabase React Native).
    if (AppState.currentState === 'active') client.auth.startAutoRefresh();
    AppState.addEventListener('change', (state) => {
      if (state === 'active') client?.auth.startAutoRefresh();
      else client?.auth.stopAutoRefresh();
    });
  }
  return client;
}
