import assert from 'node:assert/strict';
import { handleAdminAction, type AdminActionDeps } from '../_shared/adminActions.ts';

const id = '0f1e2d3c-4b5a-4968-8776-655443322110';
function deps(error: { code?: string; message?: string } | null = null) {
  const calls: string[] = [];
  const value: AdminActionDeps = {
    async authorize(args) { calls.push(`authorize:${args.p_action}`); return error ? { data: null, error } : { data: { action: args.p_action, status: args.p_action === 'disable' ? 'disabled' : 'active' }, error: null }; },
    async ban() { calls.push('ban'); }, async unban() { calls.push('unban'); },
    async deleteAccount() { calls.push('delete'); return 'done'; },
  };
  return { value, calls };
}

Deno.test('admin-user-action : autorisation en base avant tout effet côté Auth', async () => {
  const ok = deps();
  assert.deepEqual(await handleAdminAction(ok.value, { user_id: id, action: 'disable', reason: 'support' }), { status: 200, body: { ok: true, action: 'disable', status: 'disabled' } });
  assert.deepEqual(ok.calls, ['authorize:disable', 'ban']);
  const refused = deps({ code: '42501', message: 'reauth_required' });
  assert.deepEqual(await handleAdminAction(refused.value, { user_id: id, action: 'disable', reason: 'support' }), { status: 403, body: { error: 'reauth_required' } });
  assert.deepEqual(refused.calls, ['authorize:disable']);
});

Deno.test('admin-user-action : paramètres validés, confirmation transmise, suppression déléguée', async () => {
  const bad = deps();
  assert.equal((await handleAdminAction(bad.value, { user_id: 'x', action: 'disable', reason: 'support' })).status, 400);
  assert.equal((await handleAdminAction(bad.value, { user_id: id, action: 'drop_table', reason: 'support' })).status, 400);
  assert.deepEqual(bad.calls, []);
  const mismatch = deps({ code: '22023', message: 'confirmation_mismatch' });
  assert.deepEqual(await handleAdminAction(mismatch.value, { user_id: id, action: 'process_deletion', reason: 'data_request', confirmation: 'SUPPRIMER' }),
    { status: 400, body: { error: 'confirmation_mismatch' } });
  const deletion = deps();
  assert.deepEqual(await handleAdminAction(deletion.value, { user_id: id, action: 'process_deletion', reason: 'data_request', confirmation: 'SUPPRIMER 0f1e2d3c' }),
    { status: 200, body: { ok: true, action: 'process_deletion', status: 'deleted' } });
  assert.deepEqual(deletion.calls, ['authorize:process_deletion', 'delete']);
});
