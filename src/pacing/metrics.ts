import type { RunRecord, SignalQuality } from '../core/types';
import { referenceForRun, scheduledSeconds } from './goals';
import type { PacingProgress } from './types';
export function pacingProgress(run: RunRecord, quality: SignalQuality = 'good', running = false): PacingProgress {
  const reference = referenceForRun(run), snapshot = run.pacing;
  const empty: PacingProgress = { reference, status: 'noDistance', capitalSeconds: null, projectedFinishSeconds: null, estimatedArrival: null,
    requiredPace: null, reachable: false, measuredAt: null };
  if (!reference) return empty;
  if (reference.timeBasis === 'total' && run.totalEstimated) return { ...empty, status: 'estimatedTime' };
  if (snapshot?.distanceGap) return { ...empty, status: 'partialDistance' };
  const position = snapshot?.completion ?? snapshot?.lastPosition;
  if (!position || position.meters < 50) return { ...empty, status: 'acquiring' };
  const completed = !!snapshot?.completion, stopped = run.endedAt !== null, paused = !running && !stopped;
  if (!completed && !paused && !stopped && quality !== 'good') return { ...empty, status: 'gpsUnavailable', measuredAt: position.timestamp };
  let elapsed = reference.timeBasis === 'total' ? position.totalSeconds : position.activeSeconds;
  if (!completed && paused && reference.timeBasis === 'total') elapsed = run.totalSeconds ?? position.totalSeconds;
  const meters = Math.min(position.meters, reference.meters), remaining = Math.max(0, reference.meters - meters);
  const capital = scheduledSeconds(reference, meters) - elapsed;
  const average = position.meters > 0 ? position.activeSeconds / position.meters * 1000 : null;
  const available = reference.seconds - elapsed;
  const required = remaining > 0 && available > 0 ? available / remaining * 1000 : null;
  // A large time reserve may permit an arbitrarily slow finish; it is not an impossible goal.
  const reachable = completed || required !== null && required >= Math.max(120, 1000 / run.config.maximumSpeed);
  const projected = completed ? elapsed : running && !stopped && average !== null ? elapsed + remaining / 1000 * average : null;
  return { reference, status: completed ? 'completed' : stopped ? 'stopped' : paused ? 'paused' : 'running', capitalSeconds: capital,
    projectedFinishSeconds: projected, estimatedArrival: projected !== null && running && !completed ? position.timestamp + (projected - elapsed) * 1000 : null,
    requiredPace: required, reachable, measuredAt: position.timestamp };
}
