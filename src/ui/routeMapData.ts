import type { TrackPoint } from '../core/types';
import type { RouteCoordinate } from '../routes/types';
import type { PaceRoutePart, PaceZone } from '../analysis/paceRoute';
import type { ThemeColors } from './tokens';

export type MapCommand = { kind: 'position' | 'route'; revision: number };

export interface RouteMapProps {
  points: readonly TrackPoint[];
  paceParts?: PaceRoutePart[];
  reference?: RouteCoordinate[][];
  current?: RouteCoordinate;
  initialPosition?: RouteCoordinate;
  height?: number | 'fill';
  interactive?: boolean;
  live?: boolean;
  follow?: boolean;
  satellite?: boolean;
  command?: MapCommand;
  onPan?: () => void;
}

export const EMPTY_TRACK: readonly TrackPoint[] = [];
export const EMPTY_REFERENCE: RouteCoordinate[][] = [];

export function paceZoneColor(zone: PaceZone, colors: ThemeColors) {
  return zone === 'tooFast' ? colors.danger : zone === 'tooSlow' ? colors.blue
    : zone === 'onTarget' ? colors.paceInTarget : colors.controlLine;
}

/** Simplify display geometry while keeping both ends of every GPS segment. */
export function recordedSegments(points: readonly TrackPoint[]): RouteCoordinate[][] {
  const segments: RouteCoordinate[][] = [];
  const step = Math.max(1, Math.ceil(points.length / 1500));
  let previousSegment: number | undefined;
  for (const [index, point] of points.entries()) {
    if (point.segment !== previousSegment) segments.push([]);
    else if (index % step !== 0 && point.segment === points[index + 1]?.segment) continue;
    segments.at(-1)!.push({ latitude: point.fix.latitude, longitude: point.fix.longitude });
    previousSegment = point.segment;
  }
  return segments;
}

export function referenceSegments(reference: RouteCoordinate[][]) {
  const step = Math.max(1, Math.ceil(reference.reduce((count, segment) => count + segment.length, 0) / 1500));
  return reference.map(segment => segment.filter((_, index) => index === 0 || index === segment.length - 1 || index % step === 0));
}
