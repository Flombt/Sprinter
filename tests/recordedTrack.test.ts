import { describe, expect, it } from 'vitest';
import type { TrackPoint } from '../src/core/types';
import { RecordedTrack, recordedSegments } from '../src/ui/routeMapData';

function point(index: number, segment = 0): TrackPoint {
  return {
    id: index, segment, activeSeconds: index, meters: index * 3, pace: 333,
    fix: { latitude: 43 + index / 100000, longitude: 7, accuracy: 5, timestamp: index * 1000, speed: 3 },
  };
}

describe('cache incrémental du tracé', () => {
  it('coïncide avec le calcul complet au fil des lots et des seuils de décimation', () => {
    const track = new RecordedTrack();
    const points: TrackPoint[] = [];
    for (let index = 0; index < 6200; index++) {
      points.push(point(index, Math.floor(index / 733)));
      if (index % 83 === 0 || [1499, 1500, 2999, 3000, 5999, 6000, 6199].includes(index)) {
        expect(track.update(points)).toEqual(recordedSegments(points));
      }
    }
    const groups = track.update(points);
    expect(groups).toHaveLength(9);
    expect(groups[0]?.[0]?.latitude).toBe(points[0]?.fix.latitude);
    expect(groups[0]?.at(-1)?.latitude).toBe(points[732]?.fix.latitude);
    expect(groups.at(-1)?.at(-1)?.latitude).toBe(points.at(-1)?.fix.latitude);
  });

  it('conserve les segments terminés et réinitialise le cache avec une autre sortie', () => {
    const track = new RecordedTrack();
    const points = [point(1), point(2), point(3, 1)];
    const before = track.update(points);
    expect(track.update(points)).toBe(before);
    points.push(point(4, 1));
    const after = track.update(points);
    expect(after[0]).toBe(before[0]);
    expect(before[1]).toHaveLength(1);
    expect(after[1]).toHaveLength(2);
    expect(track.update(points, 2)).toEqual(recordedSegments(points.slice(0, 2)));
    expect(track.update([point(20)])).toEqual([[{ latitude: point(20).fix.latitude, longitude: 7 }]]);
    expect(track.update([])).toEqual([]);
  });
});
