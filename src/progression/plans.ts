import { newSegment, newWorkout, uid } from '../workouts/definition';
import { addDays } from './dates';
import { newEntry } from './entries';
import { CalendarEntry, TrainingPlan } from './types';
import { validatePlan } from './validation';
/** Calendar structure only: volumes are supplied by the runner, pace remains free. */
export function generatePlan(plan: TrainingPlan): CalendarEntry[] {
  validatePlan(plan);
  const weekdays = [...plan.weekdays].sort((a, b) => a - b), n = weekdays.length;
  const longShare = plan.goalMeters === 5000 ? .4 : plan.goalMeters === 10000 ? .45 : .5;
  const weights = Array.from({ length: n }, (_, i) => i === n - 1 ? longShare : (1 - longShare) / (n - 1));
  const entries: CalendarEntry[] = [];
  for (let week = 0; week < plan.weeks; week++) {
    const requested = plan.baseWeekMeters * (1 + plan.growthPercent / 100 * week);
    if (requested > n * plan.maximumSessionMeters + .001) throw new Error(`Semaine ${week + 1} : le volume dépasse le plafond par sortie. Réduisez le volume/la progression ou ajustez le plafond.`);
    const volumes = weights.map(() => 0); let remaining = requested, available = weights.map((_, i) => i);
    while (available.length && remaining > .0001) {
      const sum = available.reduce((s, i) => s + weights[i]!, 0);
      const capped = available.filter(i => remaining * weights[i]! / sum > plan.maximumSessionMeters);
      if (!capped.length) { for (const i of available) volumes[i] = remaining * weights[i]! / sum; break; }
      for (const i of capped) { volumes[i] = plan.maximumSessionMeters; remaining -= plan.maximumSessionMeters; }
      available = available.filter(i => !capped.includes(i));
    }
    for (let day = 0; day < 7; day++) {
      const date = addDays(plan.start, week * 7 + day), position = weekdays.indexOf(day), entry = newEntry(date, position < 0 ? 'rest' : 'run');
      entry.planId = plan.id;
      if (position >= 0) {
        const meters = Math.floor(volumes[position]!);
        if (meters < 100) throw new Error('Le volume doit permettre au moins 100 mètres par sortie.');
        const title = position === n - 1 ? 'Sortie la plus longue' : `Sortie libre ${position + 1}`;
        const workout = newWorkout(); workout.id = uid(); workout.name = `${plan.name} · S${week + 1} · ${title}`.slice(0, 100);
        workout.description = 'Organisation personnalisable, allure libre. Adaptez chaque bloc à vos sensations ; aucune performance future n’est garantie.';
        workout.blocks = [{ ...newSegment(), name: title, target: null, assessment: 'none', tolerance: 0, end: { kind: 'distance', value: meters } }];
        entry.title = `S${week + 1} · ${title}`; entry.workout = workout;
      }
      entries.push(entry);
    }
  }
  return entries;
}
