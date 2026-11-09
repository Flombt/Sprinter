import { duration, km } from '../core/format';
import { expandWorkout, segmentTarget } from './definition';
import type { WorkoutBlock, WorkoutDefinition, WorkoutKind } from './types';

export const WORKOUT_TYPES: Record<WorkoutKind, string> = {
  survival: 'Survie', intervals: 'Fractionné', intervals1000: 'Fractionné', progressive: 'Progressif',
  timeTrial: 'Contre-la-montre', pyramid: 'Pyramide', endurance: 'Endurance', ghost: 'Fantôme',
  personalBest: 'Record personnel', regularity: 'Régularité', finalSprint: 'Sprint final', custom: 'Sur mesure',
};
export const TRAINING_KINDS = ['endurance', 'intervals', 'progressive', 'intervals1000', 'pyramid', 'finalSprint'] as const;
export const CHALLENGE_KINDS = ['survival', 'timeTrial', 'regularity', 'ghost', 'personalBest'] as const;

export interface WorkoutPresentation {
  type: string; complexity: 'Simple' | 'Structurée' | 'Avancée'; volume: string; structure: string; goal: string; detail?: string;
}
const cache = new WeakMap<WorkoutDefinition, WorkoutPresentation>();
const metersLabel = (meters: number) => meters < 1000 ? `${meters.toLocaleString('fr-FR')} m` : `${km(meters, meters % 1000 === 0 ? 0 : 2)} km`;
function repeatDepth(blocks: WorkoutBlock[]): number { return blocks.reduce((depth, block) => Math.max(depth, block.kind === 'repeat' ? 1 + repeatDepth(block.blocks) : 0), 0); }

/** Labels describe the recorded definition; they never change a block or prescribe an intensity. */
export function workoutPresentation(definition: WorkoutDefinition): WorkoutPresentation {
  const cached = cache.get(definition); if (cached) return cached;
  const segments = expandWorkout(definition), rules = definition.challenge;
  if (!segments.length || segments.some(s => !Number.isFinite(s.end.value) || s.end.value <= 0)) throw new Error('Configuration à compléter.');
  const efforts = segments.filter(s => s.effort === 'effort');
  const meters = segments.reduce((sum, s) => sum + (s.end.kind === 'distance' ? s.end.value : 0), 0);
  const seconds = segments.reduce((sum, s) => sum + (s.end.kind === 'duration' ? s.end.value : 0), 0);
  const conditions = segments.some(s => s.end.kind === 'inTarget');
  const depth = repeatDepth(definition.blocks);
  const complexity = ['ghost', 'personalBest', 'survival'].includes(rules.kind) || conditions || depth > 1 ? 'Avancée'
    : depth > 0 || efforts.length > 1 || rules.kind !== 'none' ? 'Structurée' : 'Simple';
  let volume = conditions ? `${segments.length} blocs` : meters > 0 ? metersLabel(meters) : `${duration(seconds)} au total`;
  let detail = conditions ? 'La durée dépend des conditions en cible.' : undefined;
  if (meters > 0 && seconds > 0) {
    const effortDistance = efforts.length > 0 && efforts.every(s => s.end.kind === 'distance');
    volume = effortDistance ? `${metersLabel(efforts.reduce((sum, s) => sum + s.end.value, 0))} d’effort` : `${metersLabel(meters)} en blocs distance`;
    detail = `${duration(seconds)} de blocs chronométrés en plus. Distance totale variable.`;
  }
  if (conditions) detail = `${seconds > 0 ? `${duration(seconds)} de blocs chronométrés. ` : ''}Certains blocs se terminent selon le temps en cible ; leur durée réelle reste variable.`;
  const first = efforts[0];
  const uniformRepeatedDistance = first?.end.kind === 'distance' && efforts.every(s => s.repetition !== null && s.end.kind === 'distance' && s.end.value === first.end.value);
  const structure = uniformRepeatedDistance ? `${efforts.length} × ${metersLabel(first!.end.value)}`
    : efforts.length > 1 ? `${efforts.length} blocs d’effort` : `${segments.length} ${segments.length === 1 ? 'bloc' : 'blocs'}`;
  let goal = 'Suivre les blocs à allure libre.';
  if (rules.kind === 'survival') goal = `${duration(rules.allowedOutsideSeconds)} ${rules.outsideMode === 'cumulative' ? 'cumulées' : 'consécutives'} autorisées hors cible.`;
  else if (rules.kind === 'timeTrial') goal = `Terminer avant ${duration(rules.timeLimitSeconds ?? 0)}.`;
  else if (rules.kind === 'regularity') goal = `Stabilité visée : ${rules.minimumStabilityScore ?? 80} /100.`;
  else if (rules.kind === 'progression') goal = `Accélérer entre les efforts : au moins ${rules.progressionSeconds} s/km.`;
  else if (rules.kind === 'ghost' || rules.kind === 'personalBest') goal = `Battre ${duration(rules.ghost?.seconds ?? 0)} sur la référence choisie.`;
  else {
    const targets = efforts.filter(s => s.target);
    if (targets.length) {
      const values = [...new Set(targets.map(segmentTarget))];
      goal = values.length === 1 ? values[0]! : 'Des plages d’allure propres à chaque bloc.';
    }
  }
  const result: WorkoutPresentation = { type: WORKOUT_TYPES[definition.kind], complexity, volume, structure, goal, detail };
  cache.set(definition, result); return result;
}

export function referencePresentation(kind: 'ghost' | 'personalBest'): WorkoutPresentation {
  return { type: WORKOUT_TYPES[kind], complexity: 'Avancée', volume: 'Référence à choisir', structure: 'Parcours GPS requis',
    goal: kind === 'personalBest' ? 'Battre un record personnel mesuré.' : 'Battre le chrono d’une course enregistrée.' };
}
