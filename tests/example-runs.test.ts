import { describe, expect, it } from 'vitest';
import { activityAnalysis } from '../src/analysis/cache';
import { runRecords } from '../src/analysis/records';
import { exampleRuns } from '../src/progression/exampleRuns';

describe('sample activities', () => {
  it.each(exampleRuns)('$title has a continuous track and all three short passages', ({ run }) => {
    const analysis = activityAnalysis(run);
    expect(analysis.track.hasDistanceGaps).toBe(false);
    expect(analysis.mapPoints.length).toBeGreaterThan(2);
    expect(analysis.track.coveredDistance).toBeCloseTo(run.distanceMeters);
    expect(
      runRecords(run)
        .filter((record) => record.meters <= 500)
        .map((record) => record.meters),
    ).toEqual([100, 200, 500]);
  });
});
