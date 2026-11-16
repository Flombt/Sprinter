import type { RunRecord } from '../core/types';
import { aggregate, periodComparison } from './aggregates';
import { addDays, addMonths, calendarDays, dateOf, dayKey, dayStart } from './dates';

export type DashboardPeriod = 'week' | 'month' | 'year';

function yearComparison(history: RunRecord[], now: number) {
  const today = dayKey(now);
  const start = dayKey(new Date(dateOf(today).getFullYear(), 0, 1));
  const previous = addMonths(start, -12);
  const matched = dateOf(addDays(previous, calendarDays(start, today)));
  const time = new Date(now);
  matched.setHours(time.getHours(), time.getMinutes(), time.getSeconds(), time.getMilliseconds());
  return {
    start,
    total: aggregate(history, dayStart(start), now + 1, now),
    previous: aggregate(history, dayStart(previous), Math.min(dayStart(start), matched.getTime() + 1), now),
  };
}

/** Totals, detail buckets and latest entry all use the same period and completed outings. */
function comparableTotals(history: RunRecord[], kind: DashboardPeriod, now: number) {
  if (kind === 'year') return yearComparison(history, now);
  const { current, a, b } = periodComparison(history, dayKey(now), kind, now);
  return { start: current.start, total: a, previous: b };
}

export function distanceDashboard(history: RunRecord[], kind: DashboardPeriod, now: number) {
  const { start, total, previous } = comparableTotals(history, kind, now);
  const bins =
    kind === 'week'
      ? Array.from({ length: 7 }, (_, index) => {
          const day = addDays(start, index);
          return {
            start: day,
            end: addDays(day, 1),
            label: dateOf(day).toLocaleDateString('fr-FR', { weekday: 'short' }),
            description: dateOf(day).toLocaleDateString('fr-FR', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            }),
          };
        })
      : kind === 'month'
        ? [0, 7, 14, 21].map((offset, index) => {
            const end = index < 3 ? addDays(start, offset + 7) : addMonths(start, 1);
            const range = String(offset + 1) + '–' + dateOf(addDays(end, -1)).getDate();
            return { start: addDays(start, offset), end, label: range, description: 'Jours ' + range };
          })
        : [0, 3, 6, 9].map((offset, index) => ({
            start: addMonths(start, offset),
            end: addMonths(start, offset + 3),
            label: ['Jan–mar', 'Avr–jun', 'Jul–sep', 'Oct–déc'][index]!,
            description: 'Trimestre ' + (index + 1),
          }));
  const buckets = bins.map((bin) => ({ ...bin, meters: 0 }));
  let latest: RunRecord | undefined;
  for (const run of total.runs) {
    const day = dayKey(run.startedAt);
    const bucket = buckets.find(({ start, end }) => day >= start && day < end);
    if (bucket) bucket.meters += run.distanceMeters;
    if (!latest || run.startedAt > latest.startedAt) latest = run;
  }
  return { total, previous, latest, bins: buckets };
}
