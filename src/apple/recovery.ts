import type { RunRecord } from '../core/types';
import type { ApplePreferences } from './types';

/** Durable run markers close the gap between the sports and Health databases. */
export function healthRetryCandidates(history: RunRecord[], preferences: ApplePreferences): RunRecord[] {
  if (!preferences.autoWrite) return [];
  const acknowledged = new Set(preferences.receipts.map(receipt => receipt.runId));
  const pending = new Set(preferences.pendingRunIds ?? []);
  return history.filter(run => !acknowledged.has(run.id) && !run.healthKit && run.endedAt !== null
    && run.distanceMeters > 0 && run.activeSeconds > 0
    && (pending.has(run.id) || (Number.isFinite(run.healthExportRequestedAt) && run.healthExportRequestedAt! > 0)));
}
