import type { SupabaseClient } from '@supabase/supabase-js';
import { SyncError, type SyncRemote } from './types';
import type { DocumentRemote } from './documents';

/** Adaptateur RPC Supabase du moteur de synchronisation, avec classement des erreurs (§7.4). */
export function classify(error: { message?: string; code?: string } | null, status: number): SyncError {
  const message = error?.message ?? 'unknown';
  const code = (error?.code || '').toLowerCase() || undefined;
  if (status === 0 || /network|fetch|timeout|abort/i.test(message)) return new SyncError('network', message, undefined, 'network');
  // Fonction coupée par Flo (flag côté serveur) : pause, sans bloquer les éléments en attente.
  if (/sync_disabled/.test(message)) return new SyncError('rate', message, 30 * 60_000, 'sync_disabled');
  if (status === 401 || code === 'pgrst301' || code === '28000' || code === '42501' || status === 403) return new SyncError('auth', message, undefined, 'auth');
  if (status === 429) return new SyncError('rate', message, 60_000, 'rate_limited');
  if (status >= 500) return new SyncError('server', message, undefined, `server_${status}`);
  return new SyncError('client', message, undefined, code ? `client_${code}` : `client_${status}`);
}

export function supabaseSyncRemote(client: () => SupabaseClient | null, deviceId: () => Promise<string>): SyncRemote {
  const call = async <T>(name: string, args: Record<string, unknown> = {}): Promise<T> => {
    const supabase = client();
    if (!supabase) throw new SyncError('auth', 'no_client', undefined, 'no_client');
    let response;
    try { response = await supabase.rpc(name, args); }
    catch (error) { throw new SyncError('network', error instanceof Error ? error.message : 'network', undefined, 'network'); }
    if (response.error) throw classify(response.error, response.status);
    return response.data as T;
  };
  return {
    pushRuns: (items) => call('sync_push_runs', { p_runs: items }),
    deleteRuns: (ids) => call('sync_delete_runs', { p_ids: ids }),
    pull: (cursor, limit) => call('sync_pull', { p_after_ts: cursor.ts, p_after_id: cursor.id, p_limit: limit }),
    listIds: (after, limit) => call('sync_list_ids', { p_after: after, p_limit: limit }),
    pushPreferences: (data, at) => call('sync_push_preferences', { p_data: data, p_client_updated_at: at }),
    getPreferences: () => call('sync_get_preferences'),
    async reportSync(status, code) { await call('report_sync', { p_device_id: await deviceId(), p_status: status, p_error_code: code }); },
    async backupChoices() {
      const consents = await call<Record<string, { granted: boolean } | null>>('my_consents');
      const value = (purpose: string) => (consents?.[purpose] ? consents[purpose]!.granted : null);
      return { runs: value('cloud_sync_runs'), routes: value('cloud_sync_routes') };
    },
  };
}

export function supabaseDocumentRemote(client: () => SupabaseClient | null): DocumentRemote {
  const call = async <T>(name: string, args: Record<string, unknown>): Promise<T> => {
    const supabase = client();
    if (!supabase) throw new SyncError('auth', 'no_client', undefined, 'no_client');
    let response;
    try { response = await supabase.rpc(name, args); }
    catch (error) { throw new SyncError('network', error instanceof Error ? error.message : 'network', undefined, 'network'); }
    if (response.error) throw classify(response.error, response.status);
    return response.data as T;
  };
  return {
    push: (docs) => call('sync_push_documents', { p_docs: docs }),
    pull: (cursor, limit) => call('sync_pull_documents', { p_after_ts: cursor.ts, p_after_kind: cursor.kind, p_after_id: cursor.id, p_limit: limit }),
  };
}
