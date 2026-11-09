import type { PaceTarget, RunRecord, TrackPoint } from '../core/types';
import { sanitizeConfig } from '../core/coach';
import { PacingEngine, validPacingSnapshot } from '../pacing/engine';
import { paceTargetAt } from '../pacing/goals';
import { effectiveTarget } from '../workouts/definition';
import { cleanTrack, qualifiedAltitudes, reliablePace } from './track';
import { kilometerSplits } from './distanceTime';
import type { CleanTrack, DeviationSummary, RunAnalysis, Series, SeriesPoint } from './types';

function measuredSeries(track: CleanTrack, value: (p: TrackPoint) => number | null, maximumGap: number, maximumRate?: number): Series {
  const result: Series = [];
  for (const segment of track.observations) {
    let group: SeriesPoint[] = [];
    const flush = () => { if (group.length) result.push(group); group = []; };
    for (const p of segment) {
      const measured = value(p), previous = group.at(-1);
      if (measured === null || !Number.isFinite(measured)) { flush(); continue; }
      const dt = previous ? p.activeSeconds - previous.seconds : 0;
      if (previous && (dt <= 0 || dt > maximumGap || (maximumRate !== undefined && Math.abs(measured - previous.value) / dt > maximumRate))) flush();
      group.push({ seconds: p.activeSeconds, meters: p.meters, value: measured });
    }
    flush();
  }
  return result;
}
function deviations(run: RunRecord, track: CleanTrack): DeviationSummary {
  if (run.targetUnavailable) return { source: 'unavailable', reliableSeconds: 0, inTargetSeconds: 0, percentage: null,
    count: null, confirmedCount: null, outsideSeconds: null, longestSeconds: null, items: [], omitted: 0, partial: false };
  const stored = run.pacing;
  if (stored && validPacingSnapshot(stored) && track.invalidPoints === 0) return {
    source: 'journal', reliableSeconds: stored.reliableSeconds, inTargetSeconds: stored.inTargetSeconds,
    percentage: stored.reliableSeconds > 0 ? stored.inTargetSeconds / stored.reliableSeconds * 100 : null,
    count: stored.deviationCount, confirmedCount: stored.confirmedCount,
    outsideSeconds: stored.tooFastSeconds + stored.tooSlowSeconds + stored.legacyOutsideSeconds,
    longestSeconds: stored.longestDeviationSeconds, items: stored.deviations, omitted: stored.omittedDeviations, partial: stored.legacyOutsideSeconds > 0,
  };
  if (!track.pointCount && run.reliableSeconds > 0 && run.inTargetSeconds >= 0 && run.inTargetSeconds <= run.reliableSeconds && run.reliableSeconds <= run.activeSeconds + .01) return {
    source: 'counters', reliableSeconds: run.reliableSeconds, inTargetSeconds: run.inTargetSeconds, percentage: run.inTargetSeconds / run.reliableSeconds * 100,
    count: null, confirmedCount: null, outsideSeconds: run.reliableSeconds - run.inTargetSeconds, longestSeconds: null, items: [], omitted: 0, partial: true,
  };
  const ledger = new PacingEngine({ ...run, pacing: undefined, points: [], reliableSeconds: 0, inTargetSeconds: 0 }, sanitizeConfig(run.config));
  for (const segment of track.observations) {
    ledger.interrupt('gpsUnavailable');
    for (let i = 1; i < segment.length; i++) {
      const a = segment[i - 1]!, b = segment[i]!, elapsed = b.activeSeconds - a.activeSeconds, value = reliablePace(b, run);
      if (elapsed <= 0) continue;
      const at = (t: number) => a.meters + (b.meters - a.meters) * (t - a.activeSeconds) / elapsed;
      const accept = (from: number, to: number, target: PaceTarget | null, context: string, valid: boolean) => ledger.accept({
        fromSeconds: from, toSeconds: to, fromMeters: at(from), toMeters: at(to), pace: value, target, context, valid });
      if (run.workout) {
        for (const phase of run.workout.segments) {
          if (phase.startedAt === null) break;
          const from = Math.max(a.activeSeconds, phase.startedAt), to = Math.min(b.activeSeconds, phase.endedAt ?? run.activeSeconds);
          if (to <= from) continue;
          const target = effectiveTarget(phase.planned);
          accept(from, to, target ? { ...target, distanceMeters: null } : null, `Segment ${phase.planned.index + 1} · ${phase.planned.name}`, value !== null && from >= phase.startedAt + 8);
        }
      } else {
        const cuts = [a.activeSeconds, b.activeSeconds];
        if (run.target.kilometerTargets && b.meters > a.meters) {
          for (let meters = (Math.floor(a.meters / 1000) + 1) * 1000; meters < b.meters; meters += 1000) cuts.push(a.activeSeconds + (meters - a.meters) / (b.meters - a.meters) * elapsed);
          const end = run.target.distanceMeters!;
          if (a.meters < end && end < b.meters) cuts.push(a.activeSeconds + (end - a.meters) / (b.meters - a.meters) * elapsed);
        }
        cuts.sort((x, y) => x - y);
        const initial = paceTargetAt(run.target, a.meters);
        for (let j = 1; j < cuts.length; j++) {
          const from = cuts[j - 1]!, to = cuts[j]!, meters = at((from + to) / 2), target = paceTargetAt(run.target, meters);
          accept(from, to, target, run.target.kilometerTargets ? `Kilomètre ${Math.floor((meters + 1e-7) / 1000) + 1}` : 'Plage de la sortie',
            value !== null && target?.fast === initial?.fast && target?.slow === initial?.slow);
        }
      }
      ledger.drainNotices();
    }
  }
  const result = ledger.finalized();
  return { source: result.reliableSeconds > 0 ? 'reconstructed' : 'unavailable', reliableSeconds: result.reliableSeconds, inTargetSeconds: result.inTargetSeconds,
    percentage: result.reliableSeconds > 0 ? result.inTargetSeconds / result.reliableSeconds * 100 : null, count: result.reliableSeconds > 0 ? result.deviationCount : null, confirmedCount: result.reliableSeconds > 0 ? result.confirmedCount : null,
    outsideSeconds: result.reliableSeconds > 0 ? result.tooFastSeconds + result.tooSlowSeconds : null, longestSeconds: result.reliableSeconds > 0 ? result.longestDeviationSeconds : null, items: result.deviations,
    omitted: result.omittedDeviations, partial: track.hasDistanceGaps };
}
function elevation(run: RunRecord, track: CleanTrack, series: Series) {
  const stored = track.invalidPoints === 0 && (run.elevationReliableSeconds ?? 0) > 0 &&
    Number.isFinite(run.ascentMeters) && Number.isFinite(run.descentMeters) && run.ascentMeters! >= 0 && run.descentMeters! >= 0;
  let ascent = 0, descent = 0, seconds = 0;
  for (const group of series) {
    let anchor = group[0]!.value;
    for (let i = 1; i < group.length; i++) {
      const a = group[i - 1]!, b = group[i]!; seconds += b.seconds - a.seconds;
      if (b.meters - a.meters < .2) { anchor = b.value; continue; }
      const change = b.value - anchor;
      if (Math.abs(change) >= 3) { ascent += Math.max(0, change); descent += Math.max(0, -change); anchor = b.value; }
    }
  }
  const hasData = series.some(s => s.length >= 2);
  return { ascent: stored ? run.ascentMeters! : hasData ? ascent : null, descent: stored ? run.descentMeters! : hasData ? descent : null,
    seconds: stored ? Math.min(run.activeSeconds, run.elevationReliableSeconds!) : seconds };
}
/** Derived values retain their provenance; missing observations remain unavailable. */
export function analyzeRun(run: RunRecord): RunAnalysis {
  const config = sanitizeConfig(run.config), track = cleanTrack(run);
  const paceSeries = measuredSeries(track, p => reliablePace(p, run), config.maximumGap);
  const speedSeries = paceSeries.map(s => s.map(p => ({ ...p, value: 3600 / p.value })));
  const heightsByPoint = qualifiedAltitudes(track);
  const altitudeSeries = measuredSeries(track, p => heightsByPoint.get(p) ?? null, Math.min(6, config.maximumGap));
  let fastest: number | null = null, slowest: number | null = null, low: number | null = null, high: number | null = null;
  for (const group of paceSeries) for (const p of group) { fastest = Math.min(fastest ?? p.value, p.value); slowest = Math.max(slowest ?? p.value, p.value); }
  for (const group of altitudeSeries) for (const p of group) { low = Math.min(low ?? p.value, p.value); high = Math.max(high ?? p.value, p.value); }
  const heights = elevation(run, track, altitudeSeries), warnings: string[] = [];
  if (track.hasDistanceGaps) warnings.push('Le parcours comporte des portions manquantes ou de continuité inconnue. La moyenne utilise la distance enregistrée ; les records ne traversent pas ces interruptions.');
  if (track.invalidPoints > 0) warnings.push(`${track.invalidPoints} point(s) ou liaison(s) incohérent(s) écarté(s) de l’analyse.`);
  if (!track.pointCount) warnings.push('Parcours GPS indisponible : les compteurs enregistrés restent visibles, sans qualification de record.');
  if (run.totalSeconds === undefined) warnings.push('Temps total non enregistré dans cette ancienne activité.');
  if (run.totalEstimated) warnings.push('Le temps total comporte une estimation après récupération. Les comparaisons de temps total sont désactivées.');
  const mapPoints = track.segments.flatMap((segment, index) => segment.map(p => ({ ...p, segment: index })));
  return { run, track, mapPoints, paceSeries, speedSeries, altitudeSeries,
    averagePace: run.distanceMeters > 0 && run.activeSeconds > 0 ? run.activeSeconds / run.distanceMeters * 1000 : null,
    averageSpeed: run.activeSeconds > 0 ? run.distanceMeters / run.activeSeconds * 3.6 : null,
    fastestReliablePace: fastest, slowestReliablePace: slowest, minimumAltitude: low, maximumAltitude: high,
    ascent: heights.ascent, descent: heights.descent, elevationSeconds: heights.seconds, splits: kilometerSplits(run, track), deviations: deviations(run, track), warnings };
}
