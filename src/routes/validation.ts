import type { SavedRoute, ToolsData } from './types';
import { routeLength, validCoordinate } from './geometry';
export function readRoute(value: unknown): SavedRoute {
  const route = value as SavedRoute;
  if (!route || route.version !== 1 || typeof route.id !== 'string' || !route.id || route.id.length > 200 || typeof route.name !== 'string' || route.name.length > 100 || !Number.isFinite(route.createdAt) ||
    !['activity', 'gpx'].includes(route.source) || (route.sourceActivityId !== undefined && typeof route.sourceActivityId !== 'string') || !Array.isArray(route.warnings) || route.warnings.length > 20 || !route.warnings.every(s => typeof s === 'string' && s.length <= 500) ||
    !Array.isArray(route.segments) || route.segments.length > 10000 || !route.segments.every(s => Array.isArray(s) && s.length >= 2 && s.every(validCoordinate)) || route.segments.reduce((n, s) => n + s.length, 0) > 20000) throw new Error('Parcours local illisible. Données conservées.');
  const distanceMeters = routeLength(route.segments);
  if (!(distanceMeters > 1) || distanceMeters > 1000000) throw new Error('Distance du tracé incompatible.');
  return { ...route, distanceMeters };
}
export function readTools(value: unknown): ToolsData {
  const data = value as ToolsData;
  if (!data || data.version !== 1 || (data.selectedRouteId !== null && typeof data.selectedRouteId !== 'string') ||
    typeof data.metronomeEnabled !== 'boolean' || typeof data.cadenceEnabled !== 'boolean' || !Number.isInteger(data.bpm) || data.bpm < 80 || data.bpm > 220 ||
    !Number.isFinite(data.volume) || data.volume < .05 || data.volume > .6 || !Number.isFinite(data.departureMeters) || data.departureMeters < 30 || data.departureMeters > 200) throw new Error('Réglages des outils illisibles. Données conservées.');
  return data;
}
