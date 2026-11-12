import type { RunRecord, TrackPoint } from '../core/types';
import type { PaceDeviation } from '../pacing/types';
export interface TrackBreak { reason: 'pause' | 'gps' | 'recovery' | 'unknown' | 'invalid' | 'clock'; meters: number; activeSeconds: number }
export interface CleanTrack {
  segments: TrackPoint[][]; observations: TrackPoint[][]; breaks: TrackBreak[]; invalidPoints: number; collapsedPoints: number;
  pointCount: number; coveredDistance: number; coveredSeconds: number; hasDistanceGaps: boolean;
}
export interface SeriesPoint { seconds: number; meters: number; value: number }
export type Series = SeriesPoint[][];
export interface DistanceTime { meters: number; activeSeconds: number; totalSeconds: number | null; timestamp: number }
export interface KilometerSplit {
  kilometer: number; fromMeters: number; toMeters: number; meters: number; partial: boolean;
  activeSeconds: number | null; totalSeconds: number | null; pace: number | null; reliable: boolean; source: 'positions' | 'counter';
}
export interface DeviationSummary {
  source: 'journal' | 'reconstructed' | 'counters' | 'unavailable'; reliableSeconds: number; inTargetSeconds: number; percentage: number | null;
  count: number | null; confirmedCount: number | null; outsideSeconds: number | null; longestSeconds: number | null; items: PaceDeviation[]; omitted: number;
  partial: boolean;
}
export interface RunAnalysis {
  run: RunRecord; track: CleanTrack; mapPoints: TrackPoint[]; paceSeries: Series; speedSeries: Series; altitudeSeries: Series;
  averagePace: number | null; averageSpeed: number | null; fastestReliablePace: number | null; slowestReliablePace: number | null;
  minimumAltitude: number | null; maximumAltitude: number | null; ascent: number | null; descent: number | null; elevationSeconds: number;
  splits: KilometerSplit[]; deviations: DeviationSummary; warnings: string[];
}
export const RECORD_DISTANCES = [{ meters: 1000, label: '1 km' }, { meters: 5000, label: '5 km' }, { meters: 10000, label: '10 km' },
  { meters: 21097.5, label: 'Semi-marathon' }, { meters: 42195, label: 'Marathon' }] as const;
export interface RecordPerformance {
  runId: string; meters: number; seconds: number; activeSeconds: number; pace: number;
  fromMeters: number; toMeters: number; fromActiveSeconds: number; toActiveSeconds: number;
  startedAt: number; endedAt: number; timing: 'monotonic' | 'timestamps';
}
export interface PersonalRecord { meters: number; label: string; best: RecordPerformance | null; performances: RecordPerformance[] }
export interface RunComparison {
  equivalent: boolean; reason: string | null; commonMeters: number | null;
  a: RunAnalysis; b: RunAnalysis;
  commonA: DistanceTime | null; commonB: DistanceTime | null;
  activeDelta: number | null; totalDelta: number | null;
}
