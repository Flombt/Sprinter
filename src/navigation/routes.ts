import type { RunRecord } from '../core/types';
import type { DiscoveryPreparation, DiscoveryWorkoutSuggestion, LinkedPlanDraft } from '../discovery/trainingLink';

export type RootRoutes = {
  Tabs: undefined;
  Recovery: undefined;
  History: undefined;
  Apple: undefined;
  Preparation: { discovery: DiscoveryPreparation } | undefined;
  DiscoveryDetail: { id: string };
  DiscoveryWorkout: { suggestion: DiscoveryWorkoutSuggestion; discovery: DiscoveryPreparation };
  Detail: { runId: string };
  ExampleDetail: { id: string };
  Shoes: undefined;
  RunSummary: { runId: string };
  Records: undefined;
  Comparison: { runId: string } | undefined;
  Progression: { discoveryPlan: LinkedPlanDraft } | undefined;
};

export function resolveRun(history: readonly RunRecord[], id: string): RunRecord | undefined {
  return history.find((run) => run.id === id);
}
