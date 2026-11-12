import { useMemo, useSyncExternalStore } from 'react';
import type { PaceTarget } from '../core/types';
import type { SessionState } from '../services/session';
import { resolveRunSetup } from '../services/runSetup';
import { workouts } from '../workouts/store';
import { progression } from '../progression/store';
import { toolsStore } from '../tools/store';

const ignoreUpdates = () => () => {};
const selectedWorkout = () => workouts.getSnapshot().preferences.selected;
const progressionData = () => progression.getSnapshot().data;
const savedRoutes = () => toolsStore.getSnapshot().routes;
const selectedRouteId = () => toolsStore.getSnapshot().preferences.selectedRouteId;

export function useSavedRoutes(active = true) {
  return useSyncExternalStore(active ? toolsStore.subscribe : ignoreUpdates, savedRoutes, savedRoutes);
}

export function useRunSetup(target: PaceTarget, state: Pick<SessionState, 'history' | 'settings'>, active = true) {
  const workout = useSyncExternalStore(active ? workouts.subscribe : ignoreUpdates, selectedWorkout, selectedWorkout);
  const data = useSyncExternalStore(active ? progression.subscribe : ignoreUpdates, progressionData, progressionData);
  const routes = useSavedRoutes(active);
  const routeId = useSyncExternalStore(active ? toolsStore.subscribe : ignoreUpdates, selectedRouteId, selectedRouteId);
  const { history, settings } = state;
  const maximumSpeed = settings.config.maximumSpeed;
  return useMemo(() => resolveRunSetup({ target, history, data, workout, routes, routeId, maximumSpeed }),
    [target, history, maximumSpeed, data, workout, routes, routeId]);
}
