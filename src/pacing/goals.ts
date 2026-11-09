import type { PaceTarget, RunRecord } from '../core/types';
import type { PacingPiece, PacingReference } from './types';
export const validPaceBounds = (target: { fast: number; slow: number }) => Number.isFinite(target.fast) && Number.isFinite(target.slow) && target.fast >= 120 && target.slow <= 1200 && target.fast <= target.slow;
export function targetPieces(target: PaceTarget): PacingPiece[] {
  const distance = target.distanceMeters; if (distance === null || !Number.isFinite(distance) || distance <= 0) return [];
  return target.kilometerTargets?.length ? target.kilometerTargets.map((p, i) => ({ meters: Math.max(0, Math.min(1000, distance - i * 1000)), fast: p.fast, slow: p.slow }))
    : [{ meters: distance, fast: target.fast, slow: target.slow }];
}
export function plannedDurationRange(target: PaceTarget): [number, number] | null {
  const pieces = targetPieces(target); if (!pieces.length) return null;
  const fast = pieces.reduce((s, p) => s + p.meters / 1000 * p.fast, 0), slow = pieces.reduce((s, p) => s + p.meters / 1000 * p.slow, 0);
  return Number.isFinite(fast) && Number.isFinite(slow) ? [fast, slow] : null;
}
export function validatePaceTarget(target: PaceTarget, maximumSpeed = 15): string | null {
  if (!target || !validPaceBounds(target)) return 'Choisissez une plage de 2 à 20 min/km, de la plus rapide à la plus lente.';
  if (target.distanceMeters !== null && (!Number.isFinite(target.distanceMeters) || target.distanceMeters < 100 || target.distanceMeters > 200000)) return 'Choisissez une distance comprise entre 0,1 et 200 km.';
  if (target.timeBasis !== undefined && target.timeBasis !== 'active' && target.timeBasis !== 'total') return 'Choisissez le temps actif ou le temps total pour votre objectif.';
  if (Number.isFinite(maximumSpeed) && maximumSpeed > 0 && target.slow < 1000 / maximumSpeed) return 'La plage exige une vitesse supérieure à la limite du filtre GPS.';
  if (target.kilometerTargets !== undefined) {
    if (!Array.isArray(target.kilometerTargets) || target.distanceMeters === null || target.kilometerTargets.length !== Math.ceil(target.distanceMeters / 1000) ||
        !target.kilometerTargets.every((p, i) => p && p.kilometer === i + 1 && validPaceBounds(p) && p.slow >= 1000 / maximumSpeed)) return 'Définissez une plage valide pour chaque kilomètre de la distance choisie, y compris le dernier kilomètre partiel, dans les limites du filtre GPS.';
  }
  if (target.finishSeconds != null) {
    if (target.distanceMeters === null) return 'Un temps final nécessite une distance cible.';
    if (!Number.isFinite(target.finishSeconds) || target.finishSeconds < 10 || target.finishSeconds > 259200) return 'Le temps final doit être compris entre 10 secondes et 72 heures.';
    if (target.finishSeconds < target.distanceMeters / maximumSpeed) return 'Le temps final exige une vitesse supérieure à la limite du filtre GPS.';
    const range = plannedDurationRange(target);
    if (!range || target.finishSeconds < range[0] - .001 || (target.timeBasis !== 'total' && target.finishSeconds > range[1] + .001)) return 'Le temps final est incompatible avec les allures du plan. Ajustez le temps ou les plages par kilomètre.';
  }
  return null;
}
export function paceTargetAt(target: PaceTarget, meters: number): PaceTarget | null {
  if (!target.kilometerTargets?.length) return { fast: target.fast, slow: target.slow, distanceMeters: null };
  if (meters + 1e-7 >= target.distanceMeters!) return null;
  const piece = target.kilometerTargets[Math.max(0, Math.floor((meters + 1e-7) / 1000))];
  return piece ? { fast: piece.fast, slow: piece.slow, distanceMeters: null } : null;
}
export function referenceForRun(run: RunRecord): PacingReference | null {
  if (run.targetUnavailable) return null;
  const workout = run.workout;
  let pieces: PacingPiece[], seconds: number | null | undefined, basis: 'active' | 'total';
  if (workout) {
    if (workout.status === 'abandoned') return null;
    if (!workout.segments.length || workout.segments.some(s => s.planned.end.kind !== 'distance')) return null;
    const rules = workout.definition.challenge;
    if (rules.kind === 'personalBest' && (workout.hadPause || workout.distanceInterrupted)) return null;
    seconds = rules.kind === 'timeTrial' || rules.kind === 'ghost' || rules.kind === 'personalBest' ? rules.timeLimitSeconds : null; basis = 'active';
    const meters = workout.segments.reduce((n, s) => n + s.planned.end.value, 0);
    if (seconds && workout.segments.length === 1) pieces = [{ meters, fast: seconds / meters * 1000, slow: seconds / meters * 1000 }];
    else {
      if (workout.segments.some(s => !s.planned.target || s.planned.paceRule !== 'range')) return null;
      pieces = workout.segments.map(s => ({ meters: s.planned.end.value, ...s.planned.target! }));
    }
  } else { pieces = targetPieces(run.target); seconds = run.target.finishSeconds; basis = run.target.timeBasis ?? 'active'; }
  if (!pieces.length) return null;
  const meters = pieces.reduce((n, p) => n + p.meters, 0);
  const referenceSeconds = seconds ?? pieces.reduce((n, p) => n + p.meters * (p.fast + p.slow) / 2000, 0);
  if (![meters, referenceSeconds].every(n => Number.isFinite(n) && n > 0)) return null;
  return { meters, seconds: referenceSeconds, explicitTime: seconds != null, timeBasis: basis, pieces };
}
/** A feasible schedule distributes the available range margin across all pieces. */
export function scheduledSeconds(reference: PacingReference, meters: number): number {
  const minimum = reference.pieces.reduce((n, p) => n + p.meters / 1000 * p.fast, 0);
  const maximum = reference.pieces.reduce((n, p) => n + p.meters / 1000 * p.slow, 0);
  const fraction = maximum > minimum ? Math.max(0, Math.min(1, (reference.seconds - minimum) / (maximum - minimum))) : .5;
  const base = minimum + (maximum - minimum) * fraction;
  const scale = reference.seconds / base; let remaining = Math.max(0, Math.min(reference.meters, meters)), seconds = 0;
  for (const piece of reference.pieces) {
    const covered = Math.min(piece.meters, remaining); seconds += covered / 1000 * (piece.fast + (piece.slow - piece.fast) * fraction) * scale;
    remaining -= covered; if (remaining <= 0) break;
  }
  return seconds;
}
