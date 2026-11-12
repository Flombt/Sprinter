import type { WorkoutDefinition } from '../workouts/types';
export type Day = string;
export interface CalendarEntry {
  id: string; day: Day; title: string; kind: 'run' | 'rest'; workout: WorkoutDefinition | null;
  status: 'planned' | 'skipped' | 'completed'; completedRunId: string | null; planId: string | null;
  note: string; createdAt: number; updatedAt: number;
}
export interface WeeklyGoal { week: Day; distanceMeters: number | null; outings: number | null }
export interface RunJournal {
  runId: string; feeling: 'great' | 'good' | 'neutral' | 'tired' | 'difficult' | null;
  difficulty: number | null; note: string; shoeId?: string | null; entryId?: string | null; updatedAt: number;
}
export interface Shoe { id: string; name: string; initialMeters: number; archived: boolean; createdAt: number }
export interface TrainingPlan {
  id: string; name: string; goalMeters: 5000 | 10000 | 21097.5; start: Day; weeks: number;
  weekdays: number[]; baseWeekMeters: number; maximumSessionMeters: number; growthPercent: number; createdAt: number;
}
export interface ProgressionData {
  version: 1; entries: CalendarEntry[]; goals: WeeklyGoal[]; journals: RunJournal[]; shoes: Shoe[]; plans: TrainingPlan[];
  selectedEntryId: string | null; defaultShoeId: string | null;
  profileName?: string;
}
export const emptyProgression = (): ProgressionData => ({ version: 1, entries: [], goals: [], journals: [], shoes: [], plans: [], selectedEntryId: null, defaultShoeId: null });
