/* eslint-disable @typescript-eslint/no-require-imports -- NetInfo chargé seulement quand la synchronisation est active (§0.1). */
import { useSyncExternalStore } from 'react';
import { AppState, Platform } from 'react-native';
import { randomUUID } from 'expo-crypto';
import { backend } from '../account/env';
import { appConfig } from '../account/config';
import { account } from '../account/account';
import { CHOICE_VERSION, type ConsentResult } from '../account/consents';
import { appVersion, deviceId, devicePlatform, timeZone } from '../account/device';
import { session } from '../services/session';
import { workouts } from '../workouts/store';
import { progression } from '../progression/store';
import { toolsStore } from '../tools/store';
import { SyncEngine } from './engine';
import { SyncLocalStore } from './localStore';
import { supabaseDocumentRemote, supabaseSyncRemote, syncRpc } from './remote';
import { DocumentSync } from './documents';
import { documentAdapters } from './documentAdapters';
import { RouteSync, type RouteTransport } from './routes';
import type { SyncStatus } from './types';

type ClientModule = typeof import('../account/supabaseClient');
const client = () => (require('../account/supabaseClient') as ClientModule).getSupabase();

export const syncLocal = new SyncLocalStore((operation) => session.withStorage(operation));
let applyingRemote = false;

export const syncEnabled = () =>
  !!backend && Platform.OS !== 'web' && appConfig.getSnapshot().flags.sync_enabled && account.getSnapshot().status === 'signedIn';

const callSync: ReturnType<typeof syncRpc> = syncRpc(client, () => syncEngine.activeUser());
export const syncEngine: SyncEngine = new SyncEngine(syncLocal, supabaseSyncRemote(callSync, deviceId), {
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
    const result = await callSync<ConsentResult>('record_consent', {
      p_purpose: 'cloud_sync_runs', p_version: CHOICE_VERSION, p_granted: on,
      p_client_event_id: eventId, p_client_at: at,
    });
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

// Phase 2b : séances, chaussures, plans et itinéraires, après les courses.
const documentSync = new DocumentSync(syncLocal, supabaseDocumentRemote(callSync), documentAdapters, Date.now);
syncEngine.addExtension({ name: 'documents', run: ({ routesOn, guard }) => documentSync.run(routesOn, guard) });

// Phase 3 : tracés GPS, sur choix explicite et flag routes_sync_enabled.
const bucket = () => client()!.storage.from('run-tracks');
const routeTransport: RouteTransport = {
  async upload(path, bytes) {
    const body = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    const { error } = await bucket().upload(path, body, { contentType: 'application/gzip', upsert: true });
    if (error) throw new Error(error.message);
  },
  async download(path) {
    const { data, error } = await bucket().createSignedUrl(path, 60);
    if (error || !data) throw new Error('Parcours introuvable en ligne.');
    const response = await fetch(data.signedUrl);
    if (!response.ok) throw new Error('Téléchargement du parcours impossible.');
    return new Uint8Array(await response.arrayBuffer());
  },
  async remove(paths) { const { error } = await bucket().remove(paths); if (error) throw new Error(error.message); },
  async register(runId, path, pointsCount, bytes, preview) {
    await callSync('sync_register_route', { p_run_id: runId, p_path: path, p_points_count: pointsCount, p_bytes: bytes, p_preview_polyline: preview });
  },
  async deleteRoutes(runIds) {
    const { data, error } = await client()!.rpc('sync_delete_routes', { p_run_ids: runIds });
    if (error) throw new Error(error.message);
    return ((data as { paths?: string[] })?.paths ?? []);
  },
};
let onWifi = false;
export const routeSync = new RouteSync(syncLocal, routeTransport, {
  userId: () => account.getSnapshot().userId,
  enabled: () => appConfig.getSnapshot().flags.routes_sync_enabled,
  runActive: () => session.getSnapshot().run !== null,
  wifi: () => onWifi,
  async historyChanged() { applyingRemote = true; try { await session.reloadHistory(); } finally { applyingRemote = false; } },
});
syncEngine.addExtension(routeSync);

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
      onWifi = state.type === 'wifi' && state.isConnected === true;
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
  if (!userId) return false;
  const changed = await syncEngine.resetForAccount(userId, () => session.resetAccountData(async (settings) => {
    if (account.getSnapshot().userId !== userId) return false;
    if (!await syncLocal.beginAccountReset(userId)) return false;
    const cleared = await Promise.allSettled([
      workouts.clearForAccountSwitch(),
      progression.clearForAccountSwitch(),
      toolsStore.clearForAccountSwitch(),
    ]);
    if (cleared.some((result) => result.status !== 'fulfilled' || !result.value)) return false;
    if (account.getSnapshot().userId !== userId) return false;
    // L'ancien compte reste lié si un stockage échoue ou si l'application s'arrête avant ce commit.
    await syncLocal.resetForAccount(userId, settings);
    return true;
  }));
  if (changed) await syncEngine.sync('manual');
  return changed;
}

/** Choix de sauvegarde des parcours GPS (§8.1), enregistré puis appliqué à tous les appareils. */
export async function chooseRouteBackup(on: boolean, deleteOnline = false) {
  const result = await account.recordConsent('cloud_sync_routes', on, CHOICE_VERSION);
  if (!on && deleteOnline) await routeSync.deleteOnline();
  await syncEngine.sync('manual');
  return result.status;
}

/** Téléchargement à la demande depuis le détail d'une course (§8.4). */
export async function downloadRoute(runId: string) {
  const count = await routeSync.download(runId);
  await session.reloadHistory();
  return count;
}
