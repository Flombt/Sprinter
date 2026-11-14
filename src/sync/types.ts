/** Contrat de synchronisation (§7.3). */
export interface PushItem {
  id: string;
  source: 'sprinter' | 'healthkit' | 'gpx';
  client_updated_at: string;
  platform: 'ios' | 'android' | null;
  app_version: string;
  tz: string | null;
  has_route: boolean;
  best_efforts: Record<string, number> | null;
  payload: Record<string, unknown>;
}
export type PushStatus = 'applied' | 'ignored_stale' | 'ignored_deleted' | 'rejected';
export interface PushResult { id: string; status: PushStatus; reason?: string; server_updated_at?: string; validity?: string; validity_reasons?: string[] }
export interface DeleteResult { id: string; status: 'deleted' | 'already_deleted' | 'rejected'; server_updated_at?: string }
export interface PulledRun {
  id: string; deleted: boolean; server_updated_at: string; client_updated_at: string; source: string; has_route: boolean;
  validity: string; validity_reasons: string[]; tz: string | null; best_efforts: Record<string, number> | null;
  payload: Record<string, unknown> | null;
}
export interface Cursor { ts: string | null; id: string | null }
export interface PullPage { items: PulledRun[]; next_cursor: { ts: string; id: string } | null }
export interface PreferencesRecord { data: Record<string, unknown>; client_updated_at: string }

export type SyncErrorKind = 'network' | 'auth' | 'rate' | 'client' | 'server';
export class SyncError extends Error {
  constructor(public kind: SyncErrorKind, message: string, public retryAfterMs?: number, public code?: string) { super(message); }
}

export interface SyncRemote {
  pushRuns(items: PushItem[]): Promise<PushResult[]>;
  deleteRuns(ids: string[]): Promise<DeleteResult[]>;
  pull(cursor: Cursor, limit: number): Promise<PullPage>;
  listIds(after: string | null, limit: number): Promise<{ ids: string[]; next: string | null }>;
  pushPreferences(data: Record<string, unknown>, clientUpdatedAt: string): Promise<{ status: 'applied' | 'ignored_stale'; data: Record<string, unknown>; client_updated_at: string }>;
  getPreferences(): Promise<PreferencesRecord | null>;
  reportSync(status: 'ok' | 'partial' | 'error', code: string | null): Promise<void>;
  /** Choix de sauvegarde confirmés par le serveur : vrai, faux, ou null si jamais exprimé. */
  backupChoices(): Promise<{ runs: boolean | null; routes: boolean | null }>;
}

export type BackupState = 'unset' | 'on' | 'off' | 'pending_on' | 'pending_off';

export interface SyncStatus {
  phase: 'disabled' | 'idle' | 'running' | 'offline' | 'paused' | 'reauth' | 'bound_other' | 'error';
  backup: BackupState;
  /** Sauvegarde des parcours GPS confirmée par le serveur (§8.1). */
  routes: 'unset' | 'on' | 'off';
  lastSuccessAt: number | null;
  pending: number;
  blocked: number;
  /** Courses synchronisées absentes du serveur au-delà du seuil : choix explicite attendu (§7.7). */
  deletedElsewhere: string[];
  importing: boolean;
  message: string | null;
}
