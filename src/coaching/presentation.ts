import { CATEGORY_INFO, coachingPreset, sanitizeCoaching, type CoachLevel, type CoachingPreferences } from './config';

export const COACH_LEVEL_LABEL: Record<CoachLevel, string> = { discreet: 'Discret', normal: 'Normal', complete: 'Complet' };
export const COACH_LEVEL_DESCRIPTION: Record<CoachLevel, string> = {
  discreet: 'Les écarts d’allure, le parcours et les résultats de séance ou de défi. Moins d’interventions.',
  normal: 'L’allure, les paliers de distance, l’objectif et les transitions de séance. Un accompagnement régulier.',
  complete: 'Toutes les annonces du niveau Normal, avec des bilans de progression supplémentaires.',
};

/** Summarizes persisted choices without changing a preset or enabling any output. */
export function coachingSummary(value?: CoachingPreferences) {
  const config = sanitizeCoaching(value), preset = coachingPreset(config.level);
  const enabled = CATEGORY_INFO.filter(info => config.categories[info.key].enabled).length;
  const customized = config.minimumGapSeconds !== preset.minimumGapSeconds || config.distanceStepMeters !== preset.distanceStepMeters
    || CATEGORY_INFO.some(info => {
      const actual = config.categories[info.key], initial = preset.categories[info.key];
      return actual.enabled !== initial.enabled || actual.intervalSeconds !== initial.intervalSeconds || actual.priority !== initial.priority;
    });
  return { config, enabled, customized, label: COACH_LEVEL_LABEL[config.level] };
}
