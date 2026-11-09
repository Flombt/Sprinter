import { XMLParser, XMLValidator } from 'fast-xml-parser';
import type { RunRecord } from '../core/types';
import { cleanTrack } from '../analysis/track';
import { distance } from '../core/geo';
import { routeLength, validCoordinate } from './geometry';
import type { RouteCoordinate, SavedRoute } from './types';
export const MAX_GPX_BYTES = 2 * 1024 * 1024;
export const MAX_ROUTE_POINTS = 20000;
const list = <T,>(value: T | T[] | undefined): T[] => value === undefined ? [] : Array.isArray(value) ? value : [value];
const number = (value: unknown) => typeof value === 'string' && value.trim() !== '' ? Number(value) : NaN;
const identifier = () => `route:${Date.now()}:${Math.random().toString(36).slice(2, 12)}`;
export function createRoute(name: string, segments: RouteCoordinate[][], source: SavedRoute['source'], warnings: string[] = [], sourceActivityId?: string): SavedRoute {
  const valid = segments.filter(s => s.length >= 2);
  const points = valid.reduce((n, s) => n + s.length, 0), meters = routeLength(valid);
  if (points > MAX_ROUTE_POINTS || !points || !Number.isFinite(meters) || meters <= 1 || meters > 1000000 || !valid.every(s => s.every(validCoordinate))) throw new Error('Le parcours doit contenir des segments exploitables, au plus 20 000 points et 1 000 km de tracé.');
  return { version: 1, id: identifier(), name: name.trim().slice(0, 100) || 'Parcours sans nom', createdAt: Date.now(), source, segments: valid, distanceMeters: meters, warnings, ...(sourceActivityId ? { sourceActivityId } : {}) };
}
/** Geometry only: GPX timestamps, extensions, routes and names never create a completed activity. */
export function importGPX(xml: string, filename: string): SavedRoute {
  if (xml.length > MAX_GPX_BYTES || /<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error('GPX trop volumineux ou contenant une déclaration XML non prise en charge.');
  if (XMLValidator.validate(xml) !== true) throw new Error('Le fichier GPX n’est pas un document XML valide.');
  const parser = new XMLParser({ ignoreAttributes: false, removeNSPrefix: true, parseTagValue: false, parseAttributeValue: false, processEntities: false, trimValues: true, maxNestedTags: 32 });
  const root = parser.parse(xml)?.gpx;
  if (!root || typeof root !== 'object' || Array.isArray(root)) throw new Error('Le document ne contient pas de racine GPX.');
  const groups: unknown[][] = [];
  for (const track of list<any>(root.trk)) for (const segment of list<any>(track?.trkseg)) groups.push(list(segment?.trkpt));
  for (const route of list<any>(root.rte)) groups.push(list(route?.rtept));
  if (groups.reduce((n, g) => n + g.length, 0) > MAX_ROUTE_POINTS) throw new Error('Le GPX dépasse la limite de 20 000 points.');
  const segments: RouteCoordinate[][] = []; let current: RouteCoordinate[] = []; let rejected = 0, gaps = 0;
  const flush = () => { if (current.length >= 2) segments.push(current); current = []; };
  for (const group of groups) {
    flush();
    for (const item of group) {
      const point = item as Record<string, unknown>;
      const coordinate: RouteCoordinate = { latitude: number(point?.['@_lat']), longitude: number(point?.['@_lon']) };
      if (!validCoordinate(coordinate)) { rejected++; flush(); continue; }
      const altitude = number(point.ele); if (Number.isFinite(altitude) && altitude >= -500 && altitude <= 9000) coordinate.altitude = altitude;
      const previous = current.at(-1), meters = previous ? distance(previous, coordinate) : 0;
      if (previous && meters > 1000) { gaps++; flush(); }
      else if (previous && meters < .2) continue;
      current.push(coordinate);
    }
  }
  flush();
  const label = list<any>(root.trk)[0]?.name ?? list<any>(root.rte)[0]?.name;
  const warnings: string[] = [];
  if (rejected) warnings.push(`${rejected} position(s) invalide(s) écartée(s), sans raccorder leurs voisins.`);
  if (gaps) warnings.push(`${gaps} liaison(s) de plus d’un kilomètre retirée(s). Le tracé est incomplet.`);
  if (segments.length > 1) warnings.push('Plusieurs segments distincts : aucune liaison ni instruction entre ces portions.');
  return createRoute(typeof label === 'string' ? label : filename.replace(/\.gpx$/i, ''), segments, 'gpx', warnings);
}
export function routeFromActivity(run: RunRecord): SavedRoute {
  const track = cleanTrack(run);
  return createRoute(`Sortie du ${new Date(run.startedAt).toLocaleDateString('fr-FR')}`, track.segments.map(s => s.map(p => ({ latitude: p.fix.latitude, longitude: p.fix.longitude }))), 'activity',
    track.hasDistanceGaps ? ['Des portions de la course sont absentes ; elles ne sont pas raccordées.'] : [], run.id);
}
