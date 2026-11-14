import assert from 'node:assert/strict';
import { processInactivity, type InactivityDeps } from '../_shared/inactivity.ts';

function deps(send: boolean) {
  const calls: string[] = [];
  const value: InactivityDeps = {
    async candidates(stage) { return stage === 'warn' ? ['w1', 'w2'] : ['d1']; },
    async email(id) { return id === 'w2' ? null : `${id}@example.test`; },
    send: send ? async (to) => { calls.push(`send:${to}`); } : null,
    async markWarned(id) { calls.push(`warned:${id}`); },
    async deleteAccount(id) { calls.push(`delete:${id}`); return 'done'; },
    log() {},
  };
  return { value, calls };
}

Deno.test('comptes inactifs : avertissement puis suppression', async () => {
  const { value, calls } = deps(true);
  assert.deepEqual(await processInactivity(value), { warned: 1, deleted: 1, skipped: 1 });
  assert.deepEqual(calls, ['send:w1@example.test', 'warned:w1', 'delete:d1']);
});

Deno.test('comptes inactifs : sans envoi configuré, aucune suppression', async () => {
  const { value, calls } = deps(false);
  assert.equal((await processInactivity(value)).deleted, 0);
  assert.deepEqual(calls, []);
});
