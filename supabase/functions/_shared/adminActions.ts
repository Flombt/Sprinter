// Actions sur un compte depuis Sprinter Admin (§10.4). L'autorisation, l'effet en base et
// l'audit se font d'abord dans `admin_authorize_user_action` avec le JWT de l'administrateur ;
// la fonction applique ensuite les effets côté Auth avec la clé serveur.
import { UUID } from './auth.ts';

export type AdminAction = 'disable' | 'enable' | 'revoke_sessions' | 'process_deletion';
export interface AdminActionRequest { user_id?: unknown; action?: unknown; reason?: unknown; reason_note?: unknown; confirmation?: unknown }
export interface AdminActionDeps {
  authorize(args: { p_user_id: string; p_action: AdminAction; p_reason: string; p_reason_note: string | null; p_confirmation: string | null }):
    Promise<{ data: { action: string; status: string } | null; error: { code?: string; message?: string } | null }>;
  ban(userId: string): Promise<void>;
  unban(userId: string): Promise<void>;
  deleteAccount(userId: string): Promise<'done' | 'pending' | 'not_found'>;
}

export async function handleAdminAction(deps: AdminActionDeps, body: AdminActionRequest): Promise<{ status: number; body: Record<string, unknown> }> {
  const actions: AdminAction[] = ['disable', 'enable', 'revoke_sessions', 'process_deletion'];
  if (typeof body.user_id !== 'string' || !UUID.test(body.user_id)) return { status: 400, body: { error: 'invalid_parameter:user_id' } };
  if (typeof body.action !== 'string' || !actions.includes(body.action as AdminAction)) return { status: 400, body: { error: 'invalid_parameter:action' } };
  if (typeof body.reason !== 'string') return { status: 400, body: { error: 'reason_required' } };
  const action = body.action as AdminAction;
  const { data, error } = await deps.authorize({
    p_user_id: body.user_id, p_action: action, p_reason: body.reason,
    p_reason_note: typeof body.reason_note === 'string' ? body.reason_note : null,
    p_confirmation: typeof body.confirmation === 'string' ? body.confirmation : null,
  });
  if (error || !data) {
    const message = error?.message ?? 'forbidden';
    const status = error?.code === '22023' ? 400 : error?.code === 'P0002' ? 404 : error?.code === '28000' ? 401 : 403;
    return { status, body: { error: /^[a-z_:.0-9]+$/.test(message) ? message : 'forbidden' } };
  }
  if (action === 'disable') await deps.ban(body.user_id);
  else if (action === 'enable') await deps.unban(body.user_id);
  else if (action === 'process_deletion') {
    const result = await deps.deleteAccount(body.user_id);
    return { status: result === 'done' ? 200 : 202, body: { ok: true, action, status: result === 'done' ? 'deleted' : 'deleting' } };
  }
  return { status: 200, body: { ok: true, action, status: data.status } };
}
