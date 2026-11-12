import { sanitizeConfig } from '../../core/coach';
import type { RunRecord, TrackPoint } from '../../core/types';
import { isoTimestamp, reliablePace } from '../track';
import type { ActivityExporter } from './types';

const xml = (value: string) => value
  .replace(/[^\u0009\u000A\u000D\u0020-\uD7FF\uE000-\uFFFD\u{10000}-\u{10FFFF}]/gu, '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

export function gpxDecimal(value: number): string {
  const text = String(value);
  if (!text.includes('e')) return text;
  const [mantissa, exponent] = text.split('e') as [string, string];
  const sign = mantissa.startsWith('-') ? '-' : '';
  const [whole, fraction = ''] = (sign ? mantissa.slice(1) : mantissa).split('.') as [string, string?];
  const digits = whole + fraction, position = whole.length + Number(exponent);
  if (position <= 0) return sign + '0.' + '0'.repeat(-position) + digits;
  if (position >= digits.length) return sign + digits + '0'.repeat(position - digits.length);
  return sign + digits.slice(0, position) + '.' + digits.slice(position);
}

export const gpxLongitude = (longitude: number) => longitude === 180 ? -180 : longitude;
const isNumber = (value: number | null | undefined): value is number => typeof value === 'number' && Number.isFinite(value);
const nonnegative = (value: number | null | undefined) => isNumber(value) && value >= 0 ? value : undefined;

function gpxTime(value: number): string | null {
  const time = isoTimestamp(value);
  return time && /^[0-9]{4}-/.test(time) && !time.startsWith('0000-') ? time : null;
}

/** Export the stored observations in order, including stationary and low-accuracy fixes. */
export function gpxTrackSegments(run: RunRecord): TrackPoint[][] {
  const segments: TrackPoint[][] = [];
  const maximumGap = sanitizeConfig(run.config).maximumGap * 1000;
  let previous: TrackPoint | undefined;
  for (const point of run.points) {
    const fix = point?.fix;
    if (!fix || !isNumber(fix.latitude) || Math.abs(fix.latitude) > 90 || !isNumber(fix.longitude) || Math.abs(fix.longitude) > 180) {
      previous = undefined;
      continue;
    }
    const elapsed = previous ? fix.timestamp - previous.fix.timestamp : 0;
    if (!previous || point.segment !== previous.segment || (point.continuity && point.continuity !== 'continuous') ||
      (Number.isFinite(elapsed) && (elapsed <= 0 || elapsed > maximumGap))) {
      segments.push([]);
    }
    segments.at(-1)!.push(point);
    previous = point;
  }
  return segments;
}

function metadataBounds(segments: TrackPoint[][]) {
  let minLat = Infinity, minLon = Infinity, maxLat = -Infinity, maxLon = -Infinity;
  for (const segment of segments) for (const { fix } of segment) {
    const lon = gpxLongitude(fix.longitude);
    minLat = Math.min(minLat, fix.latitude); maxLat = Math.max(maxLat, fix.latitude);
    minLon = Math.min(minLon, lon); maxLon = Math.max(maxLon, lon);
  }
  return '<bounds minlat="' + gpxDecimal(minLat) + '" minlon="' + gpxDecimal(minLon) +
    '" maxlat="' + gpxDecimal(maxLat) + '" maxlon="' + gpxDecimal(maxLon) + '"/>';
}

function metric(name: string, value: number | null | undefined, attributes = '') {
  return isNumber(value) ? '<sprinter:' + name + attributes + '>' + gpxDecimal(value) + '</sprinter:' + name + '>' : '';
}

function trackPoint(point: TrackPoint, run: RunRecord): string {
  const { fix } = point;
  const altitude = isNumber(fix.altitude) ? fix.altitude : point.altitude;
  const time = gpxTime(fix.timestamp);
  const extensions = [
    metric('activeSeconds', point.activeSeconds), metric('distanceMeters', point.meters),
    metric('totalSeconds', point.totalSeconds), metric('paceSecondsPerKm', reliablePace(point, run)),
    metric('speedMetersPerSecond', nonnegative(fix.speed)), metric('accuracyMeters', nonnegative(fix.accuracy)),
    metric('speedAccuracyMetersPerSecond', nonnegative(fix.speedAccuracy)),
    metric('verticalAccuracyMeters', nonnegative(fix.altitudeAccuracy)),
  ].join('');
  return '<trkpt lat="' + gpxDecimal(fix.latitude) + '" lon="' + gpxDecimal(gpxLongitude(fix.longitude)) + '">' +
    (isNumber(altitude) ? '<ele>' + gpxDecimal(altitude) + '</ele>' : '') +
    (time ? '<time>' + time + '</time>' : '') +
    (extensions ? '<extensions>' + extensions + '</extensions>' : '') + '</trkpt>';
}

export const gpxExporter: ActivityExporter = {
  id: 'gpx', label: 'GPX 1.1',
  encode({ run }) {
    if (run.endedAt === null) throw new Error('Terminez la course avant d’exporter son parcours.');
    const segments = gpxTrackSegments(run);
    if (!segments.length) throw new Error('Cette sortie ne contient aucun point GPS exportable.');
    const startedAt = gpxTime(run.startedAt);
    const endedAt = gpxTime(run.endedAt);
    const name = xml(startedAt ? 'Sprinter · ' + new Date(run.startedAt).toLocaleDateString('fr-FR') : 'Sprinter');
    const lines = ['<?xml version="1.0" encoding="UTF-8"?>',
      '<gpx version="1.1" creator="Sprinter" xmlns="http://www.topografix.com/GPX/1/1" xmlns:sprinter="urn:sprinter:activity:1">',
      '<metadata><name>' + name + '</name><desc>Course à pied enregistrée dans Sprinter.</desc>' +
        (startedAt ? '<time>' + startedAt + '</time>' : '') + metadataBounds(segments) + '</metadata>',
      '<trk><name>' + name + '</name><type>running</type><extensions><sprinter:activity>',
      metric('distanceMeters', run.distanceMeters), metric('activeSeconds', run.activeSeconds),
      metric('totalSeconds', run.totalSeconds, ' estimated="' + (run.totalEstimated === true) + '"'),
      metric('ascentMeters', run.ascentMeters), metric('descentMeters', run.descentMeters),
      metric('reliableSeconds', run.reliableSeconds), metric('inTargetSeconds', run.inTargetSeconds),
      metric('autoPauseCount', run.autoPauseCount),
    ];
    if (endedAt) lines.push('<sprinter:endedAt>' + endedAt + '</sprinter:endedAt>');
    if (run.routeName) lines.push('<sprinter:routeName>' + xml(run.routeName) + '</sprinter:routeName>');
    if (run.workout?.definition.name) lines.push('<sprinter:workoutName>' + xml(run.workout.definition.name) + '</sprinter:workoutName>');
    lines.push('</sprinter:activity></extensions>');
    let points = 0;
    for (const segment of segments) {
      lines.push('<trkseg>');
      for (const point of segment) lines.push(trackPoint(point, run));
      lines.push('</trkseg>');
      points += segment.length;
    }
    lines.push('</trk></gpx>');
    const date = startedAt?.replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z') ?? 'activity';
    const id = run.id.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 32) || 'run';
    return { filename: 'sprinter-' + date + '-' + id + '.gpx', mimeType: 'application/gpx+xml', data: lines.filter(Boolean).join('\n'), points, segments: segments.length };
  },
};
