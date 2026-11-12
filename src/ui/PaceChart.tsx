import { spacing, fontSizes } from './tokens';
import { useMemo } from 'react';
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
  const { target, workout, activeSeconds } = run;
  const bands = useMemo(() => paceBands(analysis, target, workout, activeSeconds), [analysis, target, workout, activeSeconds]);
  if (!bands) return <Copy muted>Le graphique apparaîtra avec davantage de mesures fiables.</Copy>;
  return <View style={{ gap: spacing.sm }}><SeriesChart series={analysis.paceSeries} seconds={activeSeconds} kind="pace" bands={bands} />
    <Copy muted style={{ fontSize: fontSizes.small }}>Les zones vertes représentent les plages prévues pour chaque portion ciblée.</Copy></View>;
}

function paceBands(analysis: RunAnalysis, target: RunRecord['target'], workout: RunRecord['workout'], activeSeconds: number): ChartBand[] | null {
  let minimum = Infinity, maximum = -Infinity;
  for (const group of analysis.paceSeries) for (const p of group) { minimum = Math.min(minimum, p.value); maximum = Math.max(maximum, p.value); }
  if (!Number.isFinite(minimum)) return null;
  const timeAt = (meters: number) => meters <= 0 ? 0 : atDistance(analysis.track, meters)?.activeSeconds ?? null;
  if (workout) return workout.segments.flatMap(s => {
    const target = effectiveTarget(s.planned); if (!target || s.startedAt === null) return [];
    return [{ from: s.startedAt, to: s.endedAt ?? workout.lastSeconds,
      low: s.planned.paceRule === 'notSlower' ? minimum - 10 : target.fast,
      high: s.planned.paceRule === 'notFaster' ? maximum + 10 : target.slow }];
  });
  const { kilometerTargets, distanceMeters, fast, slow } = target;
  return kilometerTargets ? kilometerTargets.flatMap((piece, index) => {
    const from = timeAt(index * 1000); if (from === null) return [];
    return [{ from, to: timeAt(Math.min((index + 1) * 1000, distanceMeters!)) ?? activeSeconds, low: piece.fast, high: piece.slow }];
  }) : [{ from: 0, to: activeSeconds, low: fast, high: slow }];
}
