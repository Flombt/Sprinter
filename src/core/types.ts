export interface KilometerPace { kilometer: number; fast: number; slow: number }
export interface PaceTarget {
  fast: number; slow: number; distanceMeters: number | null;
  finishSeconds?: number | null; timeBasis?: 'active' | 'total'; kilometerTargets?: KilometerPace[];
}
export interface CoachConfig {
  confirmationSeconds: number; repeatSeconds: number; hysteresisSeconds: number;
  smoothingSeconds: number; minimumWindowSeconds: number; minimumWindowMeters: number;
  maximumAccuracy: number; maximumGap: number; maximumSpeed: number; maximumSampleAge: number;
  toleranceSeconds?: number; timeWarningSeconds?: number;
}
export const DEFAULT_CONFIG: CoachConfig = {
  confirmationSeconds: 10, repeatSeconds: 30, hysteresisSeconds: 3,
  smoothingSeconds: 20, minimumWindowSeconds: 8, minimumWindowMeters: 12,
  maximumAccuracy: 25, maximumGap: 6, maximumSpeed: 12, maximumSampleAge: 10,
  toleranceSeconds: 0, timeWarningSeconds: 15,
};
export const DEFAULT_TARGET: PaceTarget = { fast: 310, slow: 320, distanceMeters: null };
export const DEFAULT_EXACT_TARGET: PaceTarget = { fast: 300, slow: 300, distanceMeters: null };
export type PaceState = 'acquiring' | 'onTarget' | 'tooFast' | 'tooSlow' | 'unreliable' | 'paused' | 'free';
export type SignalQuality = 'warmingUp' | 'good' | 'poor' | 'stale' | 'stationary' | 'paused';
export type AlertCue = 'slowDown' | 'speedUp';
export type AudioCue = AlertCue | 'transition' | 'success' | 'failure';
export interface GPSFix {
  latitude: number; longitude: number; timestamp: number; accuracy: number;
  speed: number | null; speedAccuracy?: number | null;
  altitude?: number | null; altitudeAccuracy?: number | null;
}
export interface TrackPoint {
  id: number; segment: number; fix: GPSFix; activeSeconds: number; meters: number; pace: number | null;
  altitude?: number | null;
  totalSeconds?: number;
  quality?: SignalQuality;
  distanceIntervalStart?: number;
  continuity?: 'start' | 'continuous' | 'manualResume' | 'autoResume' | 'gpsReacquisition' | 'recovery';
}
export interface Split { kilometer: number; meters: number; seconds: number; complete: boolean }
export interface RunRecord {
  healthExportRequestedAt?: number;
  unreadableSections?: Partial<Record<'workout' | 'pacing', unknown>>;
  routeId?: string; routeName?: string;
  clockPauses?: { from: number; to: number | null }[];
  healthKit?: { uuid: string; sourceName: string; sourceBundle: string; importedAt: number; originalRunId: string | null };
  targetUnavailable?: boolean;
  plannedEntryId?: string; shoeId?: string;
  dataVersion?: 3;
  id: string; startedAt: number; endedAt: number | null; target: PaceTarget; config: CoachConfig;
  activeSeconds: number; distanceMeters: number; reliableSeconds: number; inTargetSeconds: number;
  bestPace: number | null; points: TrackPoint[]; splits: Split[];
  workout?: import('../workouts/types').WorkoutSnapshot;
  workoutError?: string;
  totalSeconds?: number; totalEstimated?: boolean;
  ascentMeters?: number; descentMeters?: number; elevationReliableSeconds?: number;
  autoPauseEnabled?: boolean; autoPauseCount?: number;
  pacing?: import('../pacing/types').PacingSnapshot;
  pacingError?: string;
}
export type Appearance = 'system' | 'dark' | 'light';
export interface Settings {
  config: CoachConfig; audioEnabled: boolean; hapticsEnabled: boolean;
  backgroundEnabled: boolean; appearance: Appearance;
  autoPauseEnabled?: boolean;
  coaching?: import('../coaching/config').CoachingPreferences;
}
export const DEFAULT_SETTINGS: Settings = {
  config: { ...DEFAULT_CONFIG }, audioEnabled: false, hapticsEnabled: true,
  backgroundEnabled: false, appearance: 'dark', autoPauseEnabled: false,
};
export const STATE_LABELS: Record<PaceState, string> = {
  acquiring: 'Trouvez votre rythme', onTarget: 'Dans votre rythme', tooFast: 'Ralentissez légèrement',
  tooSlow: 'Accélérez légèrement', unreliable: 'Allure indisponible', paused: 'Course en pause', free: 'Course libre',
};
export const QUALITY_LABELS: Record<SignalQuality, string> = {
  warmingUp: 'Stabilisation GPS…', good: 'GPS précis', poor: 'Précision GPS insuffisante',
  stale: 'Signal GPS perdu', stationary: 'À l’arrêt · allure indisponible', paused: 'GPS suspendu',
};
