import { distance } from '../core/geo';
import type { RouteCoordinate } from './types';
export const validCoordinate = (p: RouteCoordinate) => !!p && Number.isFinite(p.latitude) && Math.abs(p.latitude) <= 90 && Number.isFinite(p.longitude) && Math.abs(p.longitude) <= 180;
const rad = Math.PI / 180, radius = 6371000;
function bearing(a: RouteCoordinate, b: RouteCoordinate) {
  const delta = (b.longitude - a.longitude) * rad, latA = a.latitude * rad, latB = b.latitude * rad;
  return Math.atan2(Math.sin(delta) * Math.cos(latB), Math.cos(latA) * Math.sin(latB) - Math.sin(latA) * Math.cos(latB) * Math.cos(delta));
}
/** Distance to the finite great-circle arc, including dateline crossings. No road snapping. */
export function distanceToArc(p: RouteCoordinate, a: RouteCoordinate, b: RouteCoordinate): number {
  const length = distance(a, b); if (length < .01) return distance(p, a);
  const delta = distance(a, p) / radius, angle = bearing(a, p) - bearing(a, b);
  const along = Math.atan2(Math.sin(delta) * Math.cos(angle), Math.cos(delta)) * radius;
  if (along <= 0) return distance(p, a);
  if (along >= length) return distance(p, b);
  return Math.abs(Math.asin(Math.max(-1, Math.min(1, Math.sin(delta) * Math.sin(angle)))) * radius);
}
export function routeLength(segments: RouteCoordinate[][]): number {
  let meters = 0; for (const segment of segments) for (let i = 1; i < segment.length; i++) meters += distance(segment[i - 1]!, segment[i]!);
  return meters;
}
export function nearestTrace(p: RouteCoordinate, segments: RouteCoordinate[][]): number | null {
  let minimum = Infinity;
  for (const segment of segments) for (let i = 1; i < segment.length; i++) minimum = Math.min(minimum, distanceToArc(p, segment[i - 1]!, segment[i]!));
  return Number.isFinite(minimum) ? minimum : null;
}
