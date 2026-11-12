import { expect, it } from 'vitest';
import { paceRoute } from '../src/analysis/paceRoute';
import { DEFAULT_CONFIG, DEFAULT_EXACT_TARGET, type TrackPoint } from '../src/core/types';
import { RunEngine } from '../src/core/engine';

const point = (id: number, segment: number, pace: number | null): TrackPoint => ({
  id, segment, pace, activeSeconds: id, meters: id * 3,
  fix: { latitude: 48, longitude: 2 + id / 10000, timestamp: 1700000000000 + id * 1000, accuracy: 3, speed: null },
});

it('colors measured zones and keeps GPS breaks separate', () => {
  const run = new RunEngine(DEFAULT_EXACT_TARGET, DEFAULT_CONFIG).record;
  const points = [point(1, 0, null), point(2, 0, 300.49), point(3, 0, 299),
    point(4, 1, 290), point(5, 1, 301), point(6, 1, null)];
  const parts = paceRoute(run, points);
  expect(parts.map(part => part.zone)).toEqual(['onTarget', 'tooFast', 'tooSlow', 'unknown']);
  expect(parts.map(part => part.points.map(item => item.longitude))).toEqual([
    [points[0]!.fix.longitude, points[1]!.fix.longitude], [points[1]!.fix.longitude, points[2]!.fix.longitude],
    [points[3]!.fix.longitude, points[4]!.fix.longitude], [points[4]!.fix.longitude, points[5]!.fix.longitude],
  ]);
  expect(paceRoute({ ...run, targetUnavailable: true }, points)).toEqual([]);
});
