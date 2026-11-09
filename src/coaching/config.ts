import type { CoachingEvent, CoachingKind } from '../workouts/types';

export type CoachLevel = 'discreet' | 'normal' | 'complete';
export type AnnouncementCategory = 'pace' | 'recovered' | 'distance' | 'timeGoal' | 'workout' | 'anticipation' | 'challenge' | 'progress' | 'session' | 'navigation';
export type AnnouncementPriority = 'low' | 'normal' | 'high';
export interface AnnouncementRule { enabled: boolean; intervalSeconds: number; priority: AnnouncementPriority }
export interface CoachingPreferences {
  version: 1; level: CoachLevel; minimumGapSeconds: number; distanceStepMeters: number;
  categories: Record<AnnouncementCategory, AnnouncementRule>;
}
export const CATEGORY_INFO: { key: AnnouncementCategory; title: string; description: string; minimum: number; interval: number }[] = [
  { key: 'navigation', title: 'Écart au parcours', description: 'Éloignement confirmé d’un tracé choisi et retour à proximité.', minimum: 30, interval: 60 },
  { key: 'pace', title: 'Accélérer ou ralentir', description: 'Écarts confirmés par le moteur d’allure.', minimum: 15, interval: 30 },
  { key: 'recovered', title: 'Retour dans la plage', description: 'Retour stable après un écart confirmé.', minimum: 15, interval: 30 },
  { key: 'distance', title: 'Distance parcourue', description: 'Paliers de distance réellement enregistrée.', minimum: 15, interval: 30 },
  { key: 'timeGoal', title: 'Avance et retard', description: 'Informations fiables sur l’objectif chronométrique.', minimum: 60, interval: 60 },
  { key: 'workout', title: 'Blocs et répétitions', description: 'Débuts d’effort, récupérations et changements de séance.', minimum: 5, interval: 5 },
  { key: 'anticipation', title: 'Prochaine transition', description: 'Prévenir dix secondes avant ; estimation signalée si nécessaire.', minimum: 10, interval: 10 },
  { key: 'challenge', title: 'Alertes et résultat du défi', description: 'Budget, réussite ou défaite ; résultats prioritaires.', minimum: 5, interval: 5 },
  { key: 'progress', title: 'Bilans de progression', description: 'Distance, temps actif et allure fiable.', minimum: 60, interval: 120 },
  { key: 'session', title: 'Fin de séance et de course', description: 'Fin des blocs ou confirmation après sauvegarde.', minimum: 5, interval: 5 },
];
export function coachingPreset(level: CoachLevel): CoachingPreferences {
  const categories = Object.fromEntries(CATEGORY_INFO.map(info => [info.key, {
    enabled: level === 'complete' || (level === 'normal' ? info.key !== 'progress' : ['pace', 'challenge', 'session', 'navigation'].includes(info.key)),
    intervalSeconds: info.interval, priority: 'normal' as const,
  }])) as CoachingPreferences['categories'];
  return { version: 1, level, minimumGapSeconds: level === 'discreet' ? 15 : level === 'complete' ? 6 : 8, distanceStepMeters: 1000, categories };
}
export function sanitizeCoaching(value?: Partial<CoachingPreferences> | null): CoachingPreferences {
  const level = value?.level === 'discreet' || value?.level === 'complete' ? value.level : 'normal';
  const result = coachingPreset(level);
  const bounded = (n: unknown, low: number, high: number, fallback: number) => typeof n === 'number' && Number.isFinite(n) ? Math.min(high, Math.max(low, Math.round(n))) : fallback;
  result.minimumGapSeconds = bounded(value?.minimumGapSeconds, 3, 30, result.minimumGapSeconds);
  result.distanceStepMeters = [500, 1000, 2000, 5000].includes(value?.distanceStepMeters ?? 0) ? value!.distanceStepMeters! : 1000;
  for (const info of CATEGORY_INFO) {
    const rule = value?.categories?.[info.key], target = result.categories[info.key];
    if (typeof rule?.enabled === 'boolean') target.enabled = rule.enabled;
    target.intervalSeconds = bounded(rule?.intervalSeconds, info.minimum, 600, target.intervalSeconds);
    if (rule?.priority === 'low' || rule?.priority === 'normal' || rule?.priority === 'high') target.priority = rule.priority;
  }
  return result;
}
export function eventCategory(kind: CoachingKind): AnnouncementCategory {
  if (kind === 'routeOff' || kind === 'routeBack') return 'navigation';
  if (kind === 'paceDeviation') return 'pace';
  if (kind === 'paceRecovered') return 'recovered';
  if (kind === 'distanceMilestone') return 'distance';
  if (['timeAhead', 'timeBehind', 'goalReached', 'goalExpired'].includes(kind)) return 'timeGoal';
  if (kind === 'transitionSoon') return 'anticipation';
  if (['challengeWon', 'challengeLost', 'challengeWarning'].includes(kind)) return 'challenge';
  if (['workoutCompleted', 'workoutAbandoned', 'runCompleted'].includes(kind)) return 'session';
  if (kind === 'progressUpdate') return 'progress';
  return 'workout';
}
export const terminalEvent = (event: CoachingEvent) => ['challengeWon', 'challengeLost', 'workoutCompleted', 'workoutAbandoned', 'runCompleted'].includes(event.kind);
export function effectivePriority(event: CoachingEvent, config: CoachingPreferences): number {
  if (['challengeWon', 'challengeLost'].includes(event.kind)) return 100;
  if (terminalEvent(event)) return 90;
  const offset = { low: -15, normal: 0, high: 15 }[config.categories[eventCategory(event.kind)].priority];
  return Math.min(85, Math.max(10, event.priority + offset));
}
