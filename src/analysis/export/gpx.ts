import type { TrackPoint } from '../../core/types';
import { isoTimestamp, qualifiedAltitudes, reliablePace, EPS } from '../track';
import type { ActivityExporter } from './types';

const xml = (value: string) => value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
const decimal = (value: number, digits = 3) => value.toFixed(digits).replace(/\.?0+$/, '') || '0';
function compactStationary(points: TrackPoint[]): TrackPoint[] {
  const result: TrackPoint[] = [];
  for (let i = 0; i < points.length; i++) {
    const first = points[i]!; let end = i;
    while (end + 1 < points.length && Math.abs(points[end + 1]!.meters - first.meters) <= EPS) end++;
    result.push(first); if (end > i) result.push(points[end]!); i = end;
  }
  return result;
}
export const gpxExporter: ActivityExporter = {
  id: 'gpx', label: 'GPX 1.1',
  encode({ run, track }) {
    if (run.endedAt === null) throw new Error('Terminez la course avant d’exporter son parcours.');
    const segments = track.segments.map(compactStationary).filter(s => s.length > 0);
    const altitudes = qualifiedAltitudes(track);
    const points = segments.reduce((n, s) => n + s.length, 0);
    if (points < 2) throw new Error('Le parcours ne contient pas assez de positions GPS exploitables pour un export.');
    const name = `Sprinter · ${new Date(run.startedAt).toLocaleDateString('fr-FR')}`;
    const lines = ['<?xml version="1.0" encoding="UTF-8"?>',
      '<gpx version="1.1" creator="Sprinter" xmlns="http://www.topografix.com/GPX/1/1" xmlns:sprinter="urn:sprinter:activity:1">',
      `<metadata><name>${xml(name)}</name><desc>Parcours GPS filtré. Les interruptions sont séparées. Les mesures sportives enregistrées figurent dans les extensions.</desc>${isoTimestamp(run.startedAt) ? `<time>${isoTimestamp(run.startedAt)}</time>` : ''}</metadata>`,
      `<trk><name>${xml(name)}</name><type>running</type><extensions><sprinter:activity>`,
      `<sprinter:distanceMeters>${decimal(run.distanceMeters)}</sprinter:distanceMeters><sprinter:activeSeconds>${decimal(run.activeSeconds)}</sprinter:activeSeconds>`];
    if (run.totalSeconds !== undefined && Number.isFinite(run.totalSeconds)) lines.push(`<sprinter:totalSeconds estimated="${run.totalEstimated === true}">${decimal(run.totalSeconds)}</sprinter:totalSeconds>`);
    lines.push('</sprinter:activity></extensions>');
    for (const segment of segments) {
      lines.push('<trkseg>');
      for (const point of segment) {
        const altitude = altitudes.get(point) ?? null, value = reliablePace(point, run), timestamp = isoTimestamp(point.fix.timestamp);
        lines.push(`<trkpt lat="${point.fix.latitude.toFixed(8)}" lon="${point.fix.longitude.toFixed(8)}">`);
        if (altitude !== null) lines.push(`<ele>${decimal(altitude)}</ele>`);
        if (timestamp) lines.push(`<time>${timestamp}</time>`);
        lines.push(`<extensions><sprinter:activeSeconds>${decimal(point.activeSeconds)}</sprinter:activeSeconds><sprinter:distanceMeters>${decimal(point.meters)}</sprinter:distanceMeters>`);
        if (point.totalSeconds !== undefined && Number.isFinite(point.totalSeconds)) lines.push(`<sprinter:totalSeconds>${decimal(point.totalSeconds)}</sprinter:totalSeconds>`);
        if (value !== null) lines.push(`<sprinter:paceSecondsPerKm>${decimal(value)}</sprinter:paceSecondsPerKm>`);
        lines.push('</extensions></trkpt>');
      }
      lines.push('</trkseg>');
    }
    lines.push('</trk></gpx>');
    const date = isoTimestamp(run.startedAt)?.replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z') ?? 'activity';
    const id = run.id.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 32) || 'run';
    return { filename: `sprinter-${date}-${id}.gpx`, mimeType: 'application/gpx+xml', data: lines.join('\n'), points, segments: segments.length };
  },
};
