/* eslint-disable @typescript-eslint/no-require-imports -- client Supabase chargé seulement quand le partage est utilisé (§0.1). */
// Partage du profil (8c, §17.7) : choix de partage, visibilité par élément, publication, lien, recherche,
// visite, blocage et signalement. Les retraits (rendre privé, masquer, révoquer) faits hors ligne sont gardés
// et affichés « Retrait en attente de connexion » jusqu'à la confirmation du serveur.
import { account } from '../account/account';
import { backend } from '../account/env';
import { classify } from '../sync/remote';
import { profileStore, profileSync } from './profile';
import type { ProfileDoc } from './model';
import type { OfficialBadge } from './sync';

import { WithdrawalQueue, linkFor, parseLink, snapshotsFor, type SharingMode, type Withdrawal } from './sharingModel';
export { linkFor, parseLink, snapshotsFor, type SharingMode, type Withdrawal };
export interface Notice { id: string; kind: 'content_hidden' | 'content_removed' | 'content_restored' | 'profile_removed'; element_key: string | null; reason: string | null; created_at: string }
export interface SharingState {
  enabled: boolean; mode: SharingMode; searchable: boolean; handle: string | null; presence: 'nobody' | 'audience'; rules_accepted: boolean;
  epoch: number; published_at: string | null; moderation: 'visible' | 'hidden' | 'removed'; link_active: boolean;
  visibility: Record<string, 'owner' | 'audience'>; published: Record<string, 'visible' | 'hidden' | 'removed'>; notices: Notice[];
}
export interface VisitTarget { handle?: string; token?: string }
export interface VisitView {
  available: boolean; self?: boolean; handle?: string | null; elements?: ProfileDoc; badges?: OfficialBadge[]; presence?: 'online' | null;
  media?: { id: string; mime: string; width: number; height: number; animated: boolean }[];
}
export const RULES_VERSION = 'regles-profil-2026-11';
export const RULES = [
  'Votre profil partagé respecte les autres membres : pas de propos haineux, harcelants, sexuels ou violents.',
  'Ne publiez pas d’informations personnelles (adresse, téléphone, lieux d’entraînement réguliers), ni les vôtres ni celles d’autrui.',
  'Pas d’usurpation d’identité, de publicité ou de liens trompeurs.',
  'Un contenu signalé peut être masqué en attendant son examen ; un retrait vous est notifié et peut être contesté auprès du support.',
];

const owner = () => {
  const userId = account.getSnapshot().userId;
  if (!userId) throw new Error('signed_out');
  return userId;
};
const isNetwork = (error: unknown) => classify({ message: error instanceof Error ? error.message : String(error) }, 0).kind === 'network'
  || (error instanceof Error && /fetch|network|timeout/i.test(error.message));

async function run(withdrawal: Withdrawal) {
  if (withdrawal.type === 'private') await account.rpc('profile_sharing_set', { p_mode: 'private', p_searchable: false, p_handle: null, p_presence: 'nobody' });
  else if (withdrawal.type === 'hide') await account.rpc('profile_set_visibility', { p_items: [{ key: withdrawal.key, visibility: 'owner' }] });
  else if (withdrawal.type === 'revoke') await account.rpc('profile_link_revoke');
  else await account.rpc('profile_sharing_set', { p_mode: withdrawal.mode, p_searchable: false, p_handle: withdrawal.handle, p_presence: withdrawal.presence });
}
const queueFor = (userId: string) => new WithdrawalQueue({
  get: () => profileStore.getMeta(userId, 'withdrawals'), set: async (value) => { await profileStore.setMeta(userId, 'withdrawals', value); },
}, run, isNetwork);
export const pendingWithdrawals = () => queueFor(owner()).list();
/** Rejoue les retraits en attente, en tête de chaque synchronisation du profil. */
export const flushWithdrawals = (userId: string) => queueFor(userId).flush();
profileSync.addStep(flushWithdrawals);

export async function loadSharing(): Promise<{ state: SharingState | null; offline: boolean }> {
  const userId = owner();
  try {
    const state = await account.rpc<SharingState>('profile_sharing_get');
    await profileStore.setMeta(userId, 'sharing', JSON.stringify(state));
    return { state, offline: false };
  } catch (error) {
    if (!isNetwork(error)) throw error;
    const cached = await profileStore.getMeta(userId, 'sharing');
    return { state: cached ? JSON.parse(cached) as SharingState : null, offline: true };
  }
}

/** Retourne 'queued' si le retrait attend la connexion. */
const withdraw = (call: () => Promise<unknown>, withdrawal: Withdrawal) =>
  new WithdrawalQueue({ get: () => profileStore.getMeta(owner(), 'withdrawals'), set: async (value) => { await profileStore.setMeta(owner(), 'withdrawals', value); } },
    async () => { await call(); }, isNetwork).attempt(withdrawal);

export function saveSharing(mode: SharingMode, searchable: boolean, handle: string | null, presence: 'nobody' | 'audience', acceptRules: boolean) {
  const call = () => account.rpc<SharingState>('profile_sharing_set', {
    p_mode: mode, p_searchable: searchable, p_handle: handle || null, p_presence: presence, p_rules_version: acceptRules ? RULES_VERSION : null,
  });
  if (mode === 'private') return withdraw(call, { type: 'private' });
  if (!searchable) return withdraw(call, { type: 'unsearchable', mode, handle: handle || null, presence });
  return call().then(() => 'done' as const);
}
export function setVisibility(key: string, visibility: 'owner' | 'audience') {
  const call = () => account.rpc('profile_set_visibility', { p_items: [{ key, visibility }] });
  return visibility === 'owner' ? withdraw(call, { type: 'hide', key }) : call().then(() => 'done' as const);
}
export const revokeLink = () => withdraw(() => account.rpc('profile_link_revoke'), { type: 'revoke' });
export const createLink = async () => (await account.rpc<{ token: string }>('profile_link_create')).token;
export const publish = (epoch: number, snapshots: Record<string, unknown>) => account.rpc<{ published: number; epoch: number }>('profile_publish', { p_epoch: epoch, p_snapshots: snapshots });

export const searchProfiles = (query: string, after?: string) =>
  account.rpc<{ items: { handle: string; name: string | null; avatar: string | null }[] }>('profile_search', { p_query: query, p_after: after ?? null });
export const viewProfile = (target: VisitTarget) => account.rpc<VisitView>('profile_view', { p_handle: target.handle ?? null, p_token: target.token ?? null });
export const blockProfile = (target: VisitTarget) => account.rpc<{ blocked: boolean }>('profile_block', { p_handle: target.handle ?? null, p_token: target.token ?? null });
export const myBlocks = () => account.rpc<{ id: string; label: string; created_at: string }[]>('profile_my_blocks');
export const unblock = (id: string) => account.rpc('profile_unblock', { p_block_id: id });
export const reportProfile = (target: VisitTarget, elementKey: string | null, reason: string, note: string | null) =>
  account.rpc('profile_report', { p_handle: target.handle ?? null, p_token: target.token ?? null, p_element_key: elementKey, p_reason: reason, p_note: note });
export const markNoticeRead = (id: string) => account.rpc('profile_notice_read', { p_id: id });
export const touchPresence = () => account.rpc('profile_touch_presence').catch(() => undefined);

/** Adresse et en-têtes d'un média de profil partagé : chaque chargement passe par la fonction profile-media. */
export async function visitorMedia(view: VisitView, target: VisitTarget) {
  type ClientModule = typeof import('../account/supabaseClient');
  const client = (require('../account/supabaseClient') as ClientModule).getSupabase();
  const session = client ? (await client.auth.getSession()).data.session : null;
  if (!backend || !session) return {};
  const query = target.token ? `t=${encodeURIComponent(target.token)}` : target.handle ? `h=${encodeURIComponent(target.handle)}` : '';
  const headers = { Authorization: `Bearer ${session.access_token}`, apikey: backend.publishableKey };
  return Object.fromEntries((view.media ?? []).map((item) => [item.id, {
    uri: `${backend!.url}/functions/v1/profile-media?m=${item.id}${query ? `&${query}` : ''}`, width: item.width, height: item.height, animated: item.animated, headers,
  }]));
}
