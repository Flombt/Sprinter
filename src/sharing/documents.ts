import type { RunRecord } from '../core/types';
import type { ExportDocument } from '../analysis/export/types';
import { cleanTrack } from '../analysis/track';
import { exportActivity } from '../analysis/export';
import { gpxDecimal, gpxLongitude } from '../analysis/export/gpx';
import { duration, km, pace, averagePace } from '../core/format';
import { activityAnalysis } from '../analysis/cache';
import { csvField } from '../analysis/export/csv';
import type { RouteCoordinate, SavedRoute } from '../routes/types';
import { checkPrivacy, endpointZones, maskedSegments, type ExportPrivacy } from './privacy';
export const escapeXML = (text: string) => text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
export function geometryGPX(segments: RouteCoordinate[][], name: string, filename: string): ExportDocument {
  const points = segments.reduce((n, s) => n + s.length, 0);
  if (points < 2) throw new Error('Aucun segment exportable après masquage. Réduisez le rayon ou choisissez consciemment une copie complète.');
  const lines = ['<?xml version="1.0" encoding="UTF-8"?>', '<gpx version="1.1" creator="Sprinter" xmlns="http://www.topografix.com/GPX/1/1">', `<trk><name>${escapeXML(name)}</name><type>running</type>`];
  for (const segment of segments) {
    lines.push('<trkseg>');
    for (const point of segment) lines.push(`<trkpt lat="${gpxDecimal(point.latitude)}" lon="${gpxDecimal(gpxLongitude(point.longitude))}"/>`);
    lines.push('</trkseg>');
  }
  lines.push('</trk></gpx>');
  return { filename, data: lines.join('\n'), mimeType: 'application/gpx+xml', points, segments: segments.length };
}
export function publicActivitySegments(run: RunRecord, radius: number): RouteCoordinate[][] {
  const track = cleanTrack(run);
  const segments = track.segments.map(s => s.map(p => ({ latitude: p.fix.latitude, longitude: p.fix.longitude })));
  const rawEndpoints = [run.points[0]?.fix, run.points.at(-1)?.fix].filter((p): p is NonNullable<typeof p> => !!p);
  return maskedSegments(segments, [...endpointZones(segments), ...rawEndpoints], radius);
}
export function activityDocument(run: RunRecord, format: 'gpx' | 'csv', privacy: ExportPrivacy): ExportDocument {
  checkPrivacy(privacy);
  if (privacy.mode === 'private') return exportActivity(run, format);
  if (run.endedAt === null) throw new Error('Terminez la course avant son partage.');
  const segments = publicActivitySegments(run, privacy.radiusMeters);
  if (format === 'gpx') return geometryGPX(segments, 'Parcours Sprinter · zones masquées', 'sprinter-public.gpx');
  // Public copy intentionally omits IDs, source, timestamps and original per-point counters.
  const rows = ['type,distanceMeters,activeSeconds,totalSeconds,totalEstimated,segment,latitude,longitude',
    `activity,${run.distanceMeters},${run.activeSeconds},${run.totalSeconds ?? ''},${run.totalEstimated === true},,,`];
  segments.forEach((s, i) => s.forEach(p => rows.push(`point,,,,,${i + 1},${p.latitude.toFixed(8)},${p.longitude.toFixed(8)}`)));
  return { filename: 'sprinter-public.csv', mimeType: 'text/csv', data: '\uFEFF' + rows.join('\r\n'), points: segments.reduce((n, s) => n + s.length, 0), segments: segments.length };
}
export function routeDocument(route: SavedRoute, privacy: ExportPrivacy) {
  checkPrivacy(privacy);
  const segments = privacy.mode === 'public' ? maskedSegments(route.segments, endpointZones(route.segments), privacy.radiusMeters) : route.segments;
  return geometryGPX(segments, privacy.mode === 'public' ? 'Parcours Sprinter · zones masquées' : route.name, privacy.mode === 'public' ? 'sprinter-parcours-public.gpx' : 'sprinter-parcours-complet.gpx');
}
export function activitySummary(run: RunRecord): string {
  const analysis = activityAnalysis(run), percentage = analysis.deviations.percentage;
  return [`Ma course avec Sprinter : ${km(run.distanceMeters)} km.`, `Temps actif : ${duration(run.activeSeconds)}.`,
    run.totalSeconds === undefined ? null : `Temps total${run.totalEstimated ? ' estimé' : ''} : ${duration(run.totalSeconds)}.`,
    `Allure moyenne active : ${pace(averagePace(run))} /km.`, percentage === null ? null : `Dans la cible : ${Math.round(percentage)} % sur ${duration(analysis.deviations.reliableSeconds)} de mesures fiables.`,
    'Résumé sans position ni horaire de départ.'].filter(Boolean).join('\n');
}
export function statisticsDocument(run: RunRecord, privacy: ExportPrivacy): ExportDocument {
  checkPrivacy(privacy); if (run.endedAt === null) throw new Error('Terminez la course avant de partager ses statistiques.');
  const data = activityAnalysis(run);
  type Row = [string, string | number | boolean | null | undefined, string];
  const rows: Row[] = [
    ['distance', run.distanceMeters, 'm'], ['activeTime', run.activeSeconds, 's'], ['totalTime', run.totalSeconds, 's'], ['totalEstimated', run.totalEstimated === true, 'boolean'],
    ['averageActivePace', data.averagePace, 's/km'], ['averageActiveSpeed', data.averageSpeed, 'km/h'],
    ['fastestReliablePace', data.fastestReliablePace, 's/km'], ['slowestReliablePace', data.slowestReliablePace, 's/km'],
    ['ascentReliable', data.ascent, 'm'], ['descentReliable', data.descent, 'm'], ['altitudeReliableTime', data.elevationSeconds, 's'],
    ['inTarget', data.deviations.percentage, '%'], ['targetReliableTime', data.deviations.reliableSeconds, 's'],
    ['paceDeviationCount', data.deviations.count, 'count'], ['outsideTargetTime', data.deviations.outsideSeconds, 's'],
    ['gpsCoveredDistance', data.track.coveredDistance, 'm'], ['gpsDistanceGaps', data.track.hasDistanceGaps, 'boolean'],
  ];
  if (privacy.mode === 'private') rows.push(['activityId', run.id, 'text'], ['source', run.healthKit?.sourceBundle ?? 'app.sprinter.running', 'text'],
    ['startedAt', new Date(run.startedAt).toISOString(), 'ISO8601'], ['endedAt', new Date(run.endedAt).toISOString(), 'ISO8601']);
  const encoded = [['metric', 'value', 'unit', 'availability'], ...rows.map(([name, value, unit]) => [name, value, unit, value === null || value === undefined ? 'unavailable' : 'available'])];
  return { filename: `sprinter-statistiques-${privacy.mode === 'public' ? 'public' : 'prive'}.csv`, mimeType: 'text/csv', data: '\uFEFF' + encoded.map(row => row.map(csvField).join(',')).join('\r\n'), points: 0, segments: 0 };
}
