// Accès serveur du profil personnalisé : RPC profile_*, stockage privé profile-media et
// fonction profile-media-commit (validation du type réel). Erreurs classées comme la synchronisation (§7.4).
import type { SupabaseClient } from '@supabase/supabase-js';
import { classify } from '../sync/remote';
import { SyncError } from '../sync/types';
import type { LocalMedia, OutboxItem, RemoteElement, SaveResult } from './localStore';
import type { OfficialBadge, ProfileRemote, RemoteMedia } from './sync';

export interface ProfileFiles {
  read(uri: string): Promise<Uint8Array>;
  /** Écrit un média du titulaire sur l'appareil et renvoie son adresse locale. */
  write(owner: string, id: string, mime: string, bytes: Uint8Array): Promise<string>;
}

export function supabaseProfileRemote(client: () => SupabaseClient | null, files: ProfileFiles): ProfileRemote {
  const supabase = () => {
    const value = client();
    if (!value) throw new SyncError('auth', 'no_client', undefined, 'no_client');
    return value;
  };
  const call = async <T>(name: string, args: Record<string, unknown> = {}): Promise<T> => {
    let response;
    try { response = await supabase().rpc(name, args); }
    catch (error) { throw new SyncError('network', error instanceof Error ? error.message : 'network', undefined, 'network'); }
    if (response.error) throw classify(response.error, response.status);
    return response.data as T;
  };
  return {
    async save(items: OutboxItem[]) {
      const data = await call<{ results: SaveResult[] }>('profile_save', {
        p_items: items.map((item) => ({
          key: item.key, payload: item.payload ?? {}, deleted: item.deleted, op_id: item.opId, prev_op_id: item.prevOpId,
          base_revision: item.baseRevision, client_updated_at: item.clientUpdatedAt,
        })),
      });
      return data.results;
    },
    async pull() {
      const data = await call<{ elements: RemoteElement[]; media: RemoteMedia[] }>('profile_pull');
      return { elements: data.elements ?? [], media: data.media ?? [] };
    },
    mediaBegin: (media: LocalMedia) => call<{ path: string; status: string }>('profile_media_begin', {
      p_id: media.id, p_usage: media.usage, p_mime: media.mime, p_bytes: media.bytes, p_width: media.width, p_height: media.height,
      p_animated: media.animated ?? false,
    }),
    badges: () => call<OfficialBadge[]>('profile_badges'),
    async upload(path: string, media: LocalMedia) {
      if (!media.uri) throw new SyncError('client', 'missing_file', undefined, 'missing_file');
      const bytes = await files.read(media.uri);
      let result;
      try { result = await supabase().storage.from('profile-media').upload(path, bytes, { contentType: media.mime, upsert: true }); }
      catch (error) { throw new SyncError('network', error instanceof Error ? error.message : 'network', undefined, 'network'); }
      if (result.error) {
        const status = Number((result.error as { statusCode?: string | number }).statusCode ?? 400);
        throw classify({ message: result.error.message }, Number.isFinite(status) ? status : 400);
      }
    },
    async commit(id: string) {
      let response;
      try { response = await supabase().functions.invoke('profile-media-commit', { body: { id } }); }
      catch (error) { throw new SyncError('network', error instanceof Error ? error.message : 'network', undefined, 'network'); }
      if (!response.error) return response.data as { status: 'ready' };
      const context = (response.error as { context?: Response }).context;
      const status = context?.status ?? 0;
      const body = await context?.json().catch(() => null) as { status?: string; reason?: string; error?: string } | null;
      if (status === 409) return { status: 'missing' as const };
      if (status === 422) return { status: 'rejected' as const, reason: body?.reason ?? 'format' };
      throw classify({ message: body?.error ?? response.error.message }, status);
    },
    async download(owner: string, media: RemoteMedia) {
      let result;
      try { result = await supabase().storage.from('profile-media').download(media.path); }
      catch (error) { throw new SyncError('network', error instanceof Error ? error.message : 'network', undefined, 'network'); }
      if (result.error || !result.data) throw classify({ message: result.error?.message ?? 'download' }, 400);
      return files.write(owner, media.id, media.mime, new Uint8Array(await result.data.arrayBuffer()));
    },
  };
}
