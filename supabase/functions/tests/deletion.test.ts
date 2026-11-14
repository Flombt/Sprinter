import assert from 'node:assert/strict';
import { processDeletion, type DeletionDeps } from '../_shared/deletion.ts';

type Call = [string, ...unknown[]];

function fakeDeps(options: { providers: string[] | null; appleToken?: boolean; failStorageOnce?: boolean; appleConfigured?: boolean; done?: boolean }) {
  const calls: Call[] = [];
  let storageFailures = options.failStorageOnce ? 1 : 0;
  let deleted = false;
  const objects = new Map<string, string[]>([
    ['run-tracks', ['u1/a.json.gz', 'u1/b.json.gz']],
    ['profile-media', ['u1/avatar/x.webp']],
  ]);
  const deps: DeletionDeps = {
    async rpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
      calls.push(['rpc', name, args]);
      if (name === 'service_begin_account_deletion') return { status: options.done ? 'done' : 'processing', operation_id: 'op-1' } as T;
      if (name === 'service_get_apple_token') return (options.appleToken ? [{ ciphertext: 'v1.x.y', key_version: 1 }] : []) as T;
      return { status: 'done' } as T;
    },
    async providers() { return deleted ? null : options.providers; },
    async banUser(id) { calls.push(['ban', id]); },
    async deleteAuthUser(id) { calls.push(['deleteUser', id]); deleted = true; },
    async listUserObjects(bucket) {
      if (bucket === 'run-tracks' && storageFailures > 0) { storageFailures--; throw new Error('storage_list:timeout'); }
      return objects.get(bucket) ?? [];
    },
    async removeObjects(bucket, paths) { calls.push(['remove', bucket, paths]); objects.set(bucket, []); },
    revokeApple: options.appleConfigured === false ? null : async (ciphertext) => { calls.push(['revokeApple', ciphertext]); },
    log() {},
  };
  return { deps, calls };
}

Deno.test('compte Apple : révocation du jeton, fichiers supprimés, puis compte Auth', async () => {
  const { deps, calls } = fakeDeps({ providers: ['apple'], appleToken: true });
  const result = await processDeletion(deps, 'u1', 'op-1', 'app');
  assert.deepEqual(result, { status: 'done', operation_id: 'op-1' });
  const order = calls.map((call) => call[0] === 'rpc' ? `rpc:${call[1]}` : call[0]);
  assert.deepEqual(order, [
    'rpc:service_begin_account_deletion', 'ban', 'rpc:service_get_apple_token', 'revokeApple',
    'remove', 'remove', 'deleteUser', 'rpc:service_finish_account_deletion',
  ]);
});

Deno.test('compte Google : aucune révocation Apple', async () => {
  const { deps, calls } = fakeDeps({ providers: ['google'] });
  const result = await processDeletion(deps, 'u1', 'op-1', 'app');
  assert.equal(result.status, 'done');
  assert.ok(!calls.some((call) => call[0] === 'revokeApple' || call[1] === 'service_get_apple_token'));
});

Deno.test('compte e-mail : fichiers de tous les buckets supprimés', async () => {
  const { deps, calls } = fakeDeps({ providers: ['email'] });
  await processDeletion(deps, 'u1', 'op-1', 'web');
  const removed = calls.filter((call) => call[0] === 'remove').map((call) => call[1]);
  assert.deepEqual(removed, ['run-tracks', 'profile-media']);
});

Deno.test('échec de nettoyage simulé : reprise sans rouvrir les accès, même état final', async () => {
  const { deps, calls } = fakeDeps({ providers: ['email'], failStorageOnce: true });
  const first = await processDeletion(deps, 'u1', 'op-1', 'app');
  assert.equal(first.status, 'pending');
  assert.ok(calls.some((call) => call[1] === 'service_fail_account_deletion'));
  assert.ok(!calls.some((call) => call[0] === 'deleteUser'), 'le compte Auth n’est pas supprimé tant que les fichiers restent');
  const second = await processDeletion(deps, 'u1', 'op-1', 'app');
  assert.equal(second.status, 'done');
  const third = await processDeletion(deps, 'u1', 'op-1', 'app');
  assert.equal(third.status, 'done', 'rejouer après la fin est sans effet');
  assert.equal(calls.filter((call) => call[0] === 'deleteUser').length, 1);
});

Deno.test('Apple non configuré : la suppression attend au lieu de sauter la révocation', async () => {
  const { deps } = fakeDeps({ providers: ['apple'], appleToken: true, appleConfigured: false });
  const result = await processDeletion(deps, 'u1', 'op-1', 'app');
  assert.deepEqual(result, { status: 'pending', operation_id: 'op-1', step: 'apple' });
});

Deno.test('demande déjà terminée : rien n’est rejoué', async () => {
  const { deps, calls } = fakeDeps({ providers: null, done: true });
  assert.equal((await processDeletion(deps, 'u1', 'op-2', 'admin')).status, 'done');
  assert.equal(calls.length, 1);
});
