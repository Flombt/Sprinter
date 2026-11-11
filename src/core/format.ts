import { PaceTarget, RunRecord, Split } from './types';
import { plannedDurationRange } from '../pacing/goals';
export { validatePaceTarget as validateTarget } from '../pacing/goals';

export function pace(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value) || value <= 0 || value >= 6000) return '—';
  const rounded = Math.round(value);
  return `${Math.floor(rounded / 60)}′${String(rounded % 60).padStart(2, '0')}″`;
}
export function duration(value: number): string {
  const n = Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
  return n >= 3600 ? `${Math.floor(n / 3600)}:${String(Math.floor(n / 60) % 60).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`
    : `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`;
}
export const km = (meters: number, digits = 2) => (meters / 1000).toLocaleString('fr-FR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
export const inTarget = (value: number, target: PaceTarget) => target.fast === target.slow
  ? Math.round(value) === Math.round(target.fast) : value >= target.fast && value <= target.slow;
export const averagePace = (run: RunRecord) => run.distanceMeters > 0 ? run.activeSeconds / run.distanceMeters * 1000 : null;
export const averageSpeed = (run: RunRecord) => run.activeSeconds > 0 ? run.distanceMeters / run.activeSeconds * 3.6 : null;
export const targetPercentage = (run: RunRecord) => run.reliableSeconds > 0 ? Math.min(100, run.inTargetSeconds / run.reliableSeconds * 100) : null;
export function estimatedDuration(target: PaceTarget): [number, number] | null {
  return plannedDurationRange(target);
}
export const targetLabel = (target: PaceTarget) => target.fast === target.slow ? pace(target.fast) : `${pace(target.fast)} – ${pace(target.slow)}`;
export const runDate = (timestamp: number) => new Date(timestamp).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
export function allSplits(run: RunRecord): Split[] {
  const result = [...run.splits];
  const remainder = run.distanceMeters - result.length * 1000;
  if (remainder > 1) result.push({ kilometer: result.length + 1, meters: remainder,
    seconds: Math.max(0, run.activeSeconds - result.reduce((sum, s) => sum + s.seconds, 0)), complete: false });
  return result;
}
