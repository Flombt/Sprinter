import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { describe, expect, it } from 'vitest';
import { exportActivity } from '../src/analysis/export';
import { DEFAULT_CONFIG, DEFAULT_EXACT_TARGET, type RunRecord, type TrackPoint } from '../src/core/types';
import { parseRun } from '../src/storage/repository';

const started = Date.parse('2024-04-30T06:55:10.125Z');
const at = (seconds: number) => new Date(started + seconds * 1000).toISOString();
const point = (id: number, seconds: number, meters: number, fix: Partial<TrackPoint['fix']> = {}): TrackPoint => ({
  id, segment: 0, activeSeconds: seconds, meters, pace: null,
  fix: { latitude: 48.85, longitude: 2.35, speed: null, timestamp: started + seconds * 1000, accuracy: 3, ...fix },
});
function activity(points: TrackPoint[]): RunRecord {
  return { id: 'legacy', startedAt: started, endedAt: started + 30000, target: DEFAULT_EXACT_TARGET,
    config: DEFAULT_CONFIG, activeSeconds: 30, distanceMeters: 15, reliableSeconds: 0, inTargetSeconds: 0,
    bestPace: null, points, splits: [] };
}
const parser = new XMLParser({ ignoreAttributes: false, isArray: name => name === 'trkseg' || name === 'trkpt' });

describe('GPX activity export', () => {
  it('keeps stationary and lower-accuracy observations and separates pauses', () => {
    const run = activity([
      point(0, 0, 0, { altitude: -3.25 }),
      point(1, 1, 0),
      point(2, 2, 0, { accuracy: 40 }),
      { ...point(3, 18, 12, { longitude: 180, speed: 3.5 }), segment: 1, continuity: 'manualResume' },
      { ...point(4, 19, 15, { longitude: -0.0000001 }), segment: 1, altitude: 32 },
    ]);
    run.routeName = 'Berges & quai <Nord>';
    const before = JSON.stringify(run);
    const document = exportActivity(run);
    expect(document).toMatchObject({ points: 5, segments: 2, mimeType: 'application/gpx+xml' });
    const data = String(document.data);
    expect(XMLValidator.validate(data)).toBe(true);
    expect(data).toContain('Berges &amp; quai &lt;Nord&gt;');
    const { gpx } = parser.parse(data);
    expect(gpx['@_version']).toBe('1.1');
    expect(gpx.metadata.time).toBe(at(0));
    const [first, second] = gpx.trk.trkseg;
    expect(first.trkpt.map((p: { time: string }) => p.time)).toEqual([at(0), at(1), at(2)]);
    expect(first.trkpt[0].ele).toBe(-3.25);
    expect(first.trkpt[1].ele).toBeUndefined();
    expect(second.trkpt.map((p: Record<string, unknown>) => p['@_lon'])).toEqual(['-180', '-0.0000001']);
    expect(second.trkpt[1].ele).toBe(32);
    expect(data).not.toMatch(/<\w+:(?:cad|hr)>/);
    expect(JSON.stringify(run)).toBe(before);
  });

  it('exports legacy history without supplying missing sensor values', () => {
    const legacy = parseRun(JSON.stringify(activity([point(0, 0, 0), point(1, 1, 2)])));
    const result = exportActivity(legacy);
    expect(result.filename).toBe('sprinter-20240430T065510Z-legacy.gpx');
    const data = String(result.data);
    expect(XMLValidator.validate(data)).toBe(true);
    expect(data).not.toContain('<ele>');
    expect(data).not.toContain('<sprinter:totalSeconds');
    expect(data).not.toContain('<sprinter:speedMetersPerSecond>');
  });

  it('omits an unavailable timestamp and rejects missing geometry or an unfinished activity', () => {
    const missingTime = exportActivity(activity([point(0, 0, 0, { timestamp: NaN })]));
    expect(missingTime.points).toBe(1);
    expect(parser.parse(String(missingTime.data)).gpx.trk.trkseg[0].trkpt[0].time).toBeUndefined();
    expect(() => exportActivity(activity([]))).toThrow(/aucun point GPS/);
    expect(() => exportActivity({ ...activity([point(0, 0, 0)]), endedAt: null })).toThrow(/Terminez la course/);
  });
});
