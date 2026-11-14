/** Versions des documents acceptés et finalités des choix (§6.5, journal consent_log). */
export const TERMS_VERSION = '2026-11';
export const PRIVACY_VERSION = '2026-11';
export const CHOICE_VERSION = '2026-11';

export type ConsentPurpose = 'terms' | 'privacy_policy' | 'cloud_sync_runs' | 'cloud_sync_routes' | 'community_leaderboard';
export interface ConsentState { granted: boolean; version: string; at: string }
export type Consents = Partial<Record<ConsentPurpose, ConsentState | null>>;

export interface ConsentResult {
  status: 'applied' | 'duplicate' | 'stale';
  effective: ConsentState | null;
}

/** Une décision n'est effective qu'après confirmation du serveur ; « inconnue » vaut refus. */
export function granted(consents: Consents | null | undefined, purpose: ConsentPurpose): boolean | null {
  if (!consents) return null;
  const state = consents[purpose];
  return state === undefined ? null : state?.granted === true;
}

/** Site public de Sprinter (§16 décision 1, domaine à choisir) : EXPO_PUBLIC_SITE_URL, en HTTPS. */
const SITE = (() => {
  const value = process.env.EXPO_PUBLIC_SITE_URL?.trim().replace(/\/+$/, '');
  return value && /^https:\/\/[^\s/]+/.test(value) ? value : null;
})();
export const legalUrl = (page: 'cgu' | 'confidentialite' | 'supprimer-mon-compte'): string | null => (SITE ? `${SITE}/${page}` : null);
