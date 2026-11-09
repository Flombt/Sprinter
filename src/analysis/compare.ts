import type { RunRecord } from '../core/types';
import { activityAnalysis } from './cache';
import { courseTimeAt, reliableDistanceRange } from './distanceTime';
import type { RunComparison } from './types';
export function equivalentDistance(a: RunRecord, b: RunRecord): boolean {
  return a.endedAt !== null && b.endedAt !== null && a.id !== b.id && a.distanceMeters > 0 && b.distanceMeters > 0 && Math.abs(a.distanceMeters - b.distanceMeters) / Math.max(a.distanceMeters, b.distanceMeters) <= .05;
}
export function compareRuns(first: RunRecord, second: RunRecord): RunComparison {
  const a = activityAnalysis(first), b = activityAnalysis(second);
  const result: RunComparison = { equivalent: false, reason: null, commonMeters: null, a, b, commonA: null, commonB: null, activeDelta: null, totalDelta: null };
  if (!equivalentDistance(first, second)) return { ...result, reason: 'Choisissez deux activités distinctes dont les distances diffèrent de 5 % au maximum.' };
  const commonMeters = Math.min(first.distanceMeters, second.distanceMeters);
  const commonA = courseTimeAt(first, a.track, commonMeters), commonB = courseTimeAt(second, b.track, commonMeters);
  if (!commonA || !commonB || !reliableDistanceRange(a.track, 0, commonMeters) || !reliableDistanceRange(b.track, 0, commonMeters)) return {
    ...result, equivalent: true, commonMeters, reason: 'Les bilans peuvent être consultés côte à côte, mais la continuité GPS ne permet pas une comparaison chronométrique fiable à distance exactement identique.' };
  return { ...result, equivalent: true, commonMeters, commonA, commonB, activeDelta: commonB.activeSeconds - commonA.activeSeconds,
    totalDelta: commonA.totalSeconds !== null && commonB.totalSeconds !== null ? commonB.totalSeconds - commonA.totalSeconds : null };
}
