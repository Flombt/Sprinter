import type { CoachConfig, RunRecord, TrackPoint } from '../core/types';
import { sanitizeConfig } from '../core/coach';
import { distance } from '../core/geo';
import type { CleanTrack, TrackBreak } from './types';
export const EPS = 1e-6;
const configurations = new WeakMap<RunRecord, CoachConfig>();
function analysisConfig(run: RunRecord) {
  let config = configurations.get(run); if (!config) { config = sanitizeConfig(run.config); configurations.set(run, config); } return config;
}
export function isoTimestamp(value: number): string | null {
  return Number.isFinite(value) && Math.abs(value) <= 8640000000000000 ? new Date(value).toISOString() : null;
}
export function validPosition(p: TrackPoint, run: RunRecord): boolean {
  const maximumAccuracy = analysisConfig(run).maximumAccuracy;
  return !!p && !!p.fix && [p.activeSeconds, p.meters, p.fix.latitude, p.fix.longitude, p.fix.accuracy, p.fix.timestamp].every(Number.isFinite) &&
    p.activeSeconds >= 0 && p.activeSeconds <= run.activeSeconds + .01 && p.meters >= 0 && p.meters <= run.distanceMeters + .01 &&
    Math.abs(p.fix.latitude) <= 90 && Math.abs(p.fix.longitude) <= 180 && p.fix.accuracy >= 0 && p.fix.accuracy <= maximumAccuracy && isoTimestamp(p.fix.timestamp) !== null;
}
export function reliablePace(p: TrackPoint, run: RunRecord): number | null {
  const value = p.pace;
  return value !== null && Number.isFinite(value) && value > 0 && value < 6000 && 1000 / value <= analysisConfig(run).maximumSpeed + .01 &&
    (p.quality === undefined || p.quality === 'good') ? value : null;
}
export function reliableAltitude(p: TrackPoint): number | null {
  return p.altitude != null && Number.isFinite(p.altitude) && p.altitude >= -500 && p.altitude <= 9000 &&
    p.fix.altitudeAccuracy != null && Number.isFinite(p.fix.altitudeAccuracy) && p.fix.altitudeAccuracy >= 0 && p.fix.altitudeAccuracy <= 8 ? p.altitude : null;
}
/** Vertical values need a coherent neighbouring observation, not just an accuracy field. */
export function qualifiedAltitudes(track: CleanTrack): Map<TrackPoint, number> {
  const result = new Map<TrackPoint, number>();
  for (const segment of track.observations) {
    let group: { point: TrackPoint; value: number }[] = [];
    const flush = () => { if (group.length >= 2) for (const item of group) result.set(item.point, item.value); group = []; };
    for (const point of segment) {
      const value = reliableAltitude(point), previous = group.at(-1);
      if (value === null) { flush(); continue; }
      if (previous) {
        const dt = point.activeSeconds - previous.point.activeSeconds;
        if (dt <= 0 || dt > 6) flush();
        else if (Math.abs(value - previous.value) / dt > 3) { flush(); continue; }
      }
      group.push({ point, value });
    }
    flush();
  }
  return result;
}
function breakReason(p: TrackPoint): TrackBreak['reason'] {
  return p.continuity === 'manualResume' || p.continuity === 'autoResume' ? 'pause' : p.continuity === 'gpsReacquisition' ? 'gps' : p.continuity === 'recovery' ? 'recovery' : 'unknown';
}
/** Preserve observation order, split unreliable links, and undo only documented acquisition plateaus. */
export function cleanTrack(run: RunRecord, limits: { maximumAccuracy?: number; maximumGap?: number } = {}): CleanTrack {
  const config = sanitizeConfig(run.config), segments: TrackPoint[][] = [], observations: TrackPoint[][] = [], breaks: TrackBreak[] = [];
  config.maximumAccuracy = Math.min(config.maximumAccuracy, limits.maximumAccuracy ?? config.maximumAccuracy);
  config.maximumGap = Math.min(config.maximumGap, limits.maximumGap ?? config.maximumGap);
  let current: TrackPoint[] = [], samples: TrackPoint[] = [], previous: TrackPoint | null = null, invalidPoints = 0, collapsedPoints = 0;
  const split = (reason: TrackBreak['reason'], p: TrackPoint | null) => {
    if (current.length) segments.push(current); if (samples.length) observations.push(samples); current = []; samples = [];
    breaks.push({ reason, meters: p?.meters ?? previous?.meters ?? 0, activeSeconds: p?.activeSeconds ?? previous?.activeSeconds ?? 0 });
  };
  for (const p of run.points) {
    if (!validPosition(p, run) || p.fix.accuracy > config.maximumAccuracy || (previous && (p.activeSeconds < previous.activeSeconds - EPS || p.meters < previous.meters - EPS))) {
      invalidPoints++; split('invalid', previous); previous = null; continue;
    }
    if (!previous && !segments.length && !current.length && p.activeSeconds > config.maximumGap) split('gps', p);
    if (previous) {
      const dt = (p.fix.timestamp - previous.fix.timestamp) / 1000, activeDt = p.activeSeconds - previous.activeSeconds;
      const elapsedDt = p.totalSeconds !== undefined && previous.totalSeconds !== undefined ? p.totalSeconds - previous.totalSeconds : dt;
      if (p.segment !== previous.segment || (p.continuity !== undefined && p.continuity !== 'continuous')) {
        const reason = breakReason(p); split(reason === 'pause' && (activeDt > config.maximumGap || p.meters > previous.meters + EPS) ? 'gps' : reason, p);
      }
      else if (dt <= 0 || dt > config.maximumGap || activeDt < 0 || activeDt > config.maximumGap) split(dt <= 0 ? 'clock' : 'gps', p);
      else if (Math.abs(elapsedDt - activeDt) > Math.max(.5, Math.abs(elapsedDt) * .15)) split('clock', p);
      else if (current.length) {
        let anchorIndex = current.length - 1;
        if (p.meters > previous.meters + EPS) {
          const start = p.distanceIntervalStart;
          if (start !== undefined && Number.isFinite(start) && start < previous.activeSeconds - .01) {
            let found = -1;
            for (let i = current.length - 1; i >= 0 && Math.abs(current[i]!.meters - previous.meters) < EPS; i--) {
              if (Math.abs(current[i]!.activeSeconds - start) <= .05) { found = i; break; }
            }
            if (found < 0) { split('invalid', p); invalidPoints++; }
            else anchorIndex = found;
          } else if (start === undefined && p.pace === null && previous.pace === null) {
            // Older recordings lack the interval origin. The earliest plateau time is conservative.
            while (anchorIndex > 0 && Math.abs(current[anchorIndex - 1]!.meters - previous.meters) < EPS) anchorIndex--;
          }
        }
        if (current.length) {
          const anchor = current[anchorIndex]!, seconds = p.activeSeconds - anchor.activeSeconds;
          const delta = p.meters - anchor.meters;
          const geo = distance(anchor.fix, p.fix);
          if ((delta > EPS || geo > .5) && (!(seconds > 0) || Math.max(delta, geo) / seconds > config.maximumSpeed + .1)) {
            split('invalid', p); invalidPoints++;
          } else if (anchorIndex < current.length - 1) {
            collapsedPoints += current.length - anchorIndex - 1; current.length = anchorIndex + 1;
          }
        }
      }
    }
    current.push(p); samples.push(p); previous = p;
  }
  if (current.length) segments.push(current);
  if (samples.length) observations.push(samples);
  const coveredDistance = segments.reduce((n, s) => n + Math.max(0, s.at(-1)!.meters - s[0]!.meters), 0);
  const coveredSeconds = segments.reduce((n, s) => n + Math.max(0, s.at(-1)!.activeSeconds - s[0]!.activeSeconds), 0);
  return { segments, observations, breaks, invalidPoints, collapsedPoints, pointCount: segments.reduce((n, s) => n + s.length, 0), coveredDistance, coveredSeconds,
    hasDistanceGaps: breaks.some(b => b.reason !== 'pause') || coveredDistance + .1 < run.distanceMeters };
}
