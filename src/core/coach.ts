import { AlertCue, CoachConfig, DEFAULT_CONFIG, PaceState, PaceTarget } from './types';
import { validateTarget } from './format';

export function sanitizeConfig(config: CoachConfig): CoachConfig {
  const clamp = (x: number, low: number, high: number, fallback: number) => Number.isFinite(x) ? Math.min(high, Math.max(low, x)) : fallback;
  const c = { ...DEFAULT_CONFIG, ...config };
  c.confirmationSeconds = clamp(c.confirmationSeconds, 1, 60, 10);
  c.repeatSeconds = clamp(c.repeatSeconds, 10, 180, 30);
  c.hysteresisSeconds = clamp(c.hysteresisSeconds, 0, 15, 3);
  c.smoothingSeconds = clamp(c.smoothingSeconds, 8, 60, 20);
  c.minimumWindowSeconds = clamp(c.minimumWindowSeconds, 2, c.smoothingSeconds, 8);
  c.minimumWindowMeters = clamp(c.minimumWindowMeters, 3, 50, 12);
  c.maximumAccuracy = clamp(c.maximumAccuracy, 5, 50, 25);
  c.maximumGap = clamp(c.maximumGap, 2, 15, 6);
  c.maximumSpeed = clamp(c.maximumSpeed, 6, 15, 12);
  c.maximumSampleAge = clamp(c.maximumSampleAge, 2, 30, 10);
  c.toleranceSeconds = clamp(c.toleranceSeconds ?? 0, 0, 60, 0);
  c.timeWarningSeconds = clamp(c.timeWarningSeconds ?? 15, 5, 120, 15);
  return c;
}
export function classifyPace(value: number, target: Pick<PaceTarget, 'fast' | 'slow'>, tolerance = 0): 'tooFast' | 'tooSlow' | 'onTarget' {
  return value < target.fast - tolerance ? 'tooFast' : value > target.slow + tolerance ? 'tooSlow' : 'onTarget';
}

/** Pure state machine. A SMALLER min/km value means FASTER. Never schedules timers. */
export class PaceCoach {
  /** Instant classification of the smoothed measurement, separate from hysteresis-gated alert state. */
  classification: PaceState = 'acquiring';
  state: PaceState = 'acquiring';
  private candidateSince: number | null = null;
  private lastSample: number | null = null;
  private lastAlert: number | null = null;
  private candidate: 'tooFast' | 'tooSlow' | null = null;
  readonly config: CoachConfig;
  target: PaceTarget;
  constructor(target: PaceTarget, config: CoachConfig = DEFAULT_CONFIG) {
    const error = validateTarget(target); if (error) throw new Error(error);
    this.config = sanitizeConfig(config);
    this.target = { ...target };
  }
  retarget(target: PaceTarget) {
    const error = validateTarget(target); if (error) throw new Error(error);
    this.target = { ...target }; this.invalidate(); this.state = 'acquiring'; this.classification = 'acquiring';
  }
  invalidate(paused = false) {
    this.state = paused ? 'paused' : 'unreliable'; this.candidateSince = null; this.lastSample = null; this.candidate = null;
    this.classification = this.state;
    // Cooldown is global, including across pauses, direction changes and GPS losses.
  }
  update(value: number | null, time: number): AlertCue | null {
    if (value === null || !Number.isFinite(value) || value <= 0 || !Number.isFinite(time)) { this.invalidate(); return null; }
    if (this.lastSample !== null) {
      if (time <= this.lastSample) return null;
      if (time - this.lastSample > this.config.maximumGap) { this.candidateSince = null; this.candidate = null; }
    }
    this.lastSample = time;
    const tolerance = this.config.toleranceSeconds ?? 0, next = classifyPace(value, this.target, tolerance);
    this.classification = next;
    if (next === 'onTarget') { this.state = next; this.candidate = null; this.candidateSince = null; return null; }
    const crossed = next === 'tooFast' ? value < this.target.fast - tolerance - this.config.hysteresisSeconds
      : value > this.target.slow + tolerance + this.config.hysteresisSeconds;
    if (this.candidate !== next) { this.candidate = null; this.candidateSince = null; if (!crossed) { this.state = 'onTarget'; return null; } this.candidate = next; }
    this.state = next;
    this.candidateSince ??= time;
    if (time - this.candidateSince < this.config.confirmationSeconds ||
        (this.lastAlert !== null && time - this.lastAlert < this.config.repeatSeconds)) return null;
    this.lastAlert = time;
    return next === 'tooFast' ? 'slowDown' : 'speedUp';
  }
}
