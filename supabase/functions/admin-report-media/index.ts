// Lecture d'un média signalé avec le JWT AAL2 de l'administrateur et un motif journalisé.
// Chaque requête revérifie l'accès. Aucun lien Storage durable n'est remis au navigateur.
import { UUID } from '../_shared/auth.ts';
import { bearer, json, SECURITY_HEADERS } from '../_shared/http.ts';
import { serverClient, userClient } from '../_shared/supabase.ts';

Deno.serve(async (request) => {
  if (request.method !== 'GET') return json(405, { error: 'method_not_allowed' });
  const token = bearer(request);
  if (!token) return json(401, { error: 'unauthenticated' });
  const query = new URL(request.url).searchParams;
  const report = query.get('report') ?? '';
  const reason = query.get('reason');
  if (!UUID.test(report) || !reason) return json(400, { error: 'invalid_parameter' });
  try {
    const { data: media, error } = await userClient(token).rpc('admin_report_media', { p_report_id: report, p_reason: reason });
    if (error) return json(error.code === 'P0002' ? 404 : 403, { error: error.code === 'P0002' ? 'not_found' : 'forbidden' });
    if (!media || !['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(media.mime)) return json(404, { error: 'not_found' });
    const service = serverClient();
    const { data: path } = await service.rpc('service_profile_media_path', { p_media_id: media.media_id });
    if (typeof path !== 'string') return json(404, { error: 'not_found' });
    const { data: image, error: downloadError } = await service.storage.from('profile-media').download(path);
    if (downloadError || !image) return json(404, { error: 'not_found' });
    return new Response(image, { headers: { ...SECURITY_HEADERS, 'Content-Type': media.mime, 'Content-Disposition': 'inline' } });
  } catch {
    return json(500, { error: 'internal' });
  }
});
