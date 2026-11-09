import { validateWorkout } from '../workouts/definition';
import { monday, validDay } from './dates';
import { ProgressionData, CalendarEntry, WeeklyGoal, RunJournal, Shoe, TrainingPlan } from './types';
const id = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 200;
const text = (v: unknown, limit: number) => typeof v === 'string' && v.length <= limit;
const optionalId = (v: unknown) => v === null || id(v);
const finite = (n: number, low: number, high: number) => Number.isFinite(n) && n >= low && n <= high;
export function validateEntry(e: CalendarEntry): void {
  if (!e || !id(e.id) || !validDay(e.day) || !text(e.title, 100) || !e.title.trim() || !['run', 'rest'].includes(e.kind) ||
      !['planned', 'skipped', 'completed'].includes(e.status) || !optionalId(e.completedRunId) || !optionalId(e.planId) ||
      !text(e.note, 3000) || ![e.createdAt, e.updatedAt].every(Number.isFinite) || (e.kind === 'rest' && (e.workout !== null || e.completedRunId !== null))) throw new Error('Élément du calendrier invalide.');
  if (e.workout && validateWorkout(e.workout).length) throw new Error(validateWorkout(e.workout)[0]);
}
export function validateGoal(g: WeeklyGoal): void {
  if (!g || !validDay(g.week) || monday(g.week) !== g.week || (g.distanceMeters === null && g.outings === null) ||
    (g.distanceMeters !== null && !finite(g.distanceMeters, 100, 500000)) || (g.outings !== null && (!Number.isInteger(g.outings) || !finite(g.outings, 1, 28)))) throw new Error('Objectif : semaine commençant lundi, distance de 0,1 à 500 km ou 1 à 28 sorties.');
}
export function validateJournal(j: RunJournal): void {
  if (!j || !id(j.runId) || (j.feeling !== null && !['great', 'good', 'neutral', 'tired', 'difficult'].includes(j.feeling)) ||
      (j.difficulty !== null && (!Number.isInteger(j.difficulty) || !finite(j.difficulty, 1, 10))) || !text(j.note, 5000) || !Number.isFinite(j.updatedAt) ||
      (j.shoeId !== undefined && !optionalId(j.shoeId)) || (j.entryId !== undefined && !optionalId(j.entryId))) throw new Error('Journal invalide : difficulté de 1 à 10 et note de 5 000 caractères maximum.');
}
export function validateShoe(s: Shoe): void {
  if (!s || !id(s.id) || !text(s.name, 100) || !s.name.trim() || !finite(s.initialMeters, 0, 100000000) || typeof s.archived !== 'boolean' || !Number.isFinite(s.createdAt)) throw new Error('Chaussure invalide : nom requis et kilométrage initial positif ou nul.');
}
export function validatePlan(p: TrainingPlan): void {
  if (!p || !id(p.id) || !text(p.name, 100) || !p.name.trim() || ![5000, 10000, 21097.5].includes(p.goalMeters) || !validDay(p.start) || monday(p.start) !== p.start ||
      !Number.isInteger(p.weeks) || !finite(p.weeks, 4, 24) || !Array.isArray(p.weekdays) || p.weekdays.length < 2 || p.weekdays.length > 4 ||
      new Set(p.weekdays).size !== p.weekdays.length || !p.weekdays.every(d => Number.isInteger(d) && d >= 0 && d <= 6) ||
      !finite(p.baseWeekMeters, 1000, 200000) || !finite(p.maximumSessionMeters, 500, 30000) || !finite(p.growthPercent, 0, 10) || !Number.isFinite(p.createdAt)) throw new Error('Plan : 4 à 24 semaines, 2 à 4 jours distincts, volume explicite et plafond de 0,5 à 30 km par sortie.');
}
/** Unknown versions/corruption are retained by the adapter, never replaced with empty data. */
export function readProgression(value: unknown): ProgressionData {
  const data = value as ProgressionData;
  if (!data || data.version !== 1 || ![data.entries, data.goals, data.journals, data.shoes, data.plans].every(Array.isArray) ||
      data.entries.length > 10000 || data.journals.length > 100000 || data.goals.length > 10000 || data.shoes.length > 1000 || data.plans.length > 1000 ||
      !optionalId(data.selectedEntryId) || !optionalId(data.defaultShoeId)) throw new Error('Stockage de progression illisible ou version inconnue. Les données ont été conservées.');
  data.entries.forEach(validateEntry); data.goals.forEach(validateGoal); data.journals.forEach(validateJournal); data.shoes.forEach(validateShoe); data.plans.forEach(validatePlan);
  for (const values of [data.entries.map(e => e.id), data.journals.map(j => j.runId), data.shoes.map(s => s.id), data.goals.map(g => g.week), data.plans.map(p => p.id)]) if (new Set(values).size !== values.length) throw new Error('Identifiants de progression dupliqués. Données conservées.');
  return data;
}
