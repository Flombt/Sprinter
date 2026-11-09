import type { RunRecord } from '../core/types';
import type { RunAnalysis } from './types';
import { analyzeRun } from './summary';
// Full routes/series are bounded; personal-record summaries use a separate small WeakMap.
const cache = new Map<RunRecord, RunAnalysis>();
export function forgetActivityAnalysis(id: string) {
  for (const run of cache.keys()) if (run.id === id) cache.delete(run);
}
export function activityAnalysis(run: RunRecord): RunAnalysis {
  const found = cache.get(run);
  if (found) { cache.delete(run); cache.set(run, found); return found; }
  const result = analyzeRun(run); cache.set(run, result);
  while (cache.size > 6) cache.delete(cache.keys().next().value!);
  return result;
}
