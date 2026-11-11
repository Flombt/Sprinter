import { DEFAULT_TARGET, type PaceTarget, type RunRecord } from '../core/types';
import { validateTarget } from '../core/format';
import { entryState } from '../progression/aggregates';
import type { ProgressionData } from '../progression/types';
import type { SavedRoute } from '../routes/types';
import { effectiveTarget, expandWorkout, validateWorkout } from '../workouts/definition';
import type { WorkoutDefinition } from '../workouts/types';

/** One preparation contract shared by the quick start and the full editor. */
export function resolveRunSetup({ target, history, data, workout, routes, routeId, maximumSpeed }: {
  target: PaceTarget; history: RunRecord[]; data: ProgressionData; workout: WorkoutDefinition | null;
  routes: SavedRoute[]; routeId: string | null; maximumSpeed: number;
}) {
  const entry = data.entries.find(value => value.id === data.selectedEntryId);
  const plannedEntry = entry && entry.kind === 'run' && entry.status !== 'skipped'
    && !['completed', 'partial', 'orphaned'].includes(entryState(entry, history, data).state) ? entry : null;
  const definition = plannedEntry ? plannedEntry.workout : workout;
  const shoe = data.shoes.find(value => value.id === data.defaultShoeId && !value.archived);
  const route = routes.find(value => value.id === routeId);
  const workoutError = definition ? validateWorkout(definition)[0] ?? null : null;
  const firstTarget = definition && !workoutError ? expandWorkout(definition).map(effectiveTarget).find(value => value !== null) : null;
  const runTarget = definition ? { ...(firstTarget ?? DEFAULT_TARGET), distanceMeters: null } : target;
  const error = data.selectedEntryId && !plannedEntry ? 'La séance du calendrier est indisponible ou déjà réalisée. Revoyez les options de course.'
    : routeId && !route ? 'Le parcours sélectionné est indisponible. Choisissez un autre parcours.'
    : workoutError ?? validateTarget(runTarget, maximumSpeed);
  return { target: runTarget, definition, plannedEntry, shoe, route, error,
    metadata: { plannedEntryId: plannedEntry?.id, shoeId: shoe?.id, routeId: route?.id, routeName: route?.name } };
}
