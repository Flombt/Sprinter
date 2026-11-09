import { RunRecord } from '../core/types';
import { DEFAULT_RULES, makeGhost, makePersonalBest, newSegment, uid } from './definition';
import { WorkoutDefinition, WorkoutKind, WorkoutSegment } from './types';

function segment(name: string, meters: number | null, seconds: number | null, fast: number | null = null, slow: number | null = null, effort: WorkoutSegment['effort'] = 'effort'): WorkoutSegment {
  return { ...newSegment(), name, effort, end: meters !== null ? { kind: 'distance', value: meters } : { kind: 'duration', value: seconds! },
    target: fast !== null && slow !== null ? { fast, slow } : null, assessment: fast !== null ? 'averagePace' : 'none' };
}
export const TEMPLATE_INFO: { kind: Exclude<WorkoutKind, 'custom'>; name: string; description: string }[] = [
  { kind: 'survival', name: 'Survie 5 km', description: 'Gardez votre allure. Un budget de temps hors cible, consécutif ou cumulé.' },
  { kind: 'intervals', name: 'Fractionné 10 × 400 m', description: 'Efforts mesurés sur la distance réelle, récupérations et répétitions automatiques.' },
  { kind: 'intervals1000', name: 'Fractionné 5 × 1 000 m', description: 'Cinq kilomètres d’effort, séparés par des récupérations ajustables.' },
  { kind: 'progressive', name: 'Accélération progressive 5 km', description: 'Une nouvelle allure cible à chaque kilomètre, avec comparaison des moyennes.' },
  { kind: 'timeTrial', name: 'Contre-la-montre', description: 'Atteignez votre distance avant le temps limite choisi.' },
  { kind: 'pyramid', name: 'Pyramide', description: '200 / 400 / 800 / 400 / 200 m, avec récupérations configurables.' },
  { kind: 'endurance', name: 'Endurance régulière', description: 'Trente minutes dans une plage d’allure configurable.' },
  { kind: 'ghost', name: 'Bats ton fantôme', description: 'Comparez votre progression à une vraie course enregistrée de distance comparable.' },
  { kind: 'personalBest', name: 'Bats ton record personnel', description: 'Choisissez un record GPS fiable sur 1 km, 5 km, 10 km, semi ou marathon et battez son chrono sans pause.' },
  { kind: 'regularity', name: 'Défi régularité', description: 'Gardez une allure stable : score sur 100 et minimum de temps en cible configurables.' },
  { kind: 'finalSprint', name: 'Sprint final', description: 'Une première partie régulière avant un dernier segment plus rapide.' },
];
export function createTemplate(kind: Exclude<WorkoutKind, 'custom'>, reference?: RunRecord, recordDistance?: number): WorkoutDefinition {
  const info = TEMPLATE_INFO.find(t => t.kind === kind)!;
  const result: WorkoutDefinition = { version: 1, id: uid(), name: info.name, description: info.description, kind,
    createdAt: Date.now(), updatedAt: Date.now(), blocks: [], challenge: { ...DEFAULT_RULES } };
  if (kind === 'survival') {
    result.blocks = [{ ...segment('Survie', 5000, null, 310, 330), assessment: 'none' }];
    result.challenge = { ...DEFAULT_RULES, kind: 'survival' };
  } else if (kind === 'intervals' || kind === 'intervals1000') {
    const meters = kind === 'intervals1000' ? 1000 : 400;
    result.blocks = [segment('Échauffement', null, 300, null, null, 'warmup'),
      { kind: 'repeat', id: uid(), count: kind === 'intervals1000' ? 5 : 10, blocks: [segment(`${meters} m rapides`, meters, null, kind === 'intervals1000' ? 285 : 270, kind === 'intervals1000' ? 315 : 300), segment('Récupération', null, kind === 'intervals1000' ? 120 : 90, null, null, 'recovery')] },
      segment('Retour au calme', null, 180, null, null, 'cooldown')];
  } else if (kind === 'progressive') {
    result.blocks = Array.from({ length: 5 }, (_, i) => segment(`Kilomètre ${i + 1}`, 1000, null, 360 - 10 * i, 380 - 10 * i));
    result.challenge = { ...DEFAULT_RULES, kind: 'progression' };
  } else if (kind === 'timeTrial') {
    result.blocks = [segment('Distance à couvrir', 5000, null)];
    result.challenge = { ...DEFAULT_RULES, kind: 'timeTrial', timeLimitSeconds: 1500 };
  } else if (kind === 'pyramid') {
    result.blocks = [segment('Échauffement', null, 300, null, null, 'warmup')];
    [200, 400, 800, 400, 200].forEach((meters, i) => {
      result.blocks.push(segment(`Pyramide · ${meters} m`, meters, null, 280, 310));
      if (i < 4) result.blocks.push(segment('Récupération', null, 90, null, null, 'recovery'));
    });
    result.blocks.push(segment('Retour au calme', null, 180, null, null, 'cooldown'));
  } else if (kind === 'endurance') {
    result.blocks = [{ ...segment('Endurance régulière', null, 1800, 330, 350), assessment: 'compliance', minimumCompliance: 80 }];
  } else if (kind === 'regularity') {
    result.blocks = [{ ...segment('Allure régulière', null, 1200, 330, 350), assessment: 'compliance', minimumCompliance: 80 }];
    result.challenge = { ...DEFAULT_RULES, kind: 'regularity', minimumStabilityScore: 80 };
  } else if (kind === 'ghost' || kind === 'personalBest') {
    if (!reference) throw new Error('Choisissez d’abord une course enregistrée avec un parcours GPS.');
    const ghost = kind === 'personalBest' ? makePersonalBest(reference, recordDistance ?? 5000) : makeGhost(reference);
    result.blocks = [segment(kind === 'personalBest' ? 'Bats ton record' : 'Bats ton fantôme', ghost.distanceMeters, null)];
    result.challenge = { ...DEFAULT_RULES, kind, ghost, timeLimitSeconds: ghost.seconds };
  } else {
    result.blocks = [segment('Rythme initial', 4500, null, 330, 350), segment('Derniers 500 m', 500, null, 280, 310)];
    result.challenge = { ...DEFAULT_RULES, kind: 'progression' };
  }
  return result;
}
