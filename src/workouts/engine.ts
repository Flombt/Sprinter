import { duration } from '../core/format';
import { effectiveTarget, expandWorkout, segmentTarget, validateWorkout, validWorkoutSnapshot, workoutStatistics } from './definition';
import { ChallengeStatus, CoachingEvent, CoachingKind, SegmentResult, WorkoutDefinition, WorkoutInterval, WorkoutSnapshot } from './types';
import { addPaceObservation, emptyPaceMoments } from './stability';

const EPS = .00001;
const priorities: Record<CoachingKind, number> = { workoutStart: 80, segmentStart: 70, segmentEnd: 45, targetChanged: 60,
  paceDeviation: 65, paceRecovered: 50, transitionSoon: 30, repetitionCompleted: 55, challengeWon: 100,
  challengeLost: 100, workoutCompleted: 90, workoutAbandoned: 80, timeAhead: 35, timeBehind: 55, goalReached: 90, goalExpired: 85, challengeWarning: 75,
  distanceMilestone: 45, progressUpdate: 25, runCompleted: 90, routeOff: 75, routeBack: 40 };
const terminalChallenge = (value: ChallengeStatus) => ['failed', 'succeeded', 'unrated'].includes(value);
/** Deterministic interpreter of accepted cumulative measurements and a pause-free active clock. */
export class WorkoutEngine {
  readonly snapshot: WorkoutSnapshot;
  private pending: CoachingEvent[] = [];
  constructor(definition: WorkoutDefinition, restored?: WorkoutSnapshot) {
    const errors = validateWorkout(definition); if (errors.length) throw new Error(errors[0]);
    if (restored) {
      if (!validWorkoutSnapshot(restored)) throw new Error('Sauvegarde de séance illisible.');
      if (!Array.isArray(restored.segments) || restored.segments.length !== expandWorkout(definition).length ||
          !Number.isInteger(restored.currentIndex) || restored.currentIndex < 0 || restored.currentIndex > restored.segments.length ||
          ![restored.lastSeconds, restored.lastMeters, restored.knownPositionAt, restored.lastIntervalEnd].every(Number.isFinite) ||
          !['ready', 'running', 'paused', 'completed', 'abandoned'].includes(restored.status)) throw new Error('Sauvegarde de séance illisible.');
      this.snapshot = JSON.parse(JSON.stringify(restored));
      if (this.snapshot.status === 'running') { this.snapshot.status = 'paused'; this.snapshot.hadPause = true; }
      this.resetContinuity();
    } else this.snapshot = {
      version: 1, definition: JSON.parse(JSON.stringify(definition)), status: 'ready', challengeStatus: 'respected', reason: null,
      currentIndex: 0, lastSeconds: 0, lastMeters: 0, knownPositionAt: 0, lastIntervalEnd: 0,
      currentDeviation: 0, currentDeviationCounted: false, deviationAnnounced: false, conditionSeconds: 0,
      warningSentForSegment: -1, events: [], awaitingFinalFix: false, distanceInterrupted: false, hadPause: false,
      segments: expandWorkout(definition).map(planned => ({ planned, startedAt: null, endedAt: null,
        startMeters: 0, endMeters: 0, distanceMeters: 0, trackingSeconds: 0, reliableSeconds: 0,
        inTargetSeconds: 0, outsideSeconds: 0, deviations: 0, longestDeviation: 0,
        outcome: 'pending', reason: null, partial: false, hadDistanceGap: false, conditionTimedOut: false,
        outsideStreak: 0, outsideCounted: false, deviationAnnounced: false, paceMoments: emptyPaceMoments() })),
    };
  }
  get current() { return this.snapshot.segments[this.snapshot.currentIndex] ?? null; }
  get target() { return this.snapshot.status === 'running' && this.current ? effectiveTarget(this.current.planned) : null; }
  drainEvents() { const events = this.pending; this.pending = []; return events; }
  private event(kind: CoachingKind, at: number, message: string, direction?: 'slowDown' | 'speedUp', index = this.snapshot.currentIndex) {
    const event: CoachingEvent = { id: `${kind}:${index}:${at.toFixed(3)}:${this.snapshot.events.length}`, kind, at,
      message, priority: priorities[kind], segmentIndex: index, ...(direction ? { direction } : {}) };
    this.pending.push(event); this.snapshot.events.push(event);
    if (this.snapshot.events.length > 400) this.snapshot.events.splice(0, this.snapshot.events.length - 400);
  }
  start(seconds = 0, meters = 0) {
    if (this.snapshot.status !== 'ready') return;
    this.snapshot.status = 'running'; this.snapshot.lastSeconds = seconds; this.snapshot.lastMeters = meters;
    this.snapshot.knownPositionAt = seconds; this.snapshot.lastIntervalEnd = seconds;
    this.event('workoutStart', seconds, `Séance ${this.snapshot.definition.name}.`); this.openSegment(seconds, meters);
  }
  pause(seconds: number) {
    this.advanceClock(seconds);
    if (this.snapshot.status === 'running') { this.snapshot.hadPause = true; this.snapshot.status = 'paused'; }
    this.resetContinuity();
  }
  resume(seconds: number) {
    if (this.snapshot.status !== 'paused') return;
    this.snapshot.status = 'running'; this.snapshot.lastSeconds = seconds; this.snapshot.lastIntervalEnd = seconds;
    this.snapshot.knownPositionAt = seconds; this.resetContinuity();
  }
  signalLost(distanceGap = false) {
    this.resetContinuity();
    if (distanceGap && this.snapshot.status === 'running') {
      this.snapshot.distanceInterrupted = true; if (this.current) this.current.hadDistanceGap = true;
    }
  }
  private resetContinuity(resetCondition = true) {
    this.snapshot.currentDeviation = 0; this.snapshot.currentDeviationCounted = false;
    this.snapshot.deviationAnnounced = false; if (resetCondition) this.snapshot.conditionSeconds = 0;
    if (this.current) { this.current.outsideStreak = 0; this.current.outsideCounted = false; this.current.deviationAnnounced = false; }
    if (this.snapshot.challengeStatus === 'warning') { this.snapshot.challengeStatus = 'respected'; this.snapshot.reason = null; }
  }
  /** First accepted position after acquisition/gap: no invented distance across the missing interval. */
  position(seconds: number, meters: number) {
    const previous = this.snapshot.knownPositionAt;
    if (seconds - previous > 6 && this.snapshot.status === 'running') this.signalLost(true);
    for (const segment of this.snapshot.segments) {
      if (segment.startedAt !== null && segment.startedAt > previous && segment.startedAt <= seconds) segment.startMeters = meters;
      if (segment.endedAt !== null && segment.endedAt > previous && segment.endedAt <= seconds) segment.endMeters = meters;
    }
    this.snapshot.lastMeters = meters; this.snapshot.knownPositionAt = seconds;
    this.snapshot.lastIntervalEnd = Math.max(this.snapshot.lastIntervalEnd, seconds);
    this.advanceClock(seconds);
  }
  private openSegment(seconds: number, meters: number) {
    const current = this.current;
    if (!current) {
      this.snapshot.status = 'completed'; this.snapshot.awaitingFinalFix = this.snapshot.knownPositionAt + EPS < seconds;
      return;
    }
    current.startedAt = seconds; current.startMeters = meters; current.endMeters = meters;
    this.resetContinuity(); this.snapshot.warningSentForSegment = -1;
    const repetition = current.planned.repetition ? ` Répétition ${current.planned.repetition} sur ${current.planned.repetitionCount}.` : '';
    this.event('segmentStart', seconds, `${current.planned.name}.${repetition} ${segmentTarget(current.planned)}.`);
    this.event('targetChanged', seconds, segmentTarget(current.planned));
  }
  private closeSegment(seconds: number, meters: number, conditionTimeout = false) {
    const current = this.current; if (!current) return;
    current.endedAt = Math.max(current.startedAt ?? seconds, seconds); current.endMeters = meters;
    if (conditionTimeout) { current.conditionTimedOut = true; current.reason = 'Durée maximale atteinte avant confirmation de la condition.'; }
    this.event('segmentEnd', seconds, `${current.planned.name} terminé.`, undefined, current.planned.index);
    if (current.planned.repetitionEnd) this.event('repetitionCompleted', seconds, `Répétition ${current.planned.repetition} terminée.`, undefined, current.planned.index);
    this.snapshot.currentIndex++; this.openSegment(seconds, meters);
  }
  private at(interval: WorkoutInterval, seconds: number) {
    return interval.fromMeters + Math.max(0, Math.min(1, (seconds - interval.fromSeconds) / (interval.toSeconds - interval.fromSeconds))) * (interval.toMeters - interval.fromMeters);
  }
  acceptInterval(input: WorkoutInterval) {
    const state = this.snapshot;
    if (!['running', 'completed'].includes(state.status) || !Object.values(input).filter(v => typeof v === 'number').every(Number.isFinite) ||
        input.toSeconds <= input.fromSeconds || input.toMeters < input.fromMeters || input.toSeconds <= state.lastIntervalEnd) return;
    let interval = input;
    if (interval.fromSeconds < state.lastIntervalEnd) interval = { ...interval, fromSeconds: state.lastIntervalEnd, fromMeters: this.at(input, state.lastIntervalEnd) };
    if (interval.fromSeconds - state.lastIntervalEnd > .1) this.signalLost(true);
    if (state.definition.challenge.kind === 'personalBest' && interval.recordReliable !== true) this.signalLost(true);
    // A clock transition may precede a slightly delayed GPS callback. Rebase its distance
    // from the accepted interval, instead of losing or double-counting metres at the boundary.
    for (const segment of state.segments) {
      if (segment.startedAt !== null && segment.startedAt >= interval.fromSeconds && segment.startedAt <= interval.toSeconds) segment.startMeters = this.at(interval, segment.startedAt);
      if (segment.endedAt !== null && segment.endedAt >= interval.fromSeconds && segment.endedAt <= interval.toSeconds) segment.endMeters = this.at(interval, segment.endedAt);
    }
    state.lastMeters = interval.toMeters; state.knownPositionAt = interval.toSeconds;
    state.lastSeconds = Math.max(state.lastSeconds, interval.toSeconds);
    let transitions = 0;
    while (state.status === 'running' && this.current && transitions++ < 500) {
      const segment = this.current, start = segment.startedAt!;
      if (start > interval.toSeconds) break;
      let end: number | null = null;
      let timeout = false;
      if (segment.planned.end.kind === 'distance') {
        const threshold = segment.startMeters + segment.planned.end.value;
        if (interval.toMeters + EPS >= threshold && interval.toMeters > interval.fromMeters) {
          end = interval.fromSeconds + (threshold - interval.fromMeters) / (interval.toMeters - interval.fromMeters) * (interval.toSeconds - interval.fromSeconds);
          end = Math.max(start, Math.min(interval.toSeconds, end));
        }
      } else if (segment.planned.end.kind === 'duration') {
        if (start + segment.planned.end.value <= interval.toSeconds) end = start + segment.planned.end.value;
      } else {
        const target = effectiveTarget(segment.planned);
        const from = Math.max(start, interval.fromSeconds);
        const valid = interval.paceReliable && interval.pace !== null && from >= start + 8 && target && interval.pace >= target.fast && interval.pace <= target.slow;
        if (valid && state.conditionSeconds + interval.toSeconds - from >= segment.planned.end.value) end = from + Math.max(0, segment.planned.end.value - state.conditionSeconds);
        const deadline = start + segment.planned.end.maximumSeconds;
        if ((end === null || end > deadline) && interval.toSeconds >= deadline) { end = deadline; timeout = true; }
      }
      if (end === null) break;
      this.closeSegment(end, this.at(interval, end), timeout);
    }
    for (const segment of state.segments) {
      if (segment.startedAt === null) break;
      const from = Math.max(interval.fromSeconds, segment.startedAt), to = Math.min(interval.toSeconds, segment.endedAt ?? interval.toSeconds);
      if (to <= from) continue;
      const seconds = to - from;
      segment.distanceMeters += Math.max(0, this.at(interval, to) - this.at(interval, from));
      segment.trackingSeconds += seconds;
      const target = effectiveTarget(segment.planned);
      // Ignore a smoothed speed inherited from the previous effort at a target transition.
      const valid = interval.paceReliable && interval.pace !== null && Number.isFinite(interval.pace) && interval.pace > 0 && from >= segment.startedAt + 8;
      if (valid && segment.planned.effort === 'effort') {
        segment.paceMoments ??= emptyPaceMoments(); addPaceObservation(segment.paceMoments, interval.pace!, seconds);
      }
      if (!target || !valid) {
        segment.outsideStreak = 0; segment.outsideCounted = false; segment.deviationAnnounced = false;
        if (segment.planned.index === state.currentIndex) this.resetContinuity();
        continue;
      }
      segment.reliableSeconds += seconds;
      const inside = interval.pace! >= target.fast && interval.pace! <= target.slow;
      if (inside) segment.inTargetSeconds += seconds; else segment.outsideSeconds += seconds;
      this.monitorPace(segment, inside, seconds, to, interval.pace!);
      if (segment.planned.index === state.currentIndex && segment.planned.end.kind === 'inTarget') state.conditionSeconds = inside ? state.conditionSeconds + seconds : 0;
    }
    state.lastIntervalEnd = interval.toSeconds;
    this.assessSegments(); this.advanceClock(Math.max(state.lastSeconds, interval.toSeconds));
    this.checkChallenge();
  }
  private monitorPace(segment: SegmentResult, inside: boolean, seconds: number, at: number, pace: number) {
    const state = this.snapshot, rules = state.definition.challenge;
    // Late measurements can enrich a closed segment, but cannot issue stale coaching.
    const live = segment.planned.index === state.currentIndex && state.status === 'running';
    if (inside) {
      if (live && segment.deviationAnnounced) this.event('paceRecovered', at, 'Vous êtes de retour dans votre cible.');
      segment.outsideStreak = 0; segment.outsideCounted = false; segment.deviationAnnounced = false;
      if (live) this.resetContinuity(false); return;
    }
    if (!segment.outsideCounted) { segment.deviations++; segment.outsideCounted = true; }
    segment.outsideStreak += seconds; segment.longestDeviation = Math.max(segment.longestDeviation, segment.outsideStreak);
    if (live) {
      state.currentDeviationCounted = true; state.currentDeviation = segment.outsideStreak;
      const threshold = rules.kind === 'survival' ? rules.warningSeconds : 10;
      if (!segment.deviationAnnounced && state.currentDeviation >= threshold) {
        state.deviationAnnounced = true; segment.deviationAnnounced = true;
        if (!terminalChallenge(state.challengeStatus)) state.challengeStatus = 'warning';
        const target = effectiveTarget(segment.planned)!;
        if (rules.kind === 'survival') this.event('challengeWarning', at, `Attention défi Survie : ${Math.round(rules.outsideMode === 'cumulative' ? workoutStatistics(state).outsideSeconds : state.currentDeviation)} secondes ${rules.outsideMode === 'cumulative' ? 'cumulées' : 'consécutives'} hors objectif.`);
        else this.event('paceDeviation', at, pace < target.fast ? 'Vous êtes trop rapide. Ralentissez légèrement.' : 'Vous êtes trop lent. Accélérez légèrement.', pace < target.fast ? 'slowDown' : 'speedUp');
      }
    }
    if (rules.kind === 'survival' && !terminalChallenge(state.challengeStatus)) {
      const used = rules.outsideMode === 'cumulative' ? workoutStatistics(state).outsideSeconds : segment.outsideStreak;
      if (used >= rules.allowedOutsideSeconds - EPS) this.fail(at, `Budget de ${rules.allowedOutsideSeconds} secondes ${rules.outsideMode === 'consecutive' ? 'consécutives' : 'cumulées'} hors cible dépassé.`);
    }
  }
  advanceClock(seconds: number) {
    const state = this.snapshot;
    if (!Number.isFinite(seconds) || seconds < state.lastSeconds - EPS || state.status === 'ready' || state.status === 'paused' || state.status === 'abandoned') return;
    state.lastSeconds = seconds;
    let transitions = 0;
    while (state.status === 'running' && this.current && transitions++ < 500) {
      const current = this.current, start = current.startedAt!;
      const end = current.planned.end;
      if (end.kind === 'duration' && start + end.value <= seconds) this.closeSegment(start + end.value, state.lastMeters);
      else if (end.kind === 'inTarget' && start + end.maximumSeconds + 6 <= seconds) this.closeSegment(start + end.maximumSeconds, state.lastMeters, true);
      else break;
    }
    const current = this.current;
    if (state.status === 'running' && current?.planned.end.kind === 'duration') {
      const remaining = current.startedAt! + current.planned.end.value - seconds;
      if (remaining > 0 && remaining <= 5 && state.warningSentForSegment !== state.currentIndex) {
        state.warningSentForSegment = state.currentIndex; this.event('transitionSoon', seconds, `Transition dans ${Math.ceil(remaining)} secondes.`);
      }
    }
    this.assessSegments(); this.checkDeadline(seconds); this.checkChallenge();
  }
  private assessSegments() {
    const state = this.snapshot, rules = state.definition.challenge;
    for (const [index, segment] of state.segments.entries()) {
      if (segment.endedAt === null || segment.startedAt === null) continue;
      const elapsed = segment.endedAt - segment.startedAt;
      const coverage = segment.trackingSeconds / Math.max(.001, elapsed);
      const target = effectiveTarget(segment.planned);
      if (segment.partial) { segment.outcome = 'unrated'; continue; }
      if (segment.planned.end.kind === 'inTarget' && segment.conditionTimedOut) {
        segment.reason = 'Durée maximale atteinte avant confirmation de la condition.';
        segment.outcome = segment.reliableSeconds / Math.max(1, elapsed) >= rules.minimumCoverage ? 'failed' : 'unrated'; continue;
      }
      if (!target && !segment.planned.maximumSeconds && rules.kind !== 'progression') { segment.outcome = 'succeeded'; continue; }
      if (coverage < rules.minimumCoverage || segment.hadDistanceGap || (target && segment.planned.assessment === 'compliance' && segment.reliableSeconds / Math.max(1, elapsed) < rules.minimumCoverage)) {
        segment.outcome = 'unrated'; segment.reason = 'Mesures fiables insuffisantes.'; continue;
      }
      if (rules.kind === 'progression' && segment.planned.effort === 'effort' && segment.distanceMeters <= 0) {
        segment.outcome = 'unrated'; segment.reason = 'Distance mesurée insuffisante pour comparer les allures.'; continue;
      }
      let failed = false, reason: string | null = null;
      if (target && segment.planned.assessment === 'averagePace') {
        const average = segment.distanceMeters > 0 ? elapsed / segment.distanceMeters * 1000 : Infinity;
        failed = average < target.fast || average > target.slow; if (failed) reason = 'Allure moyenne du segment hors objectif.';
      } else if (target && segment.planned.assessment === 'compliance' && segment.reliableSeconds > 0) {
        failed = segment.inTargetSeconds / segment.reliableSeconds * 100 + EPS < segment.planned.minimumCompliance;
        if (failed) reason = 'Temps en cible inférieur au minimum configuré.';
      }
      if (segment.planned.maximumSeconds !== null && elapsed > segment.planned.maximumSeconds) { failed = true; reason = 'Temps maximal du segment dépassé.'; }
      if (rules.kind === 'progression' && index > 0 && segment.planned.effort === 'effort') {
        const previous = state.segments.slice(0, index).reverse().find(s => s.planned.effort === 'effort' && s.endedAt !== null);
        if (previous && previous.distanceMeters > 0 && segment.distanceMeters > 0 && previous.outcome !== 'unrated') {
          const previousPace = (previous.endedAt! - previous.startedAt!) / previous.distanceMeters * 1000;
          const currentPace = elapsed / segment.distanceMeters * 1000;
          if (currentPace > previousPace - rules.progressionSeconds) { failed = true; reason = 'Accélération mesurée insuffisante par rapport au segment précédent.'; }
        }
      }
      segment.outcome = failed ? 'failed' : 'succeeded'; segment.reason = reason;
    }
  }
  private fail(at: number, reason: string) {
    if (terminalChallenge(this.snapshot.challengeStatus)) return;
    this.snapshot.challengeStatus = 'failed'; this.snapshot.reason = reason;
    this.event('challengeLost', at, `Défi perdu. ${reason} Votre sortie continue.`);
  }
  private checkDeadline(seconds: number) {
    const state = this.snapshot, rules = state.definition.challenge;
    if (!['timeTrial', 'ghost', 'personalBest'].includes(rules.kind) || !rules.timeLimitSeconds || state.status !== 'running' || terminalChallenge(state.challengeStatus) || (rules.kind === 'personalBest' && state.hadPause)) return;
    if (seconds <= rules.timeLimitSeconds) return;
    const stats = workoutStatistics(state);
    if (!state.distanceInterrupted && state.knownPositionAt >= rules.timeLimitSeconds && state.lastSeconds - state.knownPositionAt <= 6 && (stats.trackingCoverage ?? 0) >= rules.minimumCoverage) {
      this.fail(seconds, rules.kind === 'personalBest' ? 'Le chrono du record est dépassé avant la distance cible.' : rules.kind === 'ghost' ? 'Le fantôme a atteint sa distance avant vous.' : 'Temps maximal dépassé avant la distance cible.');
    } else { state.challengeStatus = 'warning'; state.reason = 'Temps limite dépassé, mais les données GPS ne permettent pas de conclure.'; }
  }
  private checkChallenge() {
    const state = this.snapshot;
    if (state.status !== 'completed') return;
    const last = state.segments.at(-1), end = last?.endedAt ?? state.lastSeconds;
    if (state.awaitingFinalFix && state.knownPositionAt + EPS < end && state.lastSeconds <= end + 6) return;
    const missingEnd = state.awaitingFinalFix && state.knownPositionAt + EPS < end;
    state.awaitingFinalFix = false;
    if (state.events.some(e => e.kind === 'workoutCompleted')) return;
    const stats = workoutStatistics(state), rules = state.definition.challenge;
    if (!terminalChallenge(state.challengeStatus)) {
      const targeted = state.segments.filter(s => s.planned.target);
      const paceCoverage = targeted.reduce((sum, s) => sum + s.reliableSeconds, 0) /
        Math.max(1, targeted.reduce((sum, s) => sum + Math.max(0, s.endedAt! - s.startedAt!), 0));
      const invalid = missingEnd || (stats.trackingCoverage ?? 0) < rules.minimumCoverage ||
        (rules.kind === 'survival' && paceCoverage < rules.minimumCoverage) ||
        (rules.kind === 'regularity' && (stats.stability.score === null || (stats.stability.coverage ?? 0) < rules.minimumCoverage)) ||
        (rules.kind === 'personalBest' && state.hadPause) ||
        (['timeTrial', 'ghost', 'personalBest'].includes(rules.kind) && state.distanceInterrupted) || state.segments.some(s => s.outcome === 'unrated');
      if (invalid) { state.challengeStatus = 'unrated'; state.reason = rules.kind === 'personalBest' && state.hadPause
        ? 'Une pause ou une récupération de séance empêche de qualifier un défi contre un record continu.'
        : 'La couverture GPS ou les mesures d’allure ne permettent pas de valider ce résultat.'; }
      else {
        const failedSegment = state.segments.find(s => s.outcome === 'failed');
        const timeExceeded = ['timeTrial', 'ghost', 'personalBest'].includes(rules.kind) && rules.timeLimitSeconds !== null && (rules.kind !== 'timeTrial' ? end >= rules.timeLimitSeconds : end > rules.timeLimitSeconds + EPS);
        const unstable = rules.kind === 'regularity' && stats.stability.score! + EPS < (rules.minimumStabilityScore ?? 80);
        if (failedSegment || timeExceeded || unstable) this.fail(end, failedSegment?.reason ?? (unstable ? `Score de stabilité inférieur au minimum de ${rules.minimumStabilityScore ?? 80}/100.` : 'Objectif de temps non atteint.'));
        else { state.challengeStatus = 'succeeded'; state.reason = null; this.event('challengeWon', end, 'Objectif de séance réussi.'); }
      }
    }
    this.event('workoutCompleted', end, `Séance terminée en ${duration(stats.elapsed)}. Vous pouvez poursuivre librement votre sortie.`);
  }
  abandon(reason = 'Séance abandonnée par le coureur.') {
    const state = this.snapshot; if (state.status === 'completed' || state.status === 'abandoned') return;
    if (this.current?.startedAt !== null && this.current) {
      this.current.endedAt = state.lastSeconds; this.current.endMeters = state.lastMeters;
      this.current.partial = true; this.current.outcome = 'unrated'; this.current.reason = reason;
    }
    state.status = 'abandoned'; state.awaitingFinalFix = false;
    if (state.challengeStatus !== 'failed') state.challengeStatus = 'unrated';
    state.reason = reason; this.resetContinuity();
    this.event('workoutAbandoned', state.lastSeconds, 'Séance abandonnée. Le GPS et l’enregistrement de votre sortie continuent.');
  }
  finalizedSnapshot(): WorkoutSnapshot {
    const copy = new WorkoutEngine(this.snapshot.definition, this.snapshot);
    if (copy.snapshot.status !== 'completed' && copy.snapshot.status !== 'abandoned') copy.abandon('La course a été terminée avant la fin de la séance.');
    if (copy.snapshot.awaitingFinalFix) {
      copy.snapshot.awaitingFinalFix = false;
      if (!terminalChallenge(copy.snapshot.challengeStatus)) { copy.snapshot.challengeStatus = 'unrated'; copy.snapshot.reason = 'Fin de séance non confirmée par les dernières mesures GPS.'; }
    }
    return copy.snapshot;
  }
}
