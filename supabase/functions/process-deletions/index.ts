// POST /functions/v1/process-deletions — reprise planifiée des suppressions interrompues.
// Déclenchée par Supabase Cron avec l'en-tête `x-cron-secret` (secret CRON_SECRET).
import { json, logEvent, safeEqual } from '../_shared/http.ts';
import { deletionDeps, rpcOrThrow, serverClient } from '../_shared/supabase.ts';
import { processDeletion } from '../_shared/deletion.ts';

Deno.serve(async (request) => {
  const secret = Deno.env.get('CRON_SECRET');
  if (request.method !== 'POST' || !secret || !safeEqual(request.headers.get('x-cron-secret') ?? '', secret)) {
    return json(401, { error: 'unauthorized' });
  }
  const client = serverClient();
  const pending = await rpcOrThrow<{ user_id: string; operation_id: string; source: 'app' | 'web' | 'admin' | 'inactivity' }[]>(
    client, 'service_pending_deletions', { p_limit: 10 });
  const summary = { done: 0, pending: 0, not_found: 0 };
  for (const item of pending ?? []) {
    const result = await processDeletion(deletionDeps(client), item.user_id, item.operation_id, item.source);
    summary[result.status]++;
  }
  logEvent('process_deletions', summary);
  return json(200, summary);
});
