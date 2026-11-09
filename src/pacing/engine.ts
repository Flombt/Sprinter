import type { CoachConfig, RunRecord } from '../core/types';
import { classifyPace } from '../core/coach';
import { referenceForRun, scheduledSeconds } from './goals';
import type { DeviationEnd, PaceDeviation, PacePart, PacingNotice, PacingPosition, PacingReference, PacingSnapshot } from './types';

const LIMIT = 500;
const nonnegative = (n: number) => Number.isFinite(n) && n >= 0;
const validPosition = (p: PacingPosition | null) => p === null || !!p && [p.activeSeconds, p.totalSeconds, p.meters].every(nonnegative) && p.totalSeconds + .001 >= p.activeSeconds && Number.isFinite(p.timestamp);
export function validPacingSnapshot(s: PacingSnapshot): boolean {
  try {
    if (!s || s.version !== 1 || !Array.isArray(s.deviations) || s.deviations.length > LIMIT ||
        ![s.reliableSeconds, s.inTargetSeconds, s.tooFastSeconds, s.tooSlowSeconds, s.deviationCount, s.confirmedCount, s.longestDeviationSeconds,
          s.omittedDeviations, s.legacyReliableSeconds, s.legacyOutsideSeconds].every(nonnegative) ||
        s.inTargetSeconds + s.tooFastSeconds + s.tooSlowSeconds + s.legacyOutsideSeconds > s.reliableSeconds + .001 ||
        typeof s.distanceGap !== 'boolean' || typeof s.expiredNoticeSent !== 'boolean' || (s.lastTimeNoticeAt !== null && !nonnegative(s.lastTimeNoticeAt)) ||
        !validPosition(s.lastPosition) || !validPosition(s.completion)) return false;
    return s.deviations.every((d, i) => d && Number.isInteger(d.id) && ['tooFast', 'tooSlow'].includes(d.direction) && typeof d.context === 'string' &&
      d.target && [d.target.fast, d.target.slow, d.fromSeconds, d.toSeconds, d.fromMeters, d.toMeters, d.seconds, d.extremePace].every(nonnegative) &&
      d.target.fast > 0 && d.target.fast <= d.target.slow && d.toSeconds >= d.fromSeconds && d.toMeters >= d.fromMeters &&
      Math.abs(d.seconds - (d.toSeconds - d.fromSeconds)) < .01 && typeof d.confirmed === 'boolean' &&
      (d.endReason === null ? i === s.deviations.length - 1 : ['recovered', 'directionChanged', 'targetChanged', 'gpsUnavailable', 'paused', 'finished', 'restored', 'free'].includes(d.endReason)));
  } catch { return false; }
}
/** Reliable-time ledger and time-goal calculator. Inputs contain already filtered measurements. */
export class PacingEngine {
  readonly snapshot: PacingSnapshot;
  private reference: PacingReference | null;
  private notices: PacingNotice[] = [];
  private totalEstimated: boolean;
  private capitalCandidate: { direction: 'timeAhead' | 'timeBehind'; seconds: number } | null = null;
  constructor(run: RunRecord, private config: CoachConfig) {
    this.totalEstimated = run.totalEstimated === true;
    if (run.pacing && !validPacingSnapshot(run.pacing)) throw new Error('Historique du coach illisible.');
    this.snapshot = run.pacing ? JSON.parse(JSON.stringify(run.pacing)) : {
      version: 1, reliableSeconds: run.reliableSeconds, inTargetSeconds: run.inTargetSeconds, tooFastSeconds: 0, tooSlowSeconds: 0,
      deviationCount: 0, confirmedCount: 0, longestDeviationSeconds: 0, omittedDeviations: 0,
      legacyReliableSeconds: run.reliableSeconds, legacyOutsideSeconds: Math.max(0, run.reliableSeconds - run.inTargetSeconds),
      deviations: [], distanceGap: run.points.length > 0, lastPosition: null, completion: null, lastTimeNoticeAt: null, expiredNoticeSent: false,
    };
    this.reference = referenceForRun(run); this.interrupt('restored');
  }
  refreshReference(run: RunRecord) { this.reference = referenceForRun(run); }
  private get current(): PaceDeviation | null { const item = this.snapshot.deviations.at(-1); return item?.endReason === null ? item : null; }
  drainNotices() { const notices = this.notices; this.notices = []; return notices; }
  interrupt(reason: DeviationEnd, distanceGap = false) {
    if (this.current) this.current.endReason = reason;
    this.snapshot.distanceGap ||= distanceGap;
    if (distanceGap || ['gpsUnavailable', 'paused', 'restored', 'finished'].includes(reason)) this.capitalCandidate = null;
  }
  accept(part: PacePart) {
    const s = this.snapshot, seconds = part.toSeconds - part.fromSeconds;
    if (!(seconds > 0) || ![part.fromSeconds, part.toSeconds, part.fromMeters, part.toMeters].every(nonnegative) || part.toMeters < part.fromMeters ||
        !part.valid || part.pace === null || !Number.isFinite(part.pace) || part.pace <= 0 || !part.target ||
        ![part.target.fast, part.target.slow].every(n => Number.isFinite(n) && n > 0) || part.target.fast > part.target.slow) {
      this.interrupt(part.target ? 'gpsUnavailable' : 'free'); return;
    }
    let current = this.current;
    if (current && (current.context !== part.context || current.target.fast !== part.target.fast || current.target.slow !== part.target.slow)) { this.interrupt('targetChanged'); current = null; }
    if (current && Math.abs(current.toSeconds - part.fromSeconds) > .01) { this.interrupt('gpsUnavailable'); current = null; }
    const direction = classifyPace(part.pace, part.target);
    s.reliableSeconds += seconds;
    if (direction === 'onTarget') {
      s.inTargetSeconds += seconds;
      if (current?.confirmed) this.notices.push({ kind: 'paceRecovered', at: part.toSeconds, capital: 0, requiredPace: null });
      this.interrupt('recovered'); return;
    }
    if (direction === 'tooFast') s.tooFastSeconds += seconds; else s.tooSlowSeconds += seconds;
    if (current && current.direction !== direction) { this.interrupt('directionChanged'); current = null; }
    if (!current) {
      current = { id: ++s.deviationCount, direction, context: part.context, target: { fast: part.target.fast, slow: part.target.slow },
        fromSeconds: part.fromSeconds, toSeconds: part.fromSeconds, fromMeters: part.fromMeters, toMeters: part.fromMeters,
        seconds: 0, extremePace: part.pace, confirmed: false, endReason: null };
      s.deviations.push(current); if (s.deviations.length > LIMIT) { s.deviations.shift(); s.omittedDeviations++; }
    }
    current.toSeconds = part.toSeconds; current.toMeters = part.toMeters; current.seconds += seconds;
    current.extremePace = direction === 'tooFast' ? Math.min(current.extremePace, part.pace) : Math.max(current.extremePace, part.pace);
    if (!current.confirmed && current.seconds >= this.config.confirmationSeconds) { current.confirmed = true; s.confirmedCount++; }
    s.longestDeviationSeconds = Math.max(s.longestDeviationSeconds, current.seconds);
  }
  position(position: PacingPosition, paceReliable: boolean) {
    const s = this.snapshot, previous = s.lastPosition, reference = this.reference;
    if (!validPosition(position) || (previous && position.activeSeconds < previous.activeSeconds)) return;
    s.lastPosition = { ...position };
    if (!reference) return;
    if (!s.completion && position.meters + 1e-7 >= reference.meters) {
      const ratio = previous && position.meters > previous.meters && previous.meters < reference.meters
        ? Math.max(0, Math.min(1, (reference.meters - previous.meters) / (position.meters - previous.meters))) : 1;
      const from = previous ?? position;
      s.completion = { meters: reference.meters, activeSeconds: from.activeSeconds + ratio * (position.activeSeconds - from.activeSeconds),
        totalSeconds: from.totalSeconds + ratio * (position.totalSeconds - from.totalSeconds), timestamp: from.timestamp + ratio * (position.timestamp - from.timestamp) };
      if (!s.distanceGap && previous && previous.meters < reference.meters) this.notices.push({ kind: 'goalReached', at: position.activeSeconds,
        capital: reference.seconds - (reference.timeBasis === 'total' ? s.completion.totalSeconds : s.completion.activeSeconds), requiredPace: null });
    }
    if (s.completion || s.distanceGap || !reference.explicitTime || !paceReliable || position.meters < 50 || (reference.timeBasis === 'total' && this.totalEstimated)) { this.capitalCandidate = null; return; }
    const elapsed = reference.timeBasis === 'total' ? position.totalSeconds : position.activeSeconds;
    const capital = scheduledSeconds(reference, position.meters) - elapsed;
    const remaining = reference.meters - position.meters, available = reference.seconds - elapsed;
    const requiredPace = available > 0 && remaining > 0 ? available / remaining * 1000 : null;
    if (available <= 0 && !s.expiredNoticeSent) {
      s.expiredNoticeSent = true; this.notices.push({ kind: 'goalExpired', at: position.activeSeconds, capital, requiredPace: null }); return;
    }
    if (available <= 0) { this.capitalCandidate = null; return; }
    const direction = capital > 0 ? 'timeAhead' : 'timeBehind';
    if (Math.abs(capital) < (this.config.timeWarningSeconds ?? 15)) { this.capitalCandidate = null; return; }
    const dt = previous ? position.activeSeconds - previous.activeSeconds : 0;
    if (!this.capitalCandidate || this.capitalCandidate.direction !== direction || dt > this.config.maximumGap) this.capitalCandidate = { direction, seconds: 0 };
    else this.capitalCandidate.seconds += Math.max(0, dt);
    if (this.capitalCandidate.seconds >= this.config.confirmationSeconds && (s.lastTimeNoticeAt === null || position.activeSeconds - s.lastTimeNoticeAt >= Math.max(60, this.config.repeatSeconds))) {
      this.notices.push({ kind: direction, at: position.activeSeconds, capital, requiredPace }); s.lastTimeNoticeAt = position.activeSeconds;
    }
  }
  finalized(): PacingSnapshot {
    const snapshot: PacingSnapshot = JSON.parse(JSON.stringify(this.snapshot)); const current = snapshot.deviations.at(-1);
    if (current?.endReason === null) current.endReason = 'finished'; return snapshot;
  }
}
