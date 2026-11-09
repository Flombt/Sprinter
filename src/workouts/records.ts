import { RunRecord } from '../core/types';
import { workoutSignature, workoutStatistics } from './definition';
export interface WorkoutRecordGroup { key: string; name: string; metric: 'time' | 'consistency' | 'stability'; attempts: RunRecord[] }
export function workoutRecords(history: RunRecord[]): WorkoutRecordGroup[] {
  const groups = new Map<string, WorkoutRecordGroup>();
  for (const run of history) {
    const workout = run.workout;
    if (!workout || workout.status !== 'completed' || workout.challengeStatus !== 'succeeded' || workout.awaitingFinalFix) continue;
    const key = workoutSignature(workout.definition);
    const stats = workoutStatistics(workout);
    if (workout.definition.challenge.kind === 'regularity' && stats.stability.score === null) continue;
    const metric = workout.definition.challenge.kind === 'regularity' ? 'stability' : workout.segments.every(s => s.planned.end.kind === 'duration') && stats.targetPercentage !== null ? 'consistency' : 'time';
    const group = groups.get(key) ?? { key, name: workout.definition.name, metric, attempts: [] };
    group.attempts.push(run); groups.set(key, group);
  }
  return [...groups.values()].map(group => ({ ...group, attempts: group.attempts.sort((a, b) => group.metric === 'time'
    ? workoutStatistics(a.workout!).elapsed - workoutStatistics(b.workout!).elapsed
    : group.metric === 'stability' ? (workoutStatistics(b.workout!).stability.score ?? 0) - (workoutStatistics(a.workout!).stability.score ?? 0)
    : (workoutStatistics(b.workout!).targetPercentage ?? 0) - (workoutStatistics(a.workout!).targetPercentage ?? 0)) }));
}
