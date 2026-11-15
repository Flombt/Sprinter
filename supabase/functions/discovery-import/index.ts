import { apidaeSource, type Checkpoint, readApidae } from '../_shared/discovery-apidae.ts';
import { json, logEvent, safeEqual } from '../_shared/http.ts';
import { rpcOrThrow, serverClient } from '../_shared/supabase.ts';

Deno.serve(async (request) => {
  const secret = Deno.env.get('CRON_SECRET');
  const supplied = request.headers.get('x-cron-secret') ?? '';
  if (request.method !== 'POST' || !secret || supplied.length > 512 || !safeEqual(supplied, secret)) {
    return json(401, { error: 'unauthorized' });
  }
  try {
    const client = serverClient();
    const lease = await rpcOrThrow<(Checkpoint & { id: string }) | null>(client, 'service_discovery_begin_v1', {
      p_source: apidaeSource,
    });
    if (!lease) return json(429, { error: 'import_recent_or_running' }, { 'Retry-After': '300' });
    const base = { p_source: apidaeSource, p_lease: lease.id };
    try {
      const result = await readApidae(lease);
      const changed = await rpcOrThrow<number>(client, 'service_discovery_finish_v1', {
        ...base,
        p_state: result.state,
        p_checkpoint: result.checkpoint,
        p_metrics: result.metrics,
        p_rows: result.rows,
      });
      logEvent('discovery_import', { source: apidaeSource, state: result.state, changed, ...result.metrics });
      return json(200, { state: result.state, changed, ...result.metrics });
    } catch (error) {
      const code = error instanceof Error && /^provider_[a-z0-9_]+$/.test(error.message)
        ? error.message
        : 'import_failed';
      await rpcOrThrow(client, 'service_discovery_finish_v1', {
        ...base,
        p_state: 'failed',
        p_checkpoint: {},
        p_metrics: {},
        p_rows: [],
        p_error: code,
      }).catch(() => undefined);
      logEvent('discovery_import_error', { source: apidaeSource, code });
      return json(502, { error: code });
    }
  } catch {
    logEvent('discovery_import_error', { source: apidaeSource, code: 'service_unavailable' });
    return json(503, { error: 'service_unavailable' });
  }
});
