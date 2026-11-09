import type { RunRecord } from '../core/types';
import { EPS } from './track';
import type { CleanTrack, DistanceTime, KilometerSplit } from './types';

export function atDistance(track: CleanTrack, meters: number): DistanceTime | null {
  for (const segment of track.segments) {
    for (let i = 0; i < segment.length; i++) {
      const p = segment[i]!;
      if (p.meters + EPS < meters) continue;
      if (Math.abs(p.meters - meters) <= EPS) return { meters, activeSeconds: p.activeSeconds, totalSeconds: p.totalSeconds ?? null, timestamp: p.fix.timestamp };
      const a = segment[i - 1]; if (!a || a.meters > meters || p.meters <= a.meters) return null;
      const ratio = (meters - a.meters) / (p.meters - a.meters);
      return { meters, activeSeconds: a.activeSeconds + ratio * (p.activeSeconds - a.activeSeconds),
        totalSeconds: a.totalSeconds !== undefined && p.totalSeconds !== undefined ? a.totalSeconds + ratio * (p.totalSeconds - a.totalSeconds) : null,
        timestamp: a.fix.timestamp + ratio * (p.fix.timestamp - a.fix.timestamp) };
    }
  }
  return null;
}
export function reliableDistanceRange(track: CleanTrack, fromMeters: number, toMeters: number): boolean {
  if (!(toMeters > fromMeters) || !atDistance(track, fromMeters) || !atDistance(track, toMeters)) return false;
  return !track.breaks.some(b => b.reason !== 'pause' && b.meters >= fromMeters - EPS && b.meters <= toMeters + EPS);
}
export function courseTimeAt(run: RunRecord, track: CleanTrack, meters: number): DistanceTime | null {
  const time = atDistance(track, meters);
  if (!time) return null;
  return { ...time, totalSeconds: run.totalEstimated ? null : time.totalSeconds };
}
export function kilometerSplits(run: RunRecord, track: CleanTrack): KilometerSplit[] {
  const splits: KilometerSplit[] = [], distance = run.distanceMeters;
  if (!Number.isFinite(distance) || distance <= 0) return splits;
  if (!track.pointCount) {
    // Existing counters can still be displayed, but cannot qualify records or exact-distance comparisons.
    for (const split of run.splits) if (split && Number.isInteger(split.kilometer) && split.kilometer > 0 && Number.isFinite(split.meters) && split.meters > 0 && split.meters <= 1000 && Number.isFinite(split.seconds) && split.seconds > 0 && split.seconds <= run.activeSeconds) {
      splits.push({ kilometer: split.kilometer, fromMeters: (split.kilometer - 1) * 1000, toMeters: (split.kilometer - 1) * 1000 + split.meters,
        meters: split.meters, partial: !split.complete, activeSeconds: split.seconds, totalSeconds: null, pace: split.seconds / split.meters * 1000, reliable: false, source: 'counter' });
    }
    return splits;
  }
  for (let from = 0, kilometer = 1; from < distance - EPS && kilometer <= 1000; from += 1000, kilometer++) {
    const to = Math.min(from + 1000, distance), origin = atDistance(track, from), end = courseTimeAt(run, track, to);
    const start = from === 0 && origin ? { ...origin, activeSeconds: 0, totalSeconds: run.totalSeconds === undefined ? null : 0 } : courseTimeAt(run, track, from);
    const activeSeconds = start && end && end.activeSeconds >= start.activeSeconds ? end.activeSeconds - start.activeSeconds : null;
    const elapsed = start?.totalSeconds != null && end?.totalSeconds != null && end.totalSeconds >= start.totalSeconds ? end.totalSeconds - start.totalSeconds : null;
    const totalSeconds = elapsed !== null && activeSeconds !== null && elapsed >= activeSeconds - .05 ? Math.max(elapsed, activeSeconds) : null;
    splits.push({ kilometer, fromMeters: from, toMeters: to, meters: to - from, partial: to - from < 1000 - EPS, activeSeconds, totalSeconds,
      pace: activeSeconds !== null && activeSeconds > 0 ? activeSeconds / (to - from) * 1000 : null, reliable: reliableDistanceRange(track, from, to), source: 'positions' });
  }
  return splits;
}
