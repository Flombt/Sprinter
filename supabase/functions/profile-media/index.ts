// GET /functions/v1/profile-media?m=<média>&h=<pseudo>|t=<jeton> — lecture d'un média de profil partagé (§17.7).
// Chaque demande revérifie l'autorisation avec le jeton du visiteur (partage, blocage, modération, compte actif) :
// une adresse obtenue avant un retrait ne donne plus rien. Le chemin de stockage n'est jamais exposé.
import { UUID } from '../_shared/auth.ts';
import { bearer, json, logEvent, SECURITY_HEADERS } from '../_shared/http.ts';
import { serverClient, userClient } from '../_shared/supabase.ts';

Deno.serve(async (request) => {
  if (request.method !== 'GET') return json(405, { error: 'method_not_allowed' });
  const token = bearer(request);
  if (!token) return json(401, { error: 'unauthenticated' });
  const url = new URL(request.url);
  const media = (url.searchParams.get('m') ?? '').toLowerCase();
  const handle = url.searchParams.get('h');
  const link = url.searchParams.get('t');
  if (!UUID.test(media) || (handle && !/^[A-Za-z0-9_.-]{3,20}$/.test(handle)) || (link && !/^[A-Za-z0-9_-]{16,64}$/.test(link))) {
    return json(400, { error: 'invalid_parameter' });
  }
  try {
    const { data: access, error } = await userClient(token).rpc('profile_media_access', { p_media_id: media, p_handle: handle, p_token: link });
    if (error) return json(error.message === 'feature_disabled' ? 503 : 403, { error: error.message === 'feature_disabled' ? 'feature_disabled' : 'forbidden' });
    if (!access) return json(404, { error: 'not_found' });
    const service = serverClient();
    const { data: path } = await service.rpc('service_profile_media_path', { p_media_id: media });
    if (typeof path !== 'string') return json(404, { error: 'not_found' });
    const { data: blob, error: downloadError } = await service.storage.from('profile-media').download(path);
    if (downloadError || !blob) return json(404, { error: 'not_found' });
    return new Response(blob, {
      status: 200,
      headers: { ...SECURITY_HEADERS, 'Content-Type': (access as { mime: string }).mime, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' },
    });
  } catch (failure) {
    logEvent('profile_media.read_error', { message: failure instanceof Error ? failure.message : 'unknown' });
    return json(500, { error: 'internal' });
  }
});
