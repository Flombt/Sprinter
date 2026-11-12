export interface HealthCapabilities {
  available: boolean; workoutWrite: 'notDetermined' | 'denied' | 'authorized'; distanceWrite: 'notDetermined' | 'denied' | 'authorized';
  liveAllowed: boolean; backupProtected: boolean;
}
export interface HealthWorkout {
  uuid: string; startedAt: number; endedAt: number; activeSeconds: number; distanceMeters: number | null;
  sourceName: string; sourceBundle: string; ownSource: boolean; originalRunId: string | null;
}
export interface HealthPage { workouts: HealthWorkout[]; deleted: string[]; anchor: string | null; hasMore: boolean }
export interface HealthWrite {
  runId: string; syncId: string; startedAt: number; endedAt: number; activeSeconds: number; totalSeconds: number; distanceMeters: number;
  pauses: { from: number; to: number }[];
}
export interface HealthReceipt { runId: string; uuid: string; syncedAt: number }
export interface ApplePreferences { version: 1; autoWrite: boolean; readRequested: boolean; liveEnabled: boolean; receipts: HealthReceipt[]; pendingRunIds?: string[] }
export const defaultApplePreferences = (): ApplePreferences => ({ version: 1, autoWrite: false, readRequested: false, liveEnabled: false, receipts: [], pendingRunIds: [] });
