import type { RouteCoordinate } from '../routes/types';
import { distance } from '../core/geo';
import { distanceToArc, validCoordinate } from '../routes/geometry';
export interface ExportPrivacy { mode: 'public' | 'private'; radiusMeters: number }
export const defaultExportPrivacy: ExportPrivacy = { mode: 'public', radiusMeters: 300 };
export function checkPrivacy(options: ExportPrivacy) {
  if (!options || !['public', 'private'].includes(options.mode) || !Number.isFinite(options.radiusMeters) || options.radiusMeters < 100 || options.radiusMeters > 2000) throw new Error('Choisissez une zone de masquage comprise entre 100 et 2 000 mètres.');
}
/** Remove every visit to either endpoint zone and break edges that cross a hidden zone. */
export function maskedSegments<T extends RouteCoordinate>(segments: T[][], centres: RouteCoordinate[], radiusMeters: number): T[][] {
  const validCentres = centres.filter(validCoordinate);
  if (!validCentres.length) return [];
  const output: T[][] = []; let group: T[] = [];
  const flush = () => { if (group.length >= 2) output.push(group); group = []; };
  for (const segment of segments) {
    flush();
    for (const point of segment) {
      if (!validCoordinate(point) || validCentres.some(c => distance(c, point) <= radiusMeters)) { flush(); continue; }
      const previous = group.at(-1);
      if (previous && validCentres.some(c => distanceToArc(c, previous, point) <= radiusMeters)) flush();
      group.push(point);
    }
  }
  flush(); return output;
}
export function endpointZones(segments: RouteCoordinate[][]): RouteCoordinate[] {
  const first = segments.find(s => s.length)?.[0], last = [...segments].reverse().find(s => s.length)?.at(-1);
  return [first, last].filter((p): p is RouteCoordinate => !!p && validCoordinate(p));
}
