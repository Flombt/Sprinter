import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG, DEFAULT_TARGET, type RunRecord } from '../src/core/types';
import { distanceDashboard, type DashboardPeriod } from '../src/progression/distanceDashboard';

function outing(
  id: string,
  startedAt: number,
  distanceMeters: number,
  endedAt: number | null = startedAt + 1_000,
): RunRecord {
  return {
    id,
    startedAt,
    endedAt,
    distanceMeters,
    target: DEFAULT_TARGET,
    config: DEFAULT_CONFIG,
    activeSeconds: 1,
    reliableSeconds: 0,
    inTargetSeconds: 0,
    bestPace: null,
    splits: [],
    points: [],
  };
}
const at = (year: number, month: number, day: number, hour = 9) =>
  new Date(year, month - 1, day, hour).getTime();

describe('distance du tableau de bord', () => {
  const now = at(2026, 1, 2, 12);
  const history = [
    outing('live', at(2026, 1, 2, 11), 500, null),
    outing('incomplete-at-now', at(2026, 1, 2, 11), 900, at(2026, 1, 2, 13)),
    outing('old year, same week', at(2025, 12, 31), 3100),
    outing('new year', at(2026, 1, 1), 1000),
    outing('today', at(2026, 1, 2, 10), 2000),
    outing('tomorrow', at(2026, 1, 3), 4000),
  ];

  it.each<[DashboardPeriod, number, number[]]>([
    ['week', 6100, [0, 0, 3100, 1000, 2000, 0, 0]],
    ['month', 3000, [3000, 0, 0, 0]],
    ['year', 3000, [3000, 0, 0, 0]],
  ])(
    '%s uses consistent totals, buckets and last completed outing across New Year',
    (period, total, bins) => {
      const board = distanceDashboard(history, period, now);
      expect(board.total.meters).toBe(total);
      expect(board.bins.map((bin) => bin.meters)).toEqual(bins);
      expect(board.latest?.id).toBe('today');
      expect(board.total.activeDays).toBe(period === 'week' ? 3 : 2);
    },
  );

  it('uses elapsed local time for comparison and covers the final days of a long month', () => {
    const now = at(2026, 3, 31, 12);
    const activities = [
      outing('end of March', at(2026, 3, 31, 8), 4000),
      outing('end of February', at(2026, 2, 28), 2500),
      outing('before elapsed time last year', at(2025, 3, 31, 10), 3000),
      outing('after elapsed time last year', at(2025, 3, 31, 13), 9000),
    ];
    const month = distanceDashboard(activities, 'month', now);
    expect(month.bins.at(-1)).toMatchObject({ description: 'Jours 22–31', meters: 4000 });
    expect(month.previous.meters).toBe(2500);
    expect(distanceDashboard(activities, 'year', now).previous.meters).toBe(3000);
  });
});
