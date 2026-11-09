import { RunRecord } from '../core/types';
import { duration, km, pace } from '../core/format';
import { measuredSegmentTrace, runRecords } from '../analysis/records';
import { cleanTrack } from '../analysis/track';
import { atDistance, reliableDistanceRange } from '../analysis/distanceTime';
import { stabilityStatistics, validPaceMoments } from './stability';
import { ChallengeRules, GhostReference, PlannedSegment, SegmentPace, SegmentResult, WorkoutBlock, WorkoutDefinition, WorkoutSegment, WorkoutSnapshot, WorkoutStatistics } from './types';

export const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`;
export const DEFAULT_RULES: ChallengeRules = { kind: 'none', outsideMode: 'consecutive', allowedOutsideSeconds: 20,
  warningSeconds: 5, timeLimitSeconds: null, minimumCoverage: .8, progressionSeconds: 1, ghost: null };
export function newSegment(): WorkoutSegment {
  return { kind: 'segment', id: uid(), name: 'Effort', effort: 'effort', end: { kind: 'distance', value: 1000 },
    target: { fast: 310, slow: 330 }, tolerance: 3, paceRule: 'range', assessment: 'averagePace', minimumCompliance: 80, maximumSeconds: null };
}
export function newWorkout(): WorkoutDefinition {
  return { version: 1, id: uid(), name: 'Ma séance', description: '', kind: 'custom', createdAt: Date.now(), updatedAt: Date.now(), blocks: [newSegment()], challenge: { ...DEFAULT_RULES } };
}
/** Apply one offset without flattening the progression or changing any block duration. */
export function shiftWorkoutPaces(definition: WorkoutDefinition, seconds: number): WorkoutDefinition {
  if (!Number.isFinite(seconds)) throw new Error('Ajustement d’allure invalide.');
  let found = false;
  const visit = (blocks: WorkoutBlock[]): WorkoutBlock[] => blocks.map(block => {
    if (block.kind === 'repeat') return { ...block, blocks: visit(block.blocks) };
    if (!block.target) return block;
    found = true;
    const target = { fast: block.target.fast + seconds, slow: block.target.slow + seconds };
    if (![target.fast, target.slow].every(Number.isFinite) || target.fast < 120 || target.slow > 1200 || target.fast > target.slow) throw new Error('Toutes les plages doivent rester valides entre 2 et 20 min/km. Corrigez les allures ou choisissez un ajustement plus faible.');
    return { ...block, target };
  });
  const blocks = visit(definition.blocks);
  if (!found) throw new Error('Ajoutez une cible d’allure à un bloc avant cet ajustement.');
  return { ...definition, blocks };
}
export function expandWorkout(definition: WorkoutDefinition): PlannedSegment[] {
  const result: PlannedSegment[] = [];
  function visit(blocks: WorkoutBlock[], path: string, depth: number, repetition: number | null = null, count: number | null = null, repeatKey: string | null = null) {
    if (depth > 3) throw new Error('Trois niveaux de répétitions au maximum.');
    for (const [index, block] of blocks.entries()) {
      const key = `${path}/${index}`;
      if (block.kind === 'repeat') {
        if (!Number.isInteger(block.count) || block.count < 1 || block.count > 100) throw new Error('Une répétition doit compter de 1 à 100 passages.');
        for (let i = 1; i <= block.count; i++) {
          const before = result.length;
          visit(block.blocks, `${key}:${i}`, depth + 1, i, block.count, key);
          if (result.length > before) result[result.length - 1]!.repetitionEnd = true;
        }
      } else result.push({ ...block, key, index: result.length, repetition, repetitionCount: count, repeatKey, repetitionEnd: false });
      if (result.length > 500) throw new Error('La séance dépasse 500 segments après répétition.');
    }
  }
  visit(definition.blocks, '', 0); return result;
}
export function validateWorkout(value: WorkoutDefinition): string[] {
  const errors: string[] = [];
  if (!value || value.version !== 1 || typeof value.id !== 'string' || !value.id || typeof value.name !== 'string' || !value.name.trim() || value.name.length > 100) errors.push('Donnez un nom de 1 à 100 caractères à la séance.');
  if (!Array.isArray(value?.blocks) || !value.blocks.length) return [...errors, 'Ajoutez au moins un bloc.'];
  let nodes = 0;
  function validTree(blocks: WorkoutBlock[], depth = 0): boolean {
    if (depth > 3 || !Array.isArray(blocks) || !blocks.length) return false;
    return blocks.every(block => {
      if (++nodes > 500 || !block || typeof block.id !== 'string' || !block.id) return false;
      return block.kind === 'segment' || (block.kind === 'repeat' && Number.isInteger(block.count) && block.count >= 1 && block.count <= 100 && validTree(block.blocks, depth + 1));
    });
  }
  if (!validTree(value.blocks)) return [...errors, 'Blocs ou groupes invalides : groupes non vides, 1 à 100 répétitions et 3 niveaux au maximum.'];
  if (!['survival', 'intervals', 'intervals1000', 'progressive', 'timeTrial', 'pyramid', 'endurance', 'ghost', 'personalBest', 'regularity', 'finalSprint', 'custom'].includes(value.kind) || typeof value.description !== 'string' || value.description.length > 800 || ![value.createdAt, value.updatedAt].every(Number.isFinite)) errors.push('Métadonnées de séance invalides.');
  let segments: PlannedSegment[];
  try { segments = expandWorkout(value); } catch (error) { return [...errors, error instanceof Error ? error.message : 'Blocs invalides.']; }
  if (!segments.length) errors.push('Les groupes de répétitions ne peuvent pas être vides.');
  for (const [i, block] of segments.entries()) {
    const prefix = `Segment ${i + 1} : `;
    if (!block.name?.trim() || block.name.length > 100) errors.push(prefix + 'nom requis (100 caractères maximum).');
    if (!['warmup', 'effort', 'recovery', 'cooldown'].includes(block.effort)) errors.push(prefix + 'type d’effort invalide.');
    if (!block.end || !['distance', 'duration', 'inTarget'].includes(block.end.kind) || !Number.isFinite(block.end.value) || block.end.value <= 0) errors.push(prefix + 'distance ou durée strictement positive requise.');
    else if (block.end.kind === 'distance' && (block.end.value < 20 || block.end.value > 200000)) errors.push(prefix + 'distance de 20 m à 200 km.');
    else if (block.end.kind !== 'distance' && (block.end.value < 5 || block.end.value > 86400)) errors.push(prefix + 'durée de 5 secondes à 24 heures.');
    if (block.end?.kind === 'inTarget' && (!block.target || !Number.isFinite(block.end.maximumSeconds) || block.end.maximumSeconds < block.end.value || block.end.maximumSeconds > 86400)) errors.push(prefix + 'la condition nécessite une cible et une durée limite supérieure à sa confirmation.');
    if (block.target && (!Number.isFinite(block.target.fast) || !Number.isFinite(block.target.slow) || block.target.fast < 120 || block.target.slow > 1200 || block.target.fast > block.target.slow)) errors.push(prefix + 'allures de 2 à 20 min/km, de la plus rapide à la plus lente.');
    if (!Number.isFinite(block.tolerance) || block.tolerance < 0 || block.tolerance > 60) errors.push(prefix + 'tolérance de 0 à 60 s/km.');
    if (!['range', 'notFaster', 'notSlower'].includes(block.paceRule)) errors.push(prefix + 'règle d’allure invalide.');
    if (!['none', 'averagePace', 'compliance'].includes(block.assessment)) errors.push(prefix + 'condition de réussite invalide.');
    if (!block.target && block.assessment !== 'none') errors.push(prefix + 'une condition d’allure nécessite une cible.');
    if (!Number.isFinite(block.minimumCompliance) || block.minimumCompliance < 0 || block.minimumCompliance > 100) errors.push(prefix + 'pourcentage de 0 à 100 %.');
    if (block.maximumSeconds !== null && (!Number.isFinite(block.maximumSeconds) || block.maximumSeconds < 5 || block.maximumSeconds > 86400)) errors.push(prefix + 'temps maximal invalide.');
    if (block.maximumSeconds !== null && block.end && block.end.kind !== 'distance' && block.maximumSeconds < block.end.value) errors.push(prefix + 'le temps maximal est inférieur à la durée obligatoire du bloc.');
  }
  const rules = value.challenge;
  if (!rules || !['none', 'survival', 'timeTrial', 'progression', 'ghost', 'personalBest', 'regularity'].includes(rules.kind)) return [...new Set([...errors, 'Règle de défi invalide.'])];
  if (!['consecutive', 'cumulative'].includes(rules.outsideMode)) errors.push('Choisissez des écarts consécutifs ou cumulés.');
  if (!Number.isFinite(rules.allowedOutsideSeconds) || rules.allowedOutsideSeconds < 1 || rules.allowedOutsideSeconds > 3600) errors.push('Le budget hors cible doit être compris entre 1 et 3 600 secondes.');
  if (!Number.isFinite(rules.warningSeconds) || rules.warningSeconds < 1 || rules.warningSeconds > rules.allowedOutsideSeconds) errors.push('L’avertissement doit précéder ou égaler le seuil d’échec.');
  if (!Number.isFinite(rules.minimumCoverage) || rules.minimumCoverage < .5 || rules.minimumCoverage > 1) errors.push('Couverture GPS requise de 50 à 100 %.');
  if (!Number.isFinite(rules.progressionSeconds) || rules.progressionSeconds < 0 || rules.progressionSeconds > 60) errors.push('Progression de 0 à 60 s/km.');
  if (rules.kind === 'survival' && !segments.some(s => s.target)) errors.push('Le défi Survie nécessite au moins un objectif d’allure.');
  if (rules.kind === 'progression' && segments.filter(s => s.effort === 'effort').length < 2) errors.push('Une accélération nécessite au moins deux blocs d’effort à comparer.');
  if (rules.minimumStabilityScore !== undefined && (!Number.isFinite(rules.minimumStabilityScore) || rules.minimumStabilityScore < 0 || rules.minimumStabilityScore > 100)) errors.push('Le score de stabilité requis doit être compris entre 0 et 100.');
  if (rules.kind === 'regularity' && !segments.some(s => s.effort === 'effort' && s.target)) errors.push('Le défi régularité nécessite un bloc d’effort avec une cible d’allure.');
  if (rules.kind === 'regularity' && segments.filter(s => s.effort === 'effort').every(s => s.end.kind === 'duration') &&
      segments.filter(s => s.effort === 'effort').reduce((sum, s) => sum + Math.max(0, s.end.value - 8), 0) < 30) errors.push('Prévoyez au moins 30 secondes mesurables après les 8 secondes de stabilisation de chaque effort.');
  if (rules.kind === 'timeTrial' || rules.kind === 'ghost' || rules.kind === 'personalBest') {
    if (segments.length !== 1 || segments[0]?.end.kind !== 'distance') errors.push('Un contre-la-montre ou un fantôme nécessite un unique bloc de distance.');
    if (!Number.isFinite(rules.timeLimitSeconds) || rules.timeLimitSeconds === null || rules.timeLimitSeconds < 10 || rules.timeLimitSeconds > 86400) errors.push('Indiquez un temps limite de 10 secondes à 24 heures.');
    else if (segments[0]?.end.kind === 'distance' && rules.timeLimitSeconds < segments[0].end.value / 15) errors.push('Le temps limite impose une vitesse supérieure à la limite maximale acceptée par le filtre GPS (15 m/s).');
  }
  if (['ghost', 'personalBest'].includes(rules.kind) && (!validGhostReference(rules.ghost) || Math.abs((segments[0]?.end.value ?? 0) - rules.ghost!.distanceMeters) > .1 || Math.abs((rules.timeLimitSeconds ?? 0) - rules.ghost!.seconds) > .1)) errors.push('Choisissez une vraie référence mesurée, puis conservez sa distance et son temps.');
  if (rules.kind === 'personalBest' && (rules.ghost?.source !== 'personalBest' || rules.ghost.fromMeters === undefined || ![1000, 5000, 10000, 21097.5, 42195].includes(rules.ghost.distanceMeters))) errors.push('Ce défi nécessite un record personnel qualifié, sélectionné dans l’historique.');
  const distance = segments.reduce((sum, s) => sum + (s.end?.kind === 'distance' ? s.end.value : 0), 0);
  const seconds = segments.reduce((sum, s) => sum + (s.end?.kind === 'duration' ? s.end.value : s.end?.kind === 'inTarget' ? s.end.maximumSeconds : 0), 0);
  if (distance > 200000 || seconds > 86400) errors.push('La séance dépasse 200 km ou 24 heures de blocs planifiés.');
  return [...new Set(errors)];
}
export function effectiveTarget(segment: WorkoutSegment): SegmentPace | null {
  if (!segment.target) return null;
  return { fast: segment.paceRule === 'notSlower' ? 120 : Math.max(120, segment.target.fast - segment.tolerance),
    slow: segment.paceRule === 'notFaster' ? 1200 : Math.min(1200, segment.target.slow + segment.tolerance) };
}
export function segmentGoal(segment: WorkoutSegment) {
  return segment.end.kind === 'distance' ? `${km(segment.end.value, segment.end.value < 1000 ? 2 : 1)} km`
    : segment.end.kind === 'duration' ? duration(segment.end.value) : `${duration(segment.end.value)} consécutives en cible`;
}
export function segmentTarget(segment: WorkoutSegment) {
  if (!segment.target) return 'Allure libre';
  const range = segment.paceRule === 'notFaster' ? `Pas plus rapide que ${pace(segment.target.fast)}`
    : segment.paceRule === 'notSlower' ? `Pas plus lent que ${pace(segment.target.slow)}` : `${pace(segment.target.fast)} – ${pace(segment.target.slow)}`;
  return `${range} /km · marge ${segment.tolerance} s/km`;
}
export function workoutTotals(definition: WorkoutDefinition) {
  const segments = expandWorkout(definition);
  return { segments: segments.length, meters: segments.reduce((s, b) => s + (b.end.kind === 'distance' ? b.end.value : 0), 0),
    seconds: segments.reduce((s, b) => s + (b.end.kind === 'duration' ? b.end.value : 0), 0) };
}
export function workoutStatistics(snapshot: WorkoutSnapshot): WorkoutStatistics {
  const segments = snapshot.segments.filter(s => s.startedAt !== null);
  const sum = (key: 'distanceMeters' | 'trackingSeconds' | 'reliableSeconds' | 'inTargetSeconds' | 'outsideSeconds' | 'deviations') => segments.reduce((total, segment) => total + segment[key], 0);
  const elapsed = segments.reduce((total, s) => total + Math.max(0, (s.endedAt ?? snapshot.lastSeconds) - s.startedAt!), 0);
  const reliableSeconds = sum('reliableSeconds'), trackingSeconds = sum('trackingSeconds');
  return { elapsed, distance: sum('distanceMeters'), trackingSeconds, reliableSeconds, inTargetSeconds: sum('inTargetSeconds'), outsideSeconds: sum('outsideSeconds'),
    deviations: sum('deviations'), longestDeviation: Math.max(0, ...segments.map(s => s.longestDeviation)),
    targetPercentage: reliableSeconds > 0 ? sum('inTargetSeconds') / reliableSeconds * 100 : null,
    trackingCoverage: elapsed > 0 ? Math.min(1, trackingSeconds / elapsed) : null, stability: stabilityStatistics(snapshot.segments, snapshot.lastSeconds) };
}
function validGhostReference(value: GhostReference | null): boolean {
  if (!value || typeof value.runId !== 'string' || !value.runId || !Number.isFinite(value.startedAt) || !Number.isFinite(value.distanceMeters) || value.distanceMeters < 100 ||
      !Number.isFinite(value.seconds) || value.seconds <= 0 || !Array.isArray(value.trace) || value.trace.length < 2 || value.trace.length > 1005 ||
      (value.source !== undefined && value.source !== 'activity' && value.source !== 'personalBest') ||
      (value.fromMeters !== undefined && (!Number.isFinite(value.fromMeters) || value.fromMeters < 0))) return false;
  let meters = -1, seconds = -1;
  for (const p of value.trace) {
    if (!p || ![p.meters, p.seconds].every(Number.isFinite) || p.meters < 0 || p.seconds < 0 || p.meters < meters || p.seconds < seconds || p.meters > value.distanceMeters + .001 || p.seconds > value.seconds + .001) return false;
    meters = p.meters; seconds = p.seconds;
  }
  return value.trace[0]!.meters === 0 && value.trace[0]!.seconds === 0 && Math.abs(meters - value.distanceMeters) <= .001 && Math.abs(seconds - value.seconds) <= .001;
}
export function makeGhost(run: RunRecord, targetDistance = Math.floor(run.distanceMeters)): GhostReference {
  if (run.endedAt === null || !Number.isFinite(targetDistance) || targetDistance < 100 || targetDistance > run.distanceMeters || targetDistance < run.distanceMeters * .95 || run.points.length < 2) throw new Error('Choisissez une course enregistrée avec un trajet et une distance comparable (écart ≤ 5 %, sans extrapolation).');
  const track = cleanTrack(run), end = atDistance(track, targetDistance);
  if (!end || !reliableDistanceRange(track, 0, targetDistance)) throw new Error('La référence doit couvrir cette distance sans perte GPS ni interruption de cause inconnue.');
  const seconds = end.activeSeconds;
  const points = track.segments.flatMap(s => s.filter(p => p.meters < targetDistance && p.activeSeconds < seconds));
  let covered = 0;
  for (const segment of track.segments) for (let i = 1; i < segment.length; i++) {
    const a = segment[i - 1]!, b = segment[i]!;
    covered += Math.max(0, Math.min(seconds, b.activeSeconds) - a.activeSeconds);
  }
  if (covered / Math.max(1, seconds) < .95) throw new Error('Le fantôme nécessite au moins 95 % de temps couvert par le suivi GPS.');
  const step = Math.max(1, Math.ceil(points.length / 1000)), trace = [{ meters: 0, seconds: 0 }];
  for (let i = 0; i < points.length; i += step) { const p = points[i]!; if (p.activeSeconds > trace.at(-1)!.seconds) trace.push({ meters: p.meters, seconds: p.activeSeconds }); }
  trace.push({ meters: targetDistance, seconds });
  return { runId: run.id, startedAt: run.startedAt, distanceMeters: targetDistance, seconds, trace, source: 'activity', fromMeters: 0 };
}
export function makePersonalBest(run: RunRecord, meters: number): GhostReference {
  const best = runRecords(run).find(p => p.meters === meters);
  if (!best) throw new Error('Cette course ne contient pas de record fiable sur la distance choisie.');
  return { runId: run.id, startedAt: best.startedAt, distanceMeters: meters, seconds: best.seconds,
    trace: measuredSegmentTrace(run, best), source: 'personalBest', fromMeters: best.fromMeters };
}
export function ghostDistance(ghost: GhostReference, seconds: number): number {
  const next = ghost.trace.findIndex(p => p.seconds >= seconds);
  if (next < 0) return ghost.distanceMeters; if (next === 0) return 0;
  const a = ghost.trace[next - 1]!, b = ghost.trace[next]!;
  return a.meters + Math.max(0, Math.min(1, (seconds - a.seconds) / Math.max(.001, b.seconds - a.seconds))) * (b.meters - a.meters);
}
export function workoutSignature(definition: WorkoutDefinition): string {
  const segments = expandWorkout(definition).map(({ end, target, tolerance, paceRule, assessment, minimumCompliance, maximumSeconds, effort }) => ({ end, target, tolerance, paceRule, assessment, minimumCompliance, maximumSeconds, effort }));
  const { ghost, minimumStabilityScore, ...baseRules } = definition.challenge;
  const rules = { ...baseRules, ...(baseRules.kind === 'regularity' ? { minimumStabilityScore: minimumStabilityScore ?? 80 } : {}) };
  return JSON.stringify({ segments, rules, ghost: ghost ? { runId: ghost.runId, distanceMeters: ghost.distanceMeters, seconds: ghost.seconds, source: ghost.source ?? 'activity', fromMeters: ghost.fromMeters ?? 0 } : null });
}
/** Fail closed on an optional damaged workout without discarding the surrounding GPS activity. */
export function validWorkoutSnapshot(value: WorkoutSnapshot): boolean {
  try {
    if (!value || value.version !== 1 || validateWorkout(value.definition).length || !Array.isArray(value.segments)) return false;
    const plan = expandWorkout(value.definition);
    if (value.segments.length !== plan.length || !Number.isInteger(value.currentIndex) || value.currentIndex < 0 || value.currentIndex > plan.length ||
        !['ready', 'running', 'paused', 'completed', 'abandoned'].includes(value.status) ||
        !['respected', 'warning', 'failed', 'succeeded', 'unrated'].includes(value.challengeStatus) ||
        (value.status === 'completed' && value.currentIndex !== plan.length) ||
        (['running', 'paused'].includes(value.status) && value.currentIndex >= plan.length) ||
        ![value.lastSeconds, value.lastMeters, value.knownPositionAt, value.lastIntervalEnd, value.currentDeviation, value.conditionSeconds].every(n => Number.isFinite(n) && n >= 0) ||
        value.knownPositionAt > value.lastSeconds + .001 || value.lastIntervalEnd > value.lastSeconds + .001 ||
        typeof value.awaitingFinalFix !== 'boolean' || typeof value.distanceInterrupted !== 'boolean' ||
        (value.hadPause !== undefined && typeof value.hadPause !== 'boolean') || !Array.isArray(value.events) || value.events.length > 400) return false;
    for (const [index, segment] of value.segments.entries()) {
      if (!segment || JSON.stringify(segment.planned) !== JSON.stringify(plan[index]) ||
          ![segment.startMeters, segment.endMeters, segment.distanceMeters, segment.trackingSeconds, segment.reliableSeconds, segment.inTargetSeconds,
            segment.outsideSeconds, segment.deviations, segment.longestDeviation, segment.outsideStreak].every(n => Number.isFinite(n) && n >= 0) ||
          segment.inTargetSeconds + segment.outsideSeconds > segment.reliableSeconds + .001 || segment.reliableSeconds > segment.trackingSeconds + .001 ||
          (segment.startedAt !== null && (!Number.isFinite(segment.startedAt) || segment.startedAt < 0 || segment.startedAt > value.lastSeconds + .001)) ||
          (segment.endedAt !== null && (segment.startedAt === null || !Number.isFinite(segment.endedAt) || segment.endedAt < segment.startedAt || segment.endedAt > value.lastSeconds + .001)) ||
          !['pending', 'succeeded', 'failed', 'unrated'].includes(segment.outcome) || typeof segment.partial !== 'boolean' || typeof segment.hadDistanceGap !== 'boolean' || typeof segment.conditionTimedOut !== 'boolean' ||
          (segment.paceMoments !== undefined && (!validPaceMoments(segment.paceMoments) || segment.paceMoments.seconds > segment.trackingSeconds + .001))) return false;
    }
    return value.events.every(event => event && typeof event.id === 'string' && typeof event.message === 'string' && Number.isFinite(event.at) && event.at >= 0 && Number.isFinite(event.priority) && event.priority >= 0 && event.priority <= 100);
  } catch { return false; }
}
export function workoutRepetitions(snapshot: WorkoutSnapshot) {
  const groups = new Map<string, { name: string; seconds: number; effortSeconds: number; effortMeters: number; recoverySeconds: number; partial: boolean;
    reliableSeconds: number; inTargetSeconds: number; complete: boolean; outcomes: SegmentResult['outcome'][] }>();
  for (const segment of snapshot.segments) {
    if (segment.planned.repetition === null || segment.startedAt === null) continue;
    const key = `${segment.planned.repeatKey}:${segment.planned.repetition}`;
    const group = groups.get(key) ?? { name: `Répétition ${segment.planned.repetition}/${segment.planned.repetitionCount}`, seconds: 0, effortSeconds: 0, effortMeters: 0, recoverySeconds: 0,
      partial: false, reliableSeconds: 0, inTargetSeconds: 0, complete: false, outcomes: [] };
    const seconds = Math.max(0, (segment.endedAt ?? snapshot.lastSeconds) - segment.startedAt);
    group.seconds += seconds; group.partial ||= segment.partial || segment.endedAt === null;
    if (segment.planned.effort === 'effort') { group.effortSeconds += seconds; group.effortMeters += segment.distanceMeters; }
    if (segment.planned.effort === 'recovery') group.recoverySeconds += seconds;
    group.reliableSeconds += segment.reliableSeconds; group.inTargetSeconds += segment.inTargetSeconds;
    group.outcomes.push(segment.outcome);
    if (segment.planned.repetitionEnd && segment.endedAt !== null) group.complete = true;
    groups.set(key, group);
  }
  return [...groups.values()].map(({ outcomes, ...group }) => ({ ...group,
    outcome: group.partial || outcomes.includes('unrated') ? 'unrated' : outcomes.includes('failed') ? 'failed' : !group.complete || outcomes.includes('pending') ? 'pending' : 'succeeded',
    targetPercentage: group.reliableSeconds > 0 ? group.inTargetSeconds / group.reliableSeconds * 100 : null }));
}
