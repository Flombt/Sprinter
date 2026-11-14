// POST /functions/v1/purge-storage — purge quotidienne des tracés supprimés et des fichiers orphelins (§5.6).
// Déclenchée par Supabase Cron avec l'en-tête `x-cron-secret`. Suppression via l'API Storage uniquement.
import { json, logEvent, safeEqual } from '../_shared/http.ts';
import { rpcOrThrow, serverClient } from '../_shared/supabase.ts';

Deno.serve(async (request) => {
  const secret = Deno.env.get('CRON_SECRET');
  if (request.method !== 'POST' || !secret || !safeEqual(request.headers.get('x-cron-secret') ?? '', secret)) {
    return json(401, { error: 'unauthorized' });
  }
  const client = serverClient();
  const batch = await rpcOrThrow<{ queue_id: number | null; bucket: string; path: string }[]>(client, 'service_storage_purge_batch', { p_limit: 200 });
  const byBucket = new Map<string, string[]>();
  for (const item of batch ?? []) byBucket.set(item.bucket, [...(byBucket.get(item.bucket) ?? []), item.path]);
  let removed = 0;
  for (const [bucket, paths] of byBucket) {
    for (let index = 0; index < paths.length; index += 100) {
      const { error } = await client.storage.from(bucket).remove(paths.slice(index, index + 100));
      if (error) { logEvent('purge_storage.error', { bucket }); return json(502, { error: 'storage_remove' }); }
      removed += Math.min(100, paths.length - index);
    }
  }
  const queued = (batch ?? []).map((item) => item.queue_id).filter((id): id is number => id !== null);
  if (queued.length) await rpcOrThrow(client, 'service_storage_purged', { p_queue_ids: queued });
  logEvent('purge_storage', { removed });
  return json(200, { removed });
});
