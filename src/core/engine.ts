import { AlertCue, CoachConfig, DEFAULT_CONFIG, GPSFix, PaceTarget, RunRecord, SignalQuality, TrackPoint } from './types';
import { PaceCoach, sanitizeConfig } from './coach';
import { pace, targetLabel, validateTarget } from './format';
import { ActiveClock } from './clock';
import { HorizontalTracker } from './tracking';
import { ElevationTracker } from './elevation';
import { AutoPauseDetector } from './autoPause';
import { WorkoutEngine } from '../workouts/engine';
import { CoachingEvent, WorkoutDefinition } from '../workouts/types';
import { effectiveTarget, workoutStatistics } from '../workouts/definition';
import { PacingEngine } from '../pacing/engine';
import { paceTargetAt } from '../pacing/goals';
export { ActiveClock } from './clock';
export { distance } from './geo';

interface Window { end: number; seconds: number; meters: number }
export class RunEngine {
  readonly record: RunRecord;
  currentPace: number | null = null;
  quality: SignalQuality = 'warmingUp';
  autoPaused = false;
  private manuallyPaused = false;
  private clock: ActiveClock; private totalClock: ActiveClock;
  private tracker: HorizontalTracker; private elevation = new ElevationTracker(); private autoPause = new AutoPauseDetector();
  private coach: PaceCoach; private anchor: TrackPoint | null = null;
  private segment = 0; private lastFixMonotonic: number | null = null;
  private lastOperationTime: number; private acceptAfterTime: number; private wallOffset: number | null = null;
  private windows: Window[] = [];
  private workout: WorkoutEngine | null = null; private events: CoachingEvent[] = [];
  private coachTarget: PaceTarget | null;
  private pacing!: PacingEngine; private targetKey = '';
  private nextPointContinuity: NonNullable<TrackPoint['continuity']> = 'start';
  workoutRecoveryError: string | null = null;
  get running() { return this.clock.running; }
  /** Auto-pause keeps location alive; a manual pause stops it. */
  get tracking() { return !this.manuallyPaused; }
  get altitude() { return this.elevation.current; }
  get activeTarget(): PaceTarget | null { const target = this.workout?.target; return this.workout ? target ? { ...target, distanceMeters: null } : null : paceTargetAt(this.record.target, this.record.distanceMeters); }
  get coachingIndex() { return this.record.workout?.currentIndex ?? (this.record.target.kilometerTargets?.length ? Math.floor((this.record.distanceMeters + 1e-7) / 1000) : -1); }
  get state() { return !this.running ? 'paused' as const : !this.activeTarget ? 'free' as const : this.coach.classification; }
  constructor(target: PaceTarget, config: CoachConfig = DEFAULT_CONFIG, monotonicTime = 0,
              startedAt = Date.now(), id = `${startedAt}-${Math.random().toString(36).slice(2, 12)}`, restored?: RunRecord,
              options: { autoPauseEnabled?: boolean } = {}) {
    const error = validateTarget(target, sanitizeConfig(config).maximumSpeed); if (error) throw new Error(error);
    this.record = restored ? JSON.parse(JSON.stringify(restored)) as RunRecord : {
      dataVersion: 3, id, startedAt, endedAt: null, target: JSON.parse(JSON.stringify(target)), config: sanitizeConfig(config),
      activeSeconds: 0, distanceMeters: 0, reliableSeconds: 0, inTargetSeconds: 0,
      bestPace: null, points: [], splits: [], totalSeconds: 0, ascentMeters: 0, descentMeters: 0,
      elevationReliableSeconds: 0, autoPauseEnabled: options.autoPauseEnabled === true, autoPauseCount: 0, clockPauses: [],
    };
    this.record.endedAt = null; this.record.config = sanitizeConfig(this.record.config);
    this.record.dataVersion = 3;
    this.record.totalSeconds = Math.max(this.record.activeSeconds, this.record.totalSeconds ?? this.record.activeSeconds);
    this.record.ascentMeters ??= 0; this.record.descentMeters ??= 0; this.record.elevationReliableSeconds ??= 0;
    this.record.autoPauseEnabled ??= false; this.record.autoPauseCount ??= 0;
    this.clock = new ActiveClock(this.record.activeSeconds); this.totalClock = new ActiveClock(this.record.totalSeconds);
    this.totalClock.resume(monotonicTime); this.lastOperationTime = monotonicTime; this.acceptAfterTime = monotonicTime;
    this.tracker = new HorizontalTracker(this.record.config);
    this.coach = new PaceCoach(this.record.target, this.record.config); this.coachTarget = this.record.target;
    if (restored?.workout) {
      try { this.workout = new WorkoutEngine(restored.workout.definition, restored.workout); }
      catch { delete this.record.workout; this.workoutRecoveryError = 'La séance était illisible. Votre enregistrement GPS a été récupéré sans ses blocs.'; }
    }
    try { this.pacing = new PacingEngine(this.record, this.record.config); }
    catch { delete this.record.pacing; this.record.pacingError = 'Le journal du coach était illisible. Les mesures de course ont été conservées.'; this.pacing = new PacingEngine(this.record, this.record.config); }
    this.syncWorkout(); this.syncPacing();
    if (restored) {
      this.nextPointContinuity = 'recovery';
      this.events = [];
      this.manuallyPaused = true; this.segment = (this.record.points.at(-1)?.segment ?? 0) + 1;
      this.quality = 'paused'; this.coach.invalidate(true);
    } else this.clock.resume(monotonicTime);
  }
  static restore(run: RunRecord, monotonicTime = 0, interruptionSeconds = 0) {
    const restored = { ...run, totalSeconds: Math.max(run.activeSeconds, run.totalSeconds ?? run.activeSeconds) + Math.max(0, Number.isFinite(interruptionSeconds) ? interruptionSeconds : 0),
      ...(interruptionSeconds > 0 ? { totalEstimated: true } : {}) };
    return new RunEngine(run.target, run.config, monotonicTime, run.startedAt, run.id, restored);
  }
  attachWorkout(definition: WorkoutDefinition) {
    if (this.record.points.length || this.workout) throw new Error('Choisissez la séance avant le départ.');
    this.workout = new WorkoutEngine(definition); this.workout.start(this.record.activeSeconds, this.record.distanceMeters); this.syncWorkout();
    this.pacing.refreshReference(this.record);
  }
  drainEvents() { const events = this.events; this.events = []; return events; }
  abandonWorkout() { this.workout?.abandon(); this.syncWorkout(); this.pacing.refreshReference(this.record); }
  private syncWorkout(closeDeviation = true) {
    if (this.workout) {
      this.record.workout = this.workout.snapshot;
      if (this.record.workout.definition.challenge.kind === 'personalBest') this.pacing?.refreshReference(this.record);
      // Generic pace alerts have one source (PaceCoach); challenge budget warnings remain independent.
      this.events.push(...this.workout.drainEvents().filter(event => event.kind !== 'paceDeviation'));
      const stats = workoutStatistics(this.workout.snapshot);
      this.record.reliableSeconds = stats.reliableSeconds; this.record.inTargetSeconds = stats.inTargetSeconds;
    }
    const target = this.activeTarget;
    const key = this.workout ? `workout:${this.coachingIndex}` : this.record.target.kilometerTargets?.length ? `km:${this.coachingIndex}` : 'pace';
    const changed = target?.fast !== this.coachTarget?.fast || target?.slow !== this.coachTarget?.slow;
    if (changed || key !== this.targetKey) {
      if (closeDeviation) this.pacing?.interrupt('targetChanged');
      if (target) this.coach.retarget(target); else this.coach.invalidate();
      if (target && changed) { this.windows = []; this.currentPace = null; this.quality = 'warmingUp'; }
      if (!this.workout && this.record.target.kilometerTargets?.length && target && key !== this.targetKey) this.events.push({
        id: `${key}:${this.record.activeSeconds}`, kind: 'segmentStart', at: this.record.activeSeconds, priority: 70, segmentIndex: this.coachingIndex,
        message: `Kilomètre ${this.coachingIndex + 1}. Cible ${targetLabel(target)} par kilomètre.` });
      this.coachTarget = target; this.targetKey = key;
    }
  }
  private syncPacing() {
    this.record.pacing = this.pacing.snapshot;
    if (!this.workout) { this.record.reliableSeconds = this.pacing.snapshot.reliableSeconds; this.record.inTargetSeconds = this.pacing.snapshot.inTargetSeconds; }
    for (const notice of this.pacing.drainNotices()) {
      if (this.workout && ['goalReached', 'paceRecovered', 'goalExpired'].includes(notice.kind)) continue;
      const capital = `${Math.round(Math.abs(notice.capital))} secondes ${notice.capital >= 0 ? 'd’avance' : 'de retard'}`;
      const required = notice.requiredPace !== null && notice.requiredPace >= Math.max(120, 1000 / this.record.config.maximumSpeed) && notice.requiredPace <= 1200
        ? ` Allure moyenne restante nécessaire : ${pace(notice.requiredPace)} par kilomètre.` : '';
      const message = notice.kind === 'paceRecovered' ? 'Vous êtes de retour dans la plage cible.' : notice.kind === 'goalReached'
        ? `Distance cible atteinte. ${this.record.target.finishSeconds != null && !(this.record.target.timeBasis === 'total' && this.record.totalEstimated) ? `${capital}. ` : ''}Votre sortie continue.`
        : notice.kind === 'goalExpired' ? 'Le temps visé est dépassé. Votre sortie continue.' : `${capital} sur l’objectif chronométrique.${required}`;
      this.events.push({ id: `${notice.kind}:${notice.at}`, kind: notice.kind, at: notice.at, message,
        priority: notice.kind === 'goalReached' ? 90 : notice.kind === 'goalExpired' ? 85 : notice.kind === 'timeBehind' ? 55 : 35, segmentIndex: this.coachingIndex });
    }
  }
  private recordPaceInterval(previous: TrackPoint, seconds: number, meters: number, value: number | null, valid: boolean) {
    const from = previous.activeSeconds, span = seconds - from;
    const at = (t: number) => previous.meters + (meters - previous.meters) * (t - from) / span;
    if (this.workout) {
      for (const segment of this.workout.snapshot.segments) {
        if (segment.startedAt === null) break;
        const start = Math.max(from, segment.startedAt), end = Math.min(seconds, segment.endedAt ?? seconds); if (end <= start) continue;
        const target = effectiveTarget(segment.planned);
        this.pacing.accept({ fromSeconds: start, toSeconds: end, fromMeters: at(start), toMeters: at(end), pace: value,
          valid: valid && start >= segment.startedAt + 8, target: target ? { ...target, distanceMeters: null } : null,
          context: `Segment ${segment.planned.index + 1} · ${segment.planned.name}${segment.planned.repetition ? ` · répétition ${segment.planned.repetition}` : ''}` });
      }
    } else {
      const cuts = [from];
      if (this.record.target.kilometerTargets?.length && meters > previous.meters) {
        for (let boundary = (Math.floor(previous.meters / 1000) + 1) * 1000; boundary < meters; boundary += 1000) cuts.push(from + (boundary - previous.meters) / (meters - previous.meters) * span);
        const finish = this.record.target.distanceMeters!;
        if (previous.meters < finish && finish < meters && !cuts.some(t => Math.abs(at(t) - finish) < .001)) cuts.push(from + (finish - previous.meters) / (meters - previous.meters) * span);
      }
      cuts.push(seconds); cuts.sort((a, b) => a - b);
      const initial = paceTargetAt(this.record.target, previous.meters);
      for (let i = 1; i < cuts.length; i++) {
        const start = cuts[i - 1]!, end = cuts[i]!, midpoint = at((start + end) / 2), target = paceTargetAt(this.record.target, midpoint);
        this.pacing.accept({ fromSeconds: start, toSeconds: end, fromMeters: at(start), toMeters: at(end), pace: value,
          valid: valid && target?.fast === initial?.fast && target?.slow === initial?.slow, target,
          context: this.record.target.kilometerTargets?.length ? `Kilomètre ${Math.floor((midpoint + 1e-7) / 1000) + 1}` : 'Plage de la sortie' });
      }
    }
  }
  private updateTimes(time: number) {
    if (!Number.isFinite(time)) return;
    this.lastOperationTime = Math.max(this.lastOperationTime, time);
    this.record.activeSeconds = Math.max(this.record.activeSeconds, this.clock.elapsed(time));
    this.record.totalSeconds = Math.max(this.record.totalSeconds ?? 0, this.totalClock.elapsed(time), this.record.activeSeconds);
  }
  private checkWallClock(time: number, wallTime: number) {
    const offset = wallTime - time * 1000;
    if (!Number.isFinite(offset)) return;
    if (this.wallOffset !== null && Math.abs(offset - this.wallOffset) > 2000) {
      if (this.anchor) this.workout?.signalLost(true);
      if (this.anchor) this.pacing?.interrupt('gpsUnavailable', true);
      this.breakTracking(this.running ? 'warmingUp' : 'paused');
    }
    this.wallOffset = offset;
  }
  tick(time: number, wallTime: number) {
    this.checkWallClock(time, wallTime); this.updateTimes(time);
    if (this.tracking && this.lastFixMonotonic !== null && time - this.lastFixMonotonic > this.record.config.maximumGap) this.breakTracking('stale');
    this.workout?.advanceClock(this.record.activeSeconds); this.syncWorkout();
  }
  pause(time: number) {
    const wasRunning = this.running;
    time = Math.max(time, this.lastOperationTime); this.updateTimes(time); this.clock.pause(time);
    if (wasRunning && this.record.clockPauses) this.record.clockPauses.push({ from: this.record.totalSeconds!, to: null });
    this.manuallyPaused = true; this.autoPaused = false;
    this.workout?.pause(this.record.activeSeconds); this.syncWorkout(); this.breakTracking('paused'); this.coach.invalidate(true);
  }
  resume(time: number) {
    if (this.running) return;
    this.updateTimes(time); this.clock.resume(time); this.totalClock.resume(time);
    const pause = this.record.clockPauses?.at(-1); if (pause?.to === null) pause.to = this.record.totalSeconds!;
    this.manuallyPaused = false; this.autoPaused = false; this.acceptAfterTime = time;
    this.breakTracking('warmingUp'); this.workout?.resume(this.record.activeSeconds); this.syncWorkout();
  }
  signalLost() { if (this.tracking) this.breakTracking('poor'); }
  finish(endedAt: number): RunRecord {
    return JSON.parse(JSON.stringify({ ...this.record, endedAt, pacing: this.pacing.finalized(), ...(this.workout ? { workout: this.workout.finalizedSnapshot() } : {}) })) as RunRecord;
  }
  private breakTracking(quality: SignalQuality, resetFilter = true) {
    if (quality === 'paused' && this.nextPointContinuity !== 'gpsReacquisition' && this.nextPointContinuity !== 'recovery') this.nextPointContinuity = this.autoPaused ? 'autoResume' : 'manualResume';
    else if (this.running && (this.anchor || this.nextPointContinuity === 'continuous')) this.nextPointContinuity = 'gpsReacquisition';
    this.pacing?.interrupt(quality === 'paused' ? 'paused' : 'gpsUnavailable', !!this.anchor && quality !== 'paused' && quality !== 'warmingUp');
    this.workout?.signalLost(!!this.anchor && quality !== 'paused' && quality !== 'warmingUp');
    if (this.anchor) this.segment++;
    this.anchor = null; this.windows = []; this.currentPace = null; this.elevation.reset(); this.autoPause.reset();
    if (resetFilter) this.tracker.reset();
    this.lastFixMonotonic = null; this.quality = quality; this.coach.invalidate(quality === 'paused');
  }
  private reject() {
    this.windows = []; this.currentPace = null; this.quality = 'poor'; this.coach.invalidate();
    this.autoPause.reset(); this.elevation.reset(); this.workout?.signalLost();
    this.pacing.interrupt('gpsUnavailable');
  }
  process(raw: GPSFix, monotonicTime: number, receivedAt: number): AlertCue | null {
    if (!this.tracking || !Number.isFinite(monotonicTime) || monotonicTime < this.acceptAfterTime) return null;
    // Batched samples are mapped back to monotonic time before entering the engine.
    const actualNow = monotonicTime + Math.max(0, (receivedAt - raw.timestamp) / 1000);
    this.checkWallClock(actualNow, receivedAt);
    const elapsed = this.clock.elapsed(monotonicTime);
    if (this.running && this.anchor && elapsed <= this.anchor.activeSeconds) return null;
    const result = this.tracker.process(raw, receivedAt);
    if (result.kind === 'ignored') return null;
    if (result.kind === 'rejected') { this.reject(); return null; }
    if (result.gap) { this.workout?.signalLost(true); this.pacing.interrupt('gpsUnavailable', true); this.breakTracking('warmingUp', false); }
    this.lastFixMonotonic = monotonicTime;
    if (this.record.autoPauseEnabled) {
      const decision = this.autoPause.update(raw, this.autoPaused);
      if (decision === 'pause' && this.running) {
        this.updateTimes(Math.max(monotonicTime, this.lastOperationTime)); this.clock.pause(this.lastOperationTime);
        if (this.record.clockPauses) this.record.clockPauses.push({ from: this.record.totalSeconds!, to: null });
        this.autoPaused = true; this.record.autoPauseCount = (this.record.autoPauseCount ?? 0) + 1;
        this.workout?.pause(this.record.activeSeconds); this.syncWorkout(); this.breakTracking('paused');
        this.lastFixMonotonic = monotonicTime; return null;
      }
      if (decision === 'resume' && this.autoPaused) { this.resume(Math.max(monotonicTime, this.lastOperationTime)); return null; }
    }
    this.updateTimes(monotonicTime);
    if (this.autoPaused) { this.quality = 'paused'; return null; }
    const fix = result.fix, c = this.record.config; let cue: AlertCue | null = null;
    if (this.anchor) {
      const previous = this.anchor, dt = elapsed - previous.activeSeconds;
      if (dt <= 0) return null;
      const before = this.record.distanceMeters;
      this.record.distanceMeters += result.meters;
      this.appendSplits(before, this.record.distanceMeters, previous.activeSeconds, elapsed);
      let windowMeters = result.meters;
      if (result.acquiredSeconds && result.acquiredSeconds > dt) {
        // Acquisition confirms a displacement over several fixes. Spread it across its real
        // time window so it cannot become a brief speed spike when the oldest sample expires.
        const from = elapsed - result.acquiredSeconds, speed = result.meters / result.acquiredSeconds;
        for (const window of this.windows) window.meters += speed * Math.max(0, window.end - Math.max(from, window.end - window.seconds));
        windowMeters = speed * dt;
      }
      this.windows.push({ end: elapsed, seconds: dt, meters: windowMeters }); this.trimWindow(elapsed);
      const seconds = this.windows.reduce((sum, w) => sum + w.seconds, 0), meters = this.windows.reduce((sum, w) => sum + w.meters, 0);
      if (result.moving && seconds >= c.minimumWindowSeconds && meters >= c.minimumWindowMeters && meters / seconds >= .4) {
        const value = seconds / meters * 1000; this.currentPace = value; this.quality = 'good';
        this.record.bestPace = Math.min(this.record.bestPace ?? value, value);
        if (this.activeTarget) cue = this.coach.update(value, elapsed);
      } else {
        this.currentPace = null; this.quality = seconds >= c.minimumWindowSeconds && !result.moving ? 'stationary' : 'warmingUp'; this.coach.invalidate();
      }
      const oldIndex = this.record.workout?.currentIndex;
      const measuredPace = this.currentPace, reliable = this.quality === 'good';
      this.workout?.acceptInterval({ fromSeconds: previous.activeSeconds, toSeconds: elapsed,
        fromMeters: before, toMeters: this.record.distanceMeters, pace: this.currentPace, paceReliable: this.quality === 'good',
        recordReliable: previous.fix.accuracy <= 15 && fix.accuracy <= 15 && dt <= 6 && fix.timestamp > previous.fix.timestamp && fix.timestamp - previous.fix.timestamp <= 6000 });
      this.recordPaceInterval(previous, elapsed, this.record.distanceMeters, measuredPace, reliable);
      const oldTargetKey = this.targetKey;
      this.syncWorkout(false); if (oldIndex !== this.record.workout?.currentIndex || !this.activeTarget || oldTargetKey !== this.targetKey) cue = null;
    } else { this.workout?.position(elapsed, this.record.distanceMeters); this.syncWorkout(); }
    const elevation = this.elevation.update(raw, result.moving);
    this.record.ascentMeters = (this.record.ascentMeters ?? 0) + elevation.ascent;
    this.record.descentMeters = (this.record.descentMeters ?? 0) + elevation.descent;
    this.record.elevationReliableSeconds = (this.record.elevationReliableSeconds ?? 0) + elevation.seconds;
    const point: TrackPoint = { id: this.record.points.length, segment: this.segment, fix: { ...fix },
      activeSeconds: elapsed, meters: this.record.distanceMeters, pace: this.currentPace, altitude: this.elevation.current, totalSeconds: this.totalClock.elapsed(monotonicTime),
      quality: this.quality, continuity: this.nextPointContinuity,
      distanceIntervalStart: result.acquiredSeconds && result.meters > 0 ? Math.max(0, elapsed - result.acquiredSeconds) : this.anchor?.activeSeconds ?? elapsed };
    this.pacing.position({ activeSeconds: elapsed, totalSeconds: point.totalSeconds!, meters: point.meters, timestamp: raw.timestamp }, this.quality === 'good'); this.syncPacing();
    this.record.points.push(point); this.anchor = point; this.nextPointContinuity = 'continuous'; return cue;
  }
  private trimWindow(end: number) {
    const cutoff = end - this.record.config.smoothingSeconds; this.windows = this.windows.filter(w => w.end > cutoff);
    const first = this.windows[0];
    if (first && first.end - cutoff < first.seconds) { const remaining = first.end - cutoff; first.meters *= remaining / first.seconds; first.seconds = remaining; }
  }
  private appendSplits(before: number, after: number, fromTime: number, toTime: number) {
    if (after <= before) return;
    let boundary = (this.record.splits.length + 1) * 1000;
    while (boundary <= after + 1e-7) {
      const crossing = fromTime + (boundary - before) / (after - before) * (toTime - fromTime);
      const previous = this.record.splits.reduce((sum, split) => sum + split.seconds, 0);
      this.record.splits.push({ kilometer: this.record.splits.length + 1, meters: 1000, seconds: crossing - previous, complete: true }); boundary += 1000;
    }
  }
}
