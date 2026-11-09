import { isoTimestamp, qualifiedAltitudes, reliablePace } from '../track';
import type { ActivityExporter } from './types';
export function csvField(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined || (typeof value === 'number' && !Number.isFinite(value))) return '';
  let s = String(value);
  if (typeof value === 'string' && /^[\s]*[=+@-]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}
export const csvExporter: ActivityExporter = {
  id: 'csv', label: 'CSV UTF-8',
  encode({ run, track }) {
    if (run.endedAt === null) throw new Error('Terminez la course avant son export.');
    const rows: (string | number | boolean | null | undefined)[][] = [[
      'rowType', 'activityId', 'source', 'startedAt', 'endedAt', 'distanceMeters', 'activeSeconds', 'totalSeconds', 'totalEstimated',
      'segment', 'pointTimestamp', 'pointActiveSeconds', 'pointTotalSeconds', 'pointDistanceMeters', 'latitude', 'longitude', 'reliableAltitudeMeters', 'reliablePaceSecondsPerKm',
    ]];
    const header = [run.id, run.healthKit?.sourceBundle ?? 'app.sprinter.running', isoTimestamp(run.startedAt), isoTimestamp(run.endedAt), run.distanceMeters, run.activeSeconds, run.totalSeconds, run.totalEstimated === true];
    rows.push(['activity', ...header, null, null, null, null, null, null, null, null, null]);
    const altitudes = qualifiedAltitudes(track);
    let count = 0;
    track.observations.forEach((segment, index) => segment.forEach(p => {
      rows.push(['point', ...header, index + 1, isoTimestamp(p.fix.timestamp), p.activeSeconds, p.totalSeconds, p.meters,
        p.fix.latitude, p.fix.longitude, altitudes.get(p), reliablePace(p, run)]); count++;
    }));
    const id = run.id.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 64);
    return { filename: `sprinter-${id}.csv`, mimeType: 'text/csv', data: '\uFEFF' + rows.map(row => row.map(csvField).join(',')).join('\r\n'), points: count, segments: track.observations.length };
  },
};
