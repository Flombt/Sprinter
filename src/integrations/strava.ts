import type { RunRecord } from '../core/types';
import type { ExportDocument } from '../analysis/export/types';
import { activityDocument } from '../sharing/documents';
import type { ExportPrivacy } from '../sharing/privacy';
export interface ActivitySyncConsent { provider: 'strava'; runId: string; confirmedAt: number; privacy: ExportPrivacy }
export interface ActivitySyncReceipt { externalId: string; activityId: string | null; status: 'processing' | 'complete' | 'failed' }
/** Future adapter only: authentication, approved scopes, secure exchange, revocation and upload dedupe belong to that implementation. */
export interface ActivitySyncAdapter {
  readonly provider: 'strava';
  upload(document: ExportDocument, externalId: string, consent: ActivitySyncConsent): Promise<ActivitySyncReceipt>;
  status(receipt: ActivitySyncReceipt): Promise<ActivitySyncReceipt>;
  disconnect(): Promise<void>;
}
export function prepareStravaDraft(run: RunRecord, consent: ActivitySyncConsent) {
  if (consent.provider !== 'strava' || consent.runId !== run.id || !Number.isFinite(consent.confirmedAt) || Date.now() - consent.confirmedAt > 300000 || consent.confirmedAt > Date.now() + 1000) throw new Error('Un futur envoi Strava exige un consentement explicite et récent pour cette activité.');
  // Strava requires point timestamps. A public geometry-only export must never silently become a private upload.
  if (consent.privacy.mode !== 'private') throw new Error('La copie publique sans horodatages n’est pas compatible avec cet import Strava. Aucun envoi ni retour automatique à la copie complète.');
  return { document: activityDocument(run, 'gpx', consent.privacy), externalId: `sprinter-${run.id}`, consent };
}
