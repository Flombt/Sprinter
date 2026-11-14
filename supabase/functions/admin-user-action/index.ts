// POST /functions/v1/admin-user-action — appelée par Sprinter Admin avec le JWT de l'administrateur (AAL2).
import { bearer, corsHeaders, json, logEvent } from '../_shared/http.ts';
import { handleAdminAction } from '../_shared/adminActions.ts';
import { deletionDeps, serverClient, userClient } from '../_shared/supabase.ts';
import { processDeletion } from '../_shared/deletion.ts';

Deno.serve(async (request) => {
  const cors = corsHeaders(request, Deno.env.get('ADMIN_ORIGINS'));
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (request.method !== 'POST') return json(405, { error: 'method_not_allowed' }, cors);
  const token = bearer(request);
  if (!token) return json(401, { error: 'unauthenticated' }, cors);
  try {
    const server = serverClient();
    const admin = userClient(token);
    const body = await request.json().catch(() => ({}));
    const result = await handleAdminAction({
      authorize: async (args) => {
        const { data, error } = await admin.rpc('admin_authorize_user_action', args);
        return { data: data as { action: string; status: string } | null, error: error ? { code: error.code, message: error.message } : null };
      },
      async ban(userId) {
        const { error } = await server.auth.admin.updateUserById(userId, { ban_duration: '876000h' });
        if (error) throw new Error('auth_ban');
      },
      async unban(userId) {
        const { error } = await server.auth.admin.updateUserById(userId, { ban_duration: 'none' });
        if (error) throw new Error('auth_unban');
      },
      async deleteAccount(userId) {
        const outcome = await processDeletion(deletionDeps(server), userId, crypto.randomUUID(), 'admin');
        return outcome.status;
      },
    }, body);
    return json(result.status, result.body, cors);
  } catch (error) {
    logEvent('admin_user_action.error', { message: error instanceof Error ? error.message : 'unknown' });
    return json(500, { error: 'internal' }, cors);
  }
});
