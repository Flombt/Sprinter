// POST /functions/v1/profile-media-commit { id } — valide un média du profil que le titulaire vient de déposer.
// La réservation est lue avec le jeton de l'utilisateur (RLS, session active, coupure serveur) ; le fichier
// est lu avec le rôle service, sans jamais être renvoyé. Réponses : ready · missing (réessayer) · rejected.
import { UUID } from '../_shared/auth.ts';
import { bearer, json, logEvent } from '../_shared/http.ts';
import { commitProfileMedia, type PendingMedia } from '../_shared/profileMedia.ts';
import { serverClient, userClient } from '../_shared/supabase.ts';

Deno.serve(async (request) => {
  if (request.method !== 'POST') return json(405, { error: 'method_not_allowed' });
  const token = bearer(request);
  if (!token) return json(401, { error: 'unauthenticated' });
  const body = await request.json().catch(() => null) as { id?: unknown } | null;
  const id = typeof body?.id === 'string' ? body.id.toLowerCase() : '';
  if (!UUID.test(id)) return json(400, { error: 'invalid_parameter:id' });
  try {
    const service = serverClient();
    const { data: auth, error: authError } = await service.auth.getUser(token);
    if (authError || !auth.user) return json(401, { error: 'unauthenticated' });
    const userId = auth.user.id;
    const user = userClient(token);
    const result = await commitProfileMedia({
      async pending(mediaId) {
        const { data, error } = await user.rpc('profile_media_pending', { p_id: mediaId });
        if (error) throw new Error(error.message === 'feature_disabled' ? 'feature_disabled' : 'forbidden');
        return (data ?? null) as PendingMedia | null;
      },
      async download(path) {
        const { data, error } = await service.storage.from('profile-media').download(path);
        if (error || !data) return null;
        return new Uint8Array(await data.arrayBuffer());
      },
      async result(mediaId, verdict) {
        const { data, error } = await service.rpc('service_profile_media_result', {
          p_user: userId, p_id: mediaId, p_ok: verdict.ok, p_mime: verdict.mime, p_bytes: verdict.bytes, p_width: verdict.width,
          p_height: verdict.height, p_animated: verdict.animated, p_duration_ms: verdict.durationMs, p_reason: verdict.reason,
        });
        if (error) throw new Error('result');
        return data as { status: string; reason?: string };
      },
      log: logEvent,
    }, id);
    return json(result.status === 'ready' ? 200 : result.status === 'missing' ? 409 : 422, result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'internal';
    if (message === 'feature_disabled') return json(503, { error: 'feature_disabled' });
    if (message === 'forbidden') return json(403, { error: 'forbidden' });
    logEvent('profile_media.error', { message });
    return json(500, { error: 'internal' });
  }
});
