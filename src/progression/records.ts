import type { RecordPerformance } from '../analysis/types';
import { RECORD_DISTANCES } from '../analysis/types';
export interface RecordMilestone { performance: RecordPerformance; label: string; previousSeconds: number | null; gainSeconds: number | null }
/** One best measured segment per activity/distance; equal times do not create a new record. */
export function recordTimeline(performances: RecordPerformance[]): RecordMilestone[] {
  const unique = [...new Map(performances.map(p => [`${p.runId}:${p.meters}`, p])).values()];
  unique.sort((a, b) => a.endedAt - b.endedAt || a.startedAt - b.startedAt || a.runId.localeCompare(b.runId));
  const best = new Map<number, number>(), result: RecordMilestone[] = [];
  for (const p of unique) {
    const year = new Date(p.endedAt).getFullYear(); if (!(year >= 1900 && year <= 2200)) continue;
    const previous = best.get(p.meters), label = RECORD_DISTANCES.find(d => d.meters === p.meters)?.label;
    if (!label || !Number.isFinite(p.seconds) || p.seconds <= 0 || (previous !== undefined && p.seconds >= previous - 1e-6)) continue;
    result.push({ performance: p, label, previousSeconds: previous ?? null, gainSeconds: previous === undefined ? null : previous - p.seconds }); best.set(p.meters, p.seconds);
  }
  return result;
}
