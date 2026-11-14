/* eslint-disable @typescript-eslint/no-require-imports -- client Supabase et NetInfo chargés seulement quand le profil est actif (§0.1). */
// Profil personnalisé (§17) : contrôleur de l'app. La base `sprinter-profile-v1.db` n'est ouverte qu'au
// premier usage (database.ts) : le démarrage de Sprinter, l'écran de course et le GPS n'en dépendent pas (§17.8).
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { AppState, Platform } from 'react-native';
import { randomUUID } from 'expo-crypto';
import { backend } from '../account/env';
import { appConfig } from '../account/config';
import { account } from '../account/account';
import { session } from '../services/session';
import { profileDatabase } from './database';
import { ProfileLocalStore, type DraftElement, type LocalMedia } from './localStore';
import { ProfileSync, type ProfileSyncStatus } from './sync';
import { supabaseProfileRemote, type ProfileFiles } from './remote';
import type { Payload, ProfileDoc } from './model';

type ClientModule = typeof import('../account/supabaseClient');
const client = () => (require('../account/supabaseClient') as ClientModule).getSupabase();
// Sélecteur, retouche d'image et fichiers : chargés au premier usage seulement.
type MediaModule = typeof import('./media');
const media = () => require('./media') as MediaModule;
const lazyFiles: ProfileFiles = {
  read: (uri) => media().profileFiles.read(uri),
  write: (owner, id, mime, bytes) => media().profileFiles.write(owner, id, mime, bytes),
};

export const profileStore = new ProfileLocalStore(profileDatabase);

export const profilesEnabled = () => {
  const flags = appConfig.getSnapshot().flags;
  return !!backend && Platform.OS !== 'web' && flags.accounts_enabled && flags.profiles_enabled && account.getSnapshot().status === 'signedIn';
};

// Petits messages destinés à l'écran du profil (média refusé, etc.).
let notice: string | null = null;
const changeListeners = new Set<() => void>();
const changed = () => { for (const listener of [...changeListeners]) { try { listener(); } catch { /* facultatif */ } } };

export const profileSync = new ProfileSync(profileStore, supabaseProfileRemote(client, lazyFiles), {
  enabled: profilesEnabled,
  userId: () => account.getSnapshot().userId,
  runActive: () => session.getSnapshot().run !== null,
  async refreshAuth() {
    try { const { error } = await client()!.auth.refreshSession(); return !error; } catch { return false; }
  },
  now: Date.now,
  notify(message) { notice = message; changed(); },
});
profileSync.subscribe(changed);

const owner = () => {
  const userId = account.getSnapshot().userId;
  if (!userId || account.getSnapshot().status !== 'signedIn') throw new Error('signed_out');
  return userId;
};

let started = false;
let debounce: ReturnType<typeof setTimeout> | null = null;
function schedule(trigger: string, delay = 0) {
  if (!profilesEnabled()) return;
  if (debounce) clearTimeout(debounce);
  debounce = setTimeout(() => { debounce = null; void profileSync.sync(trigger); }, delay);
}

/** Déclencheurs : premier plan, état du compte et des flags, fin de course (3 s), retour du réseau. */
export function startProfile() {
  if (started || !backend || Platform.OS === 'web') return;
  started = true;
  let bound = false;
  const evaluate = () => {
    if (!profilesEnabled()) return;
    if (!bound) {
      bound = true;
      try {
        const NetInfo = (require('@react-native-community/netinfo') as typeof import('@react-native-community/netinfo')).default;
        let connected = true;
        NetInfo.addEventListener((state) => {
          const now = state.isConnected !== false && state.isInternetReachable !== false;
          if (now && !connected) schedule('network');
          connected = now;
        });
      } catch { /* module indisponible : les autres déclencheurs suffisent */ }
    }
    void profileSync.refreshCounts().catch(() => undefined);
    schedule('state', 1500);
  };
  appConfig.subscribe(evaluate);
  account.subscribe(evaluate);
  AppState.addEventListener('change', (state) => { if (state === 'active') schedule('foreground', 1500); });
  let wasRunning = session.getSnapshot().run !== null;
  session.subscribe(() => {
    const running = session.getSnapshot().run !== null;
    if (wasRunning && !running) schedule('run_finished', 3000);
    wasRunning = running;
  });
  evaluate();
}

export const useProfileSyncStatus = (): ProfileSyncStatus =>
  useSyncExternalStore(profileSync.subscribe, profileSync.getSnapshot, profileSync.getSnapshot);

export interface MediaRef { uri: string; width: number; height: number }
export interface ProfileState {
  loading: boolean; saved: ProfileDoc; working: ProfileDoc; drafts: DraftElement[]; media: Record<string, MediaRef>;
  notice: string | null; reload(): void;
}

/** Version enregistrée, version de travail et adresses locales des médias du titulaire connecté. */
export function useProfile(): ProfileState {
  const [state, setState] = useState<Omit<ProfileState, 'reload'>>({ loading: true, saved: {}, working: {}, drafts: [], media: {}, notice: null });
  const [tick, setTick] = useState(0);
  const reload = useCallback(() => setTick((value) => value + 1), []);
  useEffect(() => {
    changeListeners.add(reload);
    return () => { changeListeners.delete(reload); };
  }, [reload]);
  useEffect(() => {
    let alive = true;
    const userId = account.getSnapshot().userId;
    if (!userId) { setState({ loading: false, saved: {}, working: {}, drafts: [], media: {}, notice }); return; }
    void Promise.all([profileStore.documents(userId), profileStore.media(userId)]).then(([docs, media]) => {
      if (!alive) return;
      const uris: Record<string, MediaRef> = {};
      for (const item of media) if (item.uri && item.state !== 'rejected') uris[item.id] = { uri: item.uri, width: item.width, height: item.height };
      setState({ loading: false, saved: docs.saved, working: docs.working, drafts: docs.drafts, media: uris, notice });
    }).catch(() => { if (alive) setState((current) => ({ ...current, loading: false })); });
    return () => { alive = false; };
  }, [tick]);
  return { ...state, reload };
}

export async function editProfileElement(key: string, payload: Payload | null) {
  await profileStore.editDraft(owner(), key, payload, Date.now());
  changed();
}
export async function discardProfileDraft(keys?: string[]) {
  await profileStore.discardDraft(owner(), keys);
  changed();
}
/** « Enregistrer » : version privée mise à jour sur l'appareil, puis envoi dès que possible. */
export async function saveProfile() {
  const count = await profileStore.save(owner(), Date.now(), randomUUID);
  changed();
  if (count) void profileSync.sync('save').then(changed);
  return count;
}
export const syncProfileNow = () => profileSync.sync('manual').then(changed);
export function clearProfileNotice() { notice = null; changed(); }

/** Importe une image pour l'avatar ou la bannière et la place dans le brouillon. */
export async function importProfileImage(usage: 'avatar' | 'banner'): Promise<string | null> {
  const userId = owner();
  const result = await media().pickProfileImage(userId, randomUUID(), usage, Date.now());
  if (!result) return null;
  if ('error' in result) return result.error;
  await profileStore.addMedia(userId, result.media);
  await profileStore.editDraft(userId, usage, { source: 'media', mediaId: result.media.id, crop: { x: 0, y: 0, zoom: 1 } }, Date.now());
  changed();
  return null;
}

/** Supprime les fichiers locaux devenus inutiles (ni enregistrés, ni en brouillon, ni en attente d'envoi). */
export async function pruneProfileMedia() {
  const userId = account.getSnapshot().userId;
  if (!userId) return;
  const used = await profileStore.referencedMedia(userId);
  const unused = (await profileStore.media(userId)).filter((item: LocalMedia) => !used.has(item.id));
  for (const item of unused) media().removeMediaFile(item.uri);
  await profileStore.removeMedia(userId, unused.map((item) => item.id));
}

/** Compte supprimé : brouillons, envois, cache et fichiers du titulaire disparaissent de l'appareil (§17.9). */
export async function forgetLocalProfile(userId: string) {
  await profileStore.forget(userId);
  media().removeOwnerFiles(userId);
  changed();
}
