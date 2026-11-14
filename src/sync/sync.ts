/* eslint-disable @typescript-eslint/no-require-imports -- NetInfo chargé seulement quand la synchronisation est active (§0.1). */
import { useSyncExternalStore } from 'react';
import { AppState, Platform } from 'react-native';
import { randomUUID } from 'expo-crypto';
import { backend } from '../account/env';
import { appConfig } from '../account/config';
import { account } from '../account/account';
import { CHOICE_VERSION } from '../account/consents';
import { appVersion, deviceId, devicePlatform, timeZone } from '../account/device';
import { session } from '../services/session';
import { SyncEngine } from './engine';
import { SyncLocalStore } from './localStore';
import { supabaseSyncRemote } from './remote';
import type { SyncStatus } from './types';

type ClientModule = typeof import('../account/supabaseClient');
const client = () => (require('../account/supabaseClient') as ClientModule).getSupabase();

export const syncLocal = new SyncLocalStore((operation) => session.withStorage(operation));
let applyingRemote = false;

export const syncEnabled = () =>
  !!backend && Platform.OS !== 'web' && appConfig.getSnapshot().flags.sync_enabled && account.getSnapshot().status === 'signedIn';

export const syncEngine = new SyncEngine(syncLocal, supabaseSyncRemote(client, deviceId), {
  enabled: syncEnabled,
  userId: () => account.getSnapshot().userId,
  // Aucune synchronisation pendant une séance, même en pause (§7.1 n° 4).
  runActive: () => session.getSnapshot().run !== null,
  async refreshAuth() {
    try { const { error } = await client()!.auth.refreshSession(); return !error; } catch { return false; }
  },
  localSettings: () => session.getSnapshot().settings,
  applyRemoteSettings: (patch) => session.updateSettings(patch),
  async historyChanged() {
    applyingRemote = true;
    try { await session.reloadHistory(); } finally { applyingRemote = false; }
  },
  async recordBackupChoice(on, eventId, at) {
    const result = await account.recordConsent('cloud_sync_runs', on, CHOICE_VERSION, eventId, at);
    return { status: result.status, granted: result.effective ? result.effective.granted : null };
  },
  platform: devicePlatform,
  appVersion,
  timeZone,
  uuid: randomUUID,
  now: Date.now,
  // Rend la main au fil JavaScript entre deux lots (quand il est libre, sinon après une image).
  yieldToUi: () => new Promise<void>((resolve) => {
    const idle = (globalThis as { requestIdleCallback?: (callback: () => void) => void }).requestIdleCallback;
    if (idle) idle(() => resolve()); else setTimeout(resolve, 16);
  }),
});

let started = false;
let debounce: ReturnType<typeof setTimeout> | null = null;
let netInfoBound = false;

function schedule(trigger: string, delay = 0) {
  if (!syncEnabled()) return;
  if (debounce) clearTimeout(debounce);
  debounce = setTimeout(() => { debounce = null; void syncEngine.sync(trigger); }, delay);
}

function bindNetwork() {
  if (netInfoBound) return;
  netInfoBound = true;
  try {
    const NetInfo = (require('@react-native-community/netinfo') as typeof import('@react-native-community/netinfo')).default;
    let connected = true;
    NetInfo.addEventListener((state) => {
      const now = state.isConnected !== false && state.isInternetReachable !== false;
      if (now && !connected) schedule('network');
      connected = now;
    });
  } catch { /* module indisponible (Expo Go) : les autres déclencheurs suffisent */ }
}

/** Branche les déclencheurs (§7.4) : premier plan, fin de course (3 s), retour du réseau, état du compte. */
export function startSync() {
  if (started || !backend || Platform.OS === 'web') return;
  started = true;
  const evaluate = () => {
    if (!syncEnabled()) return;
    bindNetwork();
    void syncEngine.refreshCounts().catch(() => undefined);
    schedule('state');
  };
  appConfig.subscribe(evaluate);
  account.subscribe(evaluate);
  AppState.addEventListener('change', (state) => { if (state === 'active') schedule('foreground'); });
  let history = session.getSnapshot().history;
  session.subscribe(() => {
    const next = session.getSnapshot().history;
    if (next === history) return;
    history = next;
    if (!applyingRemote) schedule('run_finished', 3000);
  });
  evaluate();
}

export const useSyncStatus = (): SyncStatus => useSyncExternalStore(syncEngine.subscribe, syncEngine.getSnapshot, syncEngine.getSnapshot);

/** Scénario D : efface les données d'un autre compte sur cet appareil puis lie le compte connecté. */
export async function resetDeviceForCurrentAccount() {
  const userId = account.getSnapshot().userId;
  if (!userId) return;
  await syncLocal.resetForAccount(userId);
  await session.reloadHistory();
  await syncEngine.sync('manual');
}
