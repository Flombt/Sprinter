import { View } from 'react-native';
import { RunRecord } from '../core/types';
import { Copy } from './components';
import { effectiveTarget } from '../workouts/definition';
import { activityAnalysis } from '../analysis/cache';
import { atDistance } from '../analysis/distanceTime';
import { SeriesChart, ChartBand } from '../analysis/SeriesChart';
import type { RunAnalysis } from '../analysis/types';

export function PaceChart({ run, analysis: supplied }: { run: RunRecord; analysis?: RunAnalysis }) {
  const analysis = supplied ?? activityAnalysis(run);
  let minimum = Infinity, maximum = -Infinity;
  for (const group of analysis.paceSeries) for (const p of group) { minimum = Math.min(minimum, p.value); maximum = Math.max(maximum, p.value); }
  if (!Number.isFinite(minimum)) return <Copy muted>Le graphique apparaîtra avec davantage de mesures fiables.</Copy>;
  const timeAt = (meters: number) => meters <= 0 ? 0 : atDistance(analysis.track, meters)?.activeSeconds ?? null;
  const bands: ChartBand[] = run.workout ? run.workout.segments.flatMap(s => {
    const target = effectiveTarget(s.planned); if (!target || s.startedAt === null) return [];
    return [{ from: s.startedAt, to: s.endedAt ?? run.workout!.lastSeconds,
      low: s.planned.paceRule === 'notSlower' ? minimum - 10 : target.fast,
      high: s.planned.paceRule === 'notFaster' ? maximum + 10 : target.slow }];
  }) : run.target.kilometerTargets ? run.target.kilometerTargets.flatMap((target, index) => {
    const from = timeAt(index * 1000); if (from === null) return [];
    return [{ from, to: timeAt(Math.min((index + 1) * 1000, run.target.distanceMeters!)) ?? run.activeSeconds, low: target.fast, high: target.slow }];
  }) : [{ from: 0, to: run.activeSeconds, low: run.target.fast, high: run.target.slow }];
  return <View style={{ gap: 8 }}><SeriesChart series={analysis.paceSeries} seconds={run.activeSeconds} kind="pace" bands={bands} />
    <Copy muted variant="small">Les zones vertes représentent les plages prévues pour chaque portion ciblée.</Copy></View>;
}
