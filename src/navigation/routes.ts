import type { RunRecord } from '../core/types';

export type RootRoutes = {
  Tabs: undefined;
  Recovery: undefined;
  History: undefined;
  Apple: undefined;
  Preparation: undefined;
  Detail: { runId: string };
  RunSummary: { runId: string };
  Records: undefined;
  Comparison: { runId: string } | undefined;
  Progression: undefined;
};

export function resolveRun(history: readonly RunRecord[], id: string): RunRecord | undefined {
  return history.find(run => run.id === id);
}
