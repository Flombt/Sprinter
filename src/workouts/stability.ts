import type { PaceMoments, SegmentResult, StabilityStatistics } from './types';

export const emptyPaceMoments = (): PaceMoments => ({ seconds: 0, mean: 0, m2: 0, observations: 0 });
/** Time-weighted Welford accumulator: GPS callback frequency does not weight the score. */
export function addPaceObservation(moments: PaceMoments, pace: number, seconds: number): void {
  if (!Number.isFinite(pace) || pace <= 0 || !Number.isFinite(seconds) || seconds <= 0) return;
  const total = moments.seconds + seconds, delta = pace - moments.mean;
  moments.mean += delta * seconds / total;
  moments.m2 = Math.max(0, moments.m2 + seconds * delta * (pace - moments.mean));
  moments.seconds = total; moments.observations++;
}
export function validPaceMoments(value: PaceMoments): boolean {
  return !!value && [value.seconds, value.mean, value.m2, value.observations].every(n => Number.isFinite(n) && n >= 0) &&
    Number.isInteger(value.observations) && (value.seconds === 0 ? value.mean === 0 && value.m2 === 0 && value.observations === 0 : value.mean > 0 && value.observations > 0);
}
/** Only effort blocks are combined; warm-up, recoveries and cooldown never lower the score. */
export function stabilityStatistics(segments: SegmentResult[], lastSeconds: number): StabilityStatistics {
  const total = emptyPaceMoments(); let elapsed = 0;
  for (const segment of segments) {
    if (segment.planned.effort !== 'effort' || segment.startedAt === null) continue;
    elapsed += Math.max(0, (segment.endedAt ?? lastSeconds) - segment.startedAt);
    const part = segment.paceMoments;
    if (!part || !validPaceMoments(part) || !part.seconds) continue;
    const seconds = total.seconds + part.seconds, delta = part.mean - total.mean;
    total.m2 += part.m2 + delta * delta * total.seconds * part.seconds / seconds;
    total.mean += delta * part.seconds / seconds;
    total.seconds = seconds; total.observations += part.observations;
  }
  const enough = total.seconds >= 30 && total.observations >= 5;
  const deviation = enough ? Math.sqrt(Math.max(0, total.m2 / total.seconds)) : null;
  return { score: deviation !== null ? Math.max(0, Math.min(100, 100 * (1 - 4 * deviation / total.mean))) : null,
    meanPace: enough ? total.mean : null, standardDeviation: deviation, seconds: total.seconds,
    coverage: elapsed > 0 ? Math.min(1, total.seconds / elapsed) : null, observations: total.observations };
}
