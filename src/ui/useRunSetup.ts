import { useMemo, useSyncExternalStore } from 'react';
import type { PaceTarget } from '../core/types';
import type { SessionState } from '../services/session';
import { resolveRunSetup } from '../services/runSetup';
import { workouts } from '../workouts/store';
import { progression } from '../progression/store';
import { toolsStore } from '../tools/store';

export function useRunSetup(target: PaceTarget, state: SessionState) {
  const library = useSyncExternalStore(workouts.subscribe, workouts.getSnapshot, workouts.getSnapshot);
  const progress = useSyncExternalStore(
    progression.subscribe,
    progression.getSnapshot,
    progression.getSnapshot,
  );
  const tools = useSyncExternalStore(toolsStore.subscribe, toolsStore.getSnapshot, toolsStore.getSnapshot);
  return useMemo(
    () =>
      resolveRunSetup({
        target,
        history: state.history,
        data: progress.data,
        workout: library.preferences.selected,
        routes: tools.routes,
        routeId: tools.preferences.selectedRouteId,
        maximumSpeed: state.settings.config.maximumSpeed,
      }),
    [
      target,
      state.history,
      state.settings.config.maximumSpeed,
      progress.data,
      library.preferences.selected,
      tools.routes,
      tools.preferences.selectedRouteId,
    ],
  );
}
