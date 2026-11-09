export type Effort = 'warmup' | 'effort' | 'recovery' | 'cooldown';
export type WorkoutKind = 'survival' | 'intervals' | 'intervals1000' | 'progressive' | 'timeTrial' | 'pyramid' | 'endurance' | 'ghost' | 'personalBest' | 'regularity' | 'finalSprint' | 'custom';
export type WorkoutStatus = 'ready' | 'running' | 'paused' | 'completed' | 'abandoned';
export type ChallengeStatus = 'respected' | 'warning' | 'failed' | 'succeeded' | 'unrated';
export type PaceRule = 'range' | 'notFaster' | 'notSlower';
export interface SegmentPace { fast: number; slow: number }
export type SegmentEnd = { kind: 'distance'; value: number } | { kind: 'duration'; value: number }
  | { kind: 'inTarget'; value: number; maximumSeconds: number };
export interface WorkoutSegment {
  kind: 'segment'; id: string; name: string; effort: Effort; end: SegmentEnd;
  target: SegmentPace | null; tolerance: number; paceRule: PaceRule;
  assessment: 'none' | 'averagePace' | 'compliance'; minimumCompliance: number; maximumSeconds: number | null;
}
export interface WorkoutRepeat { kind: 'repeat'; id: string; count: number; blocks: WorkoutBlock[] }
export type WorkoutBlock = WorkoutSegment | WorkoutRepeat;
export interface GhostReference {
  runId: string; startedAt: number; distanceMeters: number; seconds: number;
  trace: { meters: number; seconds: number }[];
  source?: 'activity' | 'personalBest'; fromMeters?: number;
}
export interface ChallengeRules {
  kind: 'none' | 'survival' | 'timeTrial' | 'progression' | 'ghost' | 'personalBest' | 'regularity';
  outsideMode: 'consecutive' | 'cumulative'; allowedOutsideSeconds: number;
  warningSeconds: number; timeLimitSeconds: number | null; minimumCoverage: number;
  progressionSeconds: number; ghost: GhostReference | null;
  minimumStabilityScore?: number;
}
export interface WorkoutDefinition {
  version: 1; id: string; name: string; description: string; kind: WorkoutKind;
  createdAt: number; updatedAt: number; blocks: WorkoutBlock[]; challenge: ChallengeRules;
}
export interface PlannedSegment extends WorkoutSegment {
  key: string; index: number; repetition: number | null; repetitionCount: number | null;
  repeatKey: string | null; repetitionEnd: boolean;
}
export interface SegmentResult {
  planned: PlannedSegment; startedAt: number | null; endedAt: number | null;
  startMeters: number; endMeters: number; distanceMeters: number; trackingSeconds: number;
  reliableSeconds: number; inTargetSeconds: number; outsideSeconds: number;
  deviations: number; longestDeviation: number; outcome: 'pending' | 'succeeded' | 'failed' | 'unrated';
  reason: string | null; partial: boolean;
  hadDistanceGap: boolean;
  conditionTimedOut: boolean;
  outsideStreak: number; outsideCounted: boolean; deviationAnnounced: boolean;
  paceMoments?: PaceMoments;
}
export interface PaceMoments { seconds: number; mean: number; m2: number; observations: number }
export interface StabilityStatistics {
  score: number | null; meanPace: number | null; standardDeviation: number | null;
  seconds: number; coverage: number | null; observations: number;
}
export type CoachingKind = 'workoutStart' | 'segmentStart' | 'segmentEnd' | 'targetChanged' | 'paceDeviation'
  | 'paceRecovered' | 'transitionSoon' | 'repetitionCompleted' | 'challengeWon' | 'challengeLost' | 'workoutCompleted' | 'workoutAbandoned'
  | 'timeAhead' | 'timeBehind' | 'goalReached' | 'goalExpired' | 'challengeWarning' | 'distanceMilestone' | 'progressUpdate' | 'runCompleted' | 'routeOff' | 'routeBack';
export interface CoachingEvent {
  id: string; kind: CoachingKind; at: number; message: string; priority: number;
  segmentIndex: number; direction?: 'slowDown' | 'speedUp';
  expiresAt?: number;
}
export interface WorkoutSnapshot {
  version: 1; definition: WorkoutDefinition; status: WorkoutStatus; challengeStatus: ChallengeStatus;
  reason: string | null; currentIndex: number; segments: SegmentResult[];
  lastSeconds: number; lastMeters: number; knownPositionAt: number;
  currentDeviation: number; currentDeviationCounted: boolean; deviationAnnounced: boolean;
  conditionSeconds: number; warningSentForSegment: number; events: CoachingEvent[];
  lastIntervalEnd: number; awaitingFinalFix: boolean; distanceInterrupted: boolean;
  hadPause?: boolean;
}
export interface WorkoutInterval {
  fromSeconds: number; toSeconds: number; fromMeters: number; toMeters: number;
  pace: number | null; paceReliable: boolean;
  recordReliable?: boolean;
}
export interface WorkoutPreferences { version: 1; selected: WorkoutDefinition | null; voiceEnabled: boolean; favoriteKeys?: string[] }
export interface WorkoutStatistics {
  elapsed: number; distance: number; trackingSeconds: number; reliableSeconds: number;
  inTargetSeconds: number; outsideSeconds: number; deviations: number; longestDeviation: number;
  targetPercentage: number | null; trackingCoverage: number | null;
  stability: StabilityStatistics;
}
export const EFFORT_LABELS: Record<Effort, string> = { warmup: 'Échauffement', effort: 'Effort', recovery: 'Récupération', cooldown: 'Retour au calme' };
export const WORKOUT_STATUS: Record<WorkoutStatus, string> = { ready: 'Prête', running: 'En cours', paused: 'En pause', completed: 'Terminée', abandoned: 'Abandonnée' };
export const CHALLENGE_STATUS: Record<ChallengeStatus, string> = { respected: 'Objectif respecté', warning: 'Attention', failed: 'Défi perdu', succeeded: 'Défi réussi', unrated: 'Non évaluable' };
