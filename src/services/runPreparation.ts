import type { PaceTarget } from '../core/types';
import { session } from './session';
import { workouts } from '../workouts/store';
import { progression } from '../progression/store';
import { toolsStore } from '../tools/store';
import { resolveRunSetup } from './runSetup';

export async function startPreparedRun(target: PaceTarget) {
  await Promise.all([session.initialize(), workouts.initialize(), progression.initialize(), toolsStore.initialize()]);
  const state = session.getSnapshot(), library = workouts.getSnapshot(), progress = progression.getSnapshot(), tools = toolsStore.getSnapshot();
  if (library.busy || progress.busy || tools.busy) { session.reportMessage('Vos options de course sont en cours d’enregistrement. Réessayez dans un instant.'); return false; }
  const setup = resolveRunSetup({ target, history: state.history, data: progress.data, workout: library.preferences.selected,
    routes: tools.routes, routeId: tools.preferences.selectedRouteId, maximumSpeed: state.settings.config.maximumSpeed });
  if (setup.error) { session.reportMessage(setup.error); return false; }
  const started = await session.start(setup.target, setup.definition, setup.metadata);
  if (started && (!library.ready || !progress.ready || !tools.ready)) session.reportMessage('Course démarrée. Certaines options locales indisponibles n’ont pas pu être appliquées.');
  return started;
}
