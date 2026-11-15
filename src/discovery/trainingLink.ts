import type { PaceTarget } from '../core/types';
import type { TrainingPlan } from '../progression/types';
import { addDays, calendarDays, monday } from '../progression/dates';

export interface DiscoveryPreparation {
  name: string;
  distanceKm?: number;
  event?: { id: string; day: string };
}

export type DiscoveryWorkoutSuggestion = 'endurance' | 'intervals1000';

export function linkedPlan(preparation: DiscoveryPreparation, today: string) {
  if (!preparation.event || !preparation.distanceKm) return;
  const { id, day } = preparation.event;
  const km = preparation.distanceKm;
  const goalMeters: TrainingPlan['goalMeters'] | undefined =
    km === 5 ? 5000 : km === 10 ? 10000 : km >= 21.09 && km <= 21.11 ? 21097.5 : undefined;
  if (!goalMeters) return;
  const firstMonday = monday(today) === today ? today : addDays(monday(today), 7);
  const available = Math.floor(calendarDays(firstMonday, day) / 7);
  if (available < 4) return;
  const weeks = Math.min(available, goalMeters === 5000 ? 6 : goalMeters === 10000 ? 8 : 12);
  const start = addDays(firstMonday, Math.max(0, available - weeks) * 7);
  return { name: preparation.name.slice(0, 100), goalMeters, start, weeks, targetEvent: { id, day } };
}

export type LinkedPlanDraft = NonNullable<ReturnType<typeof linkedPlan>>;

/** A route- or event-specific draft leaves the runner's normal target untouched. */
export function preparationTarget(base: PaceTarget, selection: DiscoveryPreparation): PaceTarget {
  return {
    fast: base.fast,
    slow: base.slow,
    distanceMeters: selection.distanceKm === undefined ? null : selection.distanceKm * 1000,
  };
}
