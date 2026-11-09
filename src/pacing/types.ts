import type { PaceTarget } from '../core/types';
export type PaceDirection = 'tooFast' | 'tooSlow';
export type DeviationEnd = 'recovered' | 'directionChanged' | 'targetChanged' | 'gpsUnavailable' | 'paused' | 'finished' | 'restored' | 'free';
export interface PaceDeviation {
  id: number; direction: PaceDirection; context: string; target: { fast: number; slow: number };
  fromSeconds: number; toSeconds: number; fromMeters: number; toMeters: number; seconds: number;
  extremePace: number; confirmed: boolean; endReason: DeviationEnd | null;
}
export interface PacingPosition { activeSeconds: number; totalSeconds: number; meters: number; timestamp: number }
export interface PacingSnapshot {
  version: 1; reliableSeconds: number; inTargetSeconds: number; tooFastSeconds: number; tooSlowSeconds: number;
  deviationCount: number; confirmedCount: number; longestDeviationSeconds: number; omittedDeviations: number;
  legacyReliableSeconds: number; legacyOutsideSeconds: number;
  deviations: PaceDeviation[]; distanceGap: boolean; lastPosition: PacingPosition | null; completion: PacingPosition | null;
  lastTimeNoticeAt: number | null; expiredNoticeSent: boolean;
}
export interface PacePart {
  fromSeconds: number; toSeconds: number; fromMeters: number; toMeters: number;
  pace: number | null; valid: boolean; target: PaceTarget | null; context: string;
}
export interface PacingPiece { meters: number; fast: number; slow: number }
export interface PacingReference {
  meters: number; seconds: number; explicitTime: boolean; timeBasis: 'active' | 'total'; pieces: PacingPiece[];
}
export interface PacingNotice { kind: 'timeAhead' | 'timeBehind' | 'goalReached' | 'goalExpired' | 'paceRecovered'; at: number; capital: number; requiredPace: number | null }
export interface PacingProgress {
  reference: PacingReference | null; status: 'noDistance' | 'acquiring' | 'gpsUnavailable' | 'partialDistance' | 'estimatedTime' | 'paused' | 'running' | 'completed' | 'stopped';
  capitalSeconds: number | null; projectedFinishSeconds: number | null; estimatedArrival: number | null;
  requiredPace: number | null; reachable: boolean; measuredAt: number | null;
}
