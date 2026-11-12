import { classifyPace, sanitizeConfig } from '../core/coach';
import type { RunRecord, TrackPoint } from '../core/types';
import { paceTargetAt } from '../pacing/goals';
import type { RouteCoordinate } from '../routes/types';
import { effectiveTarget } from '../workouts/definition';
import { reliablePace } from './track';

export type PaceZone = ReturnType<typeof classifyPace> | 'unknown';
export interface PaceRoutePart { zone: PaceZone; points: RouteCoordinate[] }
export const paceZones: PaceZone[] = ['tooFast', 'onTarget', 'tooSlow', 'unknown'];

/** The incoming edge uses the measured pace at its endpoint, within one cleaned GPS segment. */
export function paceRoute(run: RunRecord, points: readonly TrackPoint[]): PaceRoutePart[] {
  if (run.targetUnavailable) return [];
  const tolerance = sanitizeConfig(run.config).toleranceSeconds ?? 0;
  const phases = run.workout?.segments;
  const parts: PaceRoutePart[] = [];
  let previous: TrackPoint | undefined;
  let current: PaceRoutePart | undefined;
  let phaseIndex = 0;
  for (const point of points) {
    if (previous && previous.segment === point.segment) {
      while (phases && phaseIndex < phases.length &&
        (phases[phaseIndex]?.endedAt ?? Infinity) <= point.activeSeconds) phaseIndex++;
      const phase = phases?.[phaseIndex];
      const target = phases
        ? phase?.startedAt != null && phase.startedAt <= point.activeSeconds ? effectiveTarget(phase.planned) : null
        : paceTargetAt(run.target, point.meters);
      const measured = reliablePace(point, run);
      const zone = target && measured !== null ? classifyPace(measured, target, tolerance) : 'unknown';
      if (!current || current.zone !== zone) {
        current = { zone, points: [{ latitude: previous.fix.latitude, longitude: previous.fix.longitude }] };
        parts.push(current);
      }
      current.points.push({ latitude: point.fix.latitude, longitude: point.fix.longitude });
    } else current = undefined;
    previous = point;
  }
  if (!parts.some(part => part.zone !== 'unknown')) return [];
  const step = Math.max(1, Math.ceil(points.length / 1500));
  return step === 1 ? parts : parts.map(part => ({ ...part,
    points: part.points.filter((_, index) => index === 0 || index === part.points.length - 1 || index % step === 0),
  }));
}
