// POST /functions/v1/delete-account — appelée par l'app ou la page web avec le JWT du titulaire.
// Exige une authentification réelle de moins de 5 minutes (§6.6 étape 1).
import { bearer, corsHeaders, json, logEvent } from '../_shared/http.ts';
import { decodeJwtPayload, isRecentAuthentication, UUID } from '../_shared/auth.ts';
import { deletionDeps, rpcOrThrow, serverClient } from '../_shared/supabase.ts';
import { processDeletion } from '../_shared/deletion.ts';

Deno.serve(async (request) => {
  const cors = corsHeaders(request, Deno.env.get('PUBLIC_WEB_ORIGINS'));
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (request.method === 'GET') {
    // GET ?operation=<uuid> : statut d'une suppression validée, sans session (§6.6 étape 6).
    const operation = new URL(request.url).searchParams.get('operation') ?? '';
    if (!UUID.test(operation)) return json(400, { error: 'invalid_parameter:operation' }, cors);
    const status = await rpcOrThrow<string | null>(serverClient(), 'service_deletion_status', { p_operation_id: operation });
    return json(200, { status: status === 'done' ? 'done' : status ? 'pending' : 'unknown' }, cors);
  }
  if (request.method !== 'POST') return json(405, { error: 'method_not_allowed' }, cors);
  const token = bearer(request);
  if (!token) return json(401, { error: 'unauthenticated' }, cors);
  try {
    const client = serverClient();
    const { data, error } = await client.auth.getUser(token);
    if (error || !data.user) return json(401, { error: 'unauthenticated' }, cors);
    const claims = decodeJwtPayload(token);
    if (claims.sub !== data.user.id) return json(401, { error: 'unauthenticated' }, cors);
    if (!isRecentAuthentication(claims, Math.floor(Date.now() / 1000))) return json(403, { error: 'reauth_required' }, cors);
    const body = await request.json().catch(() => ({})) as { source?: string };
    const result = await processDeletion(deletionDeps(client), data.user.id, crypto.randomUUID(), body.source === 'web' ? 'web' : 'app');
    if (result.status === 'not_found') return json(404, { error: 'not_found' }, cors);
    return json(result.status === 'done' ? 200 : 202, result, cors);
  } catch (error) {
    logEvent('delete_account.error', { message: error instanceof Error ? error.message : 'unknown' });
    return json(500, { error: 'internal' }, cors);
  }
});
