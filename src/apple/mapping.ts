import { DEFAULT_CONFIG, DEFAULT_TARGET, RunRecord } from '../core/types';
import type { HealthReceipt, HealthWorkout, HealthWrite } from './types';
export const validHealthUUID = (s: unknown): s is string => typeof s === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
export function healthExport(run: RunRecord): HealthWrite {
  if (run.healthKit) throw new Error('Une activité importée de Santé ne doit pas être réexportée vers Santé.');
  if (run.endedAt === null || ![run.startedAt, run.endedAt, run.activeSeconds, run.distanceMeters].every(Number.isFinite) || run.activeSeconds <= 0 || run.distanceMeters <= 0 || run.distanceMeters > 200000) throw new Error('Santé nécessite une activité terminée avec distance et durée valides.');
  const total = run.totalSeconds;
  if (run.totalEstimated || total === undefined || !Number.isFinite(total) || total > 259200 || total < run.activeSeconds || Math.abs((run.endedAt - run.startedAt) / 1000 - total) > 2) throw new Error('La chronologie totale est absente, estimée, supérieure à 72 heures ou incohérente. L’export Santé est suspendu ; vos données locales restent conservées.');
  if (!run.clockPauses && total - run.activeSeconds > .05) throw new Error('Cette ancienne course comporte des pauses sans horodatage exact. Elles ne seront pas inventées pour Santé.');
  let previous = 0, paused = 0;
  const pauses = (run.clockPauses ?? []).map(p => {
    const to = p.to ?? total;
    if (![p.from, to].every(Number.isFinite) || p.from < previous || to < p.from || to > total + .001) throw new Error('Journal des pauses incohérent.');
    previous = to; paused += to - p.from; return { from: p.from, to };
  });
  if (Math.abs(total - paused - run.activeSeconds) > .05) throw new Error('Les pauses ne correspondent pas au temps actif enregistré.');
  return { runId: run.id, syncId: `sprinter.run.v1.${run.id}`, startedAt: run.startedAt, endedAt: run.endedAt, activeSeconds: run.activeSeconds,
    totalSeconds: total, distanceMeters: run.distanceMeters, pauses };
}
export function validateHealthWorkout(w: HealthWorkout): void {
  const year = new Date(w.startedAt).getFullYear();
  if (!validHealthUUID(w.uuid) || ![w.startedAt, w.endedAt, w.activeSeconds].every(Number.isFinite) || year < 1900 || year > 2200 || w.endedAt < w.startedAt ||
      w.endedAt > Date.now() + 5000 || w.activeSeconds <= 0 || w.activeSeconds > (w.endedAt - w.startedAt) / 1000 + .05 ||
      w.distanceMeters === null || !Number.isFinite(w.distanceMeters) || w.distanceMeters <= 0 || w.distanceMeters > 200000 ||
      typeof w.sourceName !== 'string' || typeof w.sourceBundle !== 'string') throw new Error('Les données visibles dans Santé ne contiennent pas une distance et une durée compatibles. Aucun parcours ni compteur ne sera inventé.');
}
export function importedRun(w: HealthWorkout): RunRecord {
  validateHealthWorkout(w);
  return { dataVersion: 3, id: `healthkit:${w.uuid.toLowerCase()}`, startedAt: w.startedAt, endedAt: w.endedAt, distanceMeters: w.distanceMeters!, activeSeconds: w.activeSeconds,
    totalSeconds: Math.max(w.activeSeconds, (w.endedAt - w.startedAt) / 1000), config: { ...DEFAULT_CONFIG }, target: { ...DEFAULT_TARGET }, targetUnavailable: true,
    healthKit: { uuid: w.uuid.toLowerCase(), sourceName: w.sourceName.slice(0, 200), sourceBundle: w.sourceBundle.slice(0, 300), importedAt: Date.now(),
      originalRunId: w.ownSource && typeof w.originalRunId === 'string' && w.originalRunId.length <= 200 ? w.originalRunId : null },
    points: [], splits: [], bestPace: null, reliableSeconds: 0, inTargetSeconds: 0 };
}
export function healthDuplicate(w: HealthWorkout, history: RunRecord[], receipts: HealthReceipt[] = []) {
  const receipt = receipts.find(r => r.uuid.toLowerCase() === w.uuid.toLowerCase());
  const exact = history.find(r => r.healthKit?.uuid.toLowerCase() === w.uuid.toLowerCase() || r.id === `healthkit:${w.uuid.toLowerCase()}` ||
    (w.ownSource && w.originalRunId === r.id) || receipt?.runId === r.id);
  if (exact) return { kind: 'exact' as const, run: exact };
  const probable = w.distanceMeters === null ? null : history.find(r => r.endedAt !== null && Math.abs(r.startedAt - w.startedAt) <= 60000 &&
    Math.abs(r.endedAt! - w.endedAt) <= 60000 && Math.abs(r.distanceMeters - w.distanceMeters!) <= Math.max(20, w.distanceMeters! * .01) &&
    Math.abs(r.activeSeconds - w.activeSeconds) <= Math.max(10, w.activeSeconds * .01));
  return probable ? { kind: 'probable' as const, run: probable } : null;
}
