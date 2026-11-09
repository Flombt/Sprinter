import type { RunRecord } from '../core/types';
import { addDays, calendarDays, dayKey, dayStart, monday, period } from './dates';
import type { CalendarEntry, Day, ProgressionData, RunJournal } from './types';
import { workoutSignature } from '../workouts/definition';
export function recordedRun(run: RunRecord): boolean {
  const year = new Date(run.startedAt).getFullYear();
  return year >= 1900 && year <= 2200 && run.endedAt !== null && Number.isFinite(run.endedAt) && run.endedAt >= run.startedAt && Number.isFinite(run.startedAt) &&
    [run.distanceMeters, run.activeSeconds].every(n => Number.isFinite(n) && n >= 0) && (run.distanceMeters > 0 || run.activeSeconds > 0);
}
export function aggregate(history: RunRecord[], from: number, until: number, now = Date.now()) {
  const runs = history.filter(r => recordedRun(r) && r.startedAt >= from && r.startedAt < until && r.endedAt! <= now);
  let meters = 0, activeSeconds = 0, knownTotalSeconds = 0, missingTotals = 0, estimatedTotals = 0;
  const days = new Set<Day>();
  for (const r of runs) {
    meters += r.distanceMeters; activeSeconds += r.activeSeconds; days.add(dayKey(r.startedAt));
    if (r.totalSeconds !== undefined && Number.isFinite(r.totalSeconds)) { knownTotalSeconds += r.totalSeconds; if (r.totalEstimated) estimatedTotals++; } else missingTotals++;
  }
  return { runs, meters, activeSeconds, knownTotalSeconds, missingTotals, estimatedTotals, outings: runs.length, activeDays: days.size,
    averagePace: meters > 0 && activeSeconds > 0 ? activeSeconds / meters * 1000 : null };
}
export function periodComparison(history: RunRecord[], anchor: Day, kind: 'week' | 'month', now = Date.now()) {
  const current = period(anchor, kind), previous = period(addDays(current.start, -1), kind);
  const currentStart = dayStart(current.start), currentEnd = dayStart(current.end);
  const ongoing = now >= currentStart && now < currentEnd;
  let until = Math.min(currentEnd, now + 1), previousUntil = dayStart(previous.end);
  if (ongoing) {
    const offset = calendarDays(current.start, dayKey(now)), previousDay = addDays(previous.start, offset);
    const d = new Date(now), matched = new Date(dayStart(previousDay));
    matched.setHours(d.getHours(), d.getMinutes(), d.getSeconds(), d.getMilliseconds());
    previousUntil = Math.min(previousUntil, matched.getTime() + 1);
  }
  until = Math.max(currentStart, until);
  return { current, previous, until, previousUntil, ongoing,
    a: aggregate(history, currentStart, until, now), b: aggregate(history, dayStart(previous.start), previousUntil, now) };
}
const journalIndexes = new WeakMap<RunJournal[], Map<string, RunJournal>>();
function journalsById(journals: RunJournal[]) { let index = journalIndexes.get(journals); if (!index) { index = new Map(journals.map(j => [j.runId, j])); journalIndexes.set(journals, index); } return index; }
export const journalFor = (data: ProgressionData, runId: string) => journalsById(data.journals).get(runId);
export function effectiveEntry(run: RunRecord, journals: RunJournal[]): string | null {
  const journal = journalsById(journals).get(run.id);
  return journal && journal.entryId !== undefined ? journal.entryId : run.plannedEntryId ?? null;
}
const linkIndexes = new WeakMap<ProgressionData, WeakMap<RunRecord[], Map<string, RunRecord[]>>>();
function linkedRuns(history: RunRecord[], data: ProgressionData) {
  let byHistory = linkIndexes.get(data); if (!byHistory) { byHistory = new WeakMap(); linkIndexes.set(data, byHistory); }
  let index = byHistory.get(history);
  if (!index) { index = new Map(); for (const run of history.filter(recordedRun).sort((a, b) => a.startedAt - b.startedAt)) { const id = effectiveEntry(run, data.journals); if (id) { const values = index.get(id) ?? []; values.push(run); index.set(id, values); } } byHistory.set(history, index); }
  return index;
}
export function entryState(entry: CalendarEntry, history: RunRecord[], data: ProgressionData, today = dayKey()) {
  const linked = linkedRuns(history, data).get(entry.id) ?? [];
  const run = linked.find(r => r.id === entry.completedRunId) ?? linked[0] ?? null;
  if (run) return { state: entry.workout && (run.workout?.status !== 'completed' || workoutSignature(entry.workout) !== workoutSignature(run.workout.definition)) ? 'partial' as const : 'completed' as const, run };
  if (entry.completedRunId) return { state: 'orphaned' as const, run: null };
  if (entry.status === 'skipped') return { state: 'skipped' as const, run: null };
  if (entry.kind === 'rest') return { state: entry.day < today ? 'restPast' as const : 'rest' as const, run: null };
  return { state: entry.day < today ? 'missed' as const : 'planned' as const, run: null };
}
export function shoeMileage(history: RunRecord[], data: ProgressionData, shoeId: string) {
  const runs = history.filter(r => recordedRun(r) && (journalFor(data, r.id)?.shoeId !== undefined ? journalFor(data, r.id)!.shoeId : r.shoeId) === shoeId);
  const measuredMeters = runs.reduce((sum, r) => sum + r.distanceMeters, 0);
  return { runs: runs.length, measuredMeters, totalMeters: measuredMeters + (data.shoes.find(s => s.id === shoeId)?.initialMeters ?? 0) };
}
export function consistency(history: RunRecord[], now = Date.now()) {
  const today = dayKey(now), currentWeek = monday(today), lastWeek = addDays(currentWeek, -7), firstWindow = addDays(currentWeek, -84);
  const actual = history.filter(r => recordedRun(r) && r.endedAt! <= now).sort((a, b) => a.startedAt - b.startedAt);
  const start = actual.length ? (dayKey(actual[0]!.startedAt) > firstWindow ? dayKey(actual[0]!.startedAt) : firstWindow) : today;
  const days = new Set(actual.filter(r => dayKey(r.startedAt) >= start).map(r => dayKey(r.startedAt)));
  const observedDays = actual.length ? calendarDays(start, today) + 1 : 0;
  const weeks = Array.from({ length: 12 }, (_, i) => addDays(firstWindow, i * 7)).filter(w => dayStart(w) >= (actual[0]?.startedAt ? dayStart(monday(dayKey(actual[0].startedAt))) : Infinity));
  const counts = weeks.map(w => aggregate(actual, dayStart(w), dayStart(addDays(w, 7)), now));
  const activeWeeks = counts.filter(w => w.outings > 0).length;
  let currentStreak = 0, cursor = days.size && [...days].some(d => d >= currentWeek) ? currentWeek : lastWeek;
  const activeWeekKeys = new Set(actual.map(r => monday(dayKey(r.startedAt))));
  while (activeWeekKeys.has(cursor)) { currentStreak++; cursor = addDays(cursor, -7); }
  const outings = actual.filter(r => dayKey(r.startedAt) >= start).length;
  return { observedDays, activeDays: days.size, daysWithoutRun: Math.max(0, observedDays - days.size), outingsPerWeek: observedDays ? outings * 7 / observedDays : null,
    completeWeeks: weeks.length, activeWeeks, weeklyConsistency: weeks.length ? activeWeeks / weeks.length * 100 : null, currentStreak, counts, weeks };
}
