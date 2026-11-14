// POST /functions/v1/inactive-accounts — tâche hebdomadaire (Supabase Cron, en-tête x-cron-secret).
// Envoi par une API HTTP d'e-mail transactionnel (EMAIL_API_URL, EMAIL_API_KEY, EMAIL_FROM), format
// { from, to, subject, text } compatible avec les principaux prestataires ; à adapter si besoin.
import { json, logEvent, safeEqual } from '../_shared/http.ts';
import { deletionDeps, rpcOrThrow, serverClient } from '../_shared/supabase.ts';
import { processDeletion } from '../_shared/deletion.ts';
import { processInactivity, WARNING_SUBJECT, WARNING_TEXT } from '../_shared/inactivity.ts';

Deno.serve(async (request) => {
  const secret = Deno.env.get('CRON_SECRET');
  if (request.method !== 'POST' || !secret || !safeEqual(request.headers.get('x-cron-secret') ?? '', secret)) return json(401, { error: 'unauthorized' });
  const client = serverClient();
  const url = Deno.env.get('EMAIL_API_URL'), key = Deno.env.get('EMAIL_API_KEY'), from = Deno.env.get('EMAIL_FROM');
  const summary = await processInactivity({
    async candidates(stage) {
      return (await rpcOrThrow<{ user_id: string }[]>(client, 'service_inactive_accounts', { p_stage: stage, p_limit: 100 })).map((row) => row.user_id);
    },
    async email(userId) {
      const { data } = await client.auth.admin.getUserById(userId);
      return data.user?.email ?? null;
    },
    send: url && key && from ? async (to) => {
      const response = await fetch(url, {
        method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to, subject: WARNING_SUBJECT, text: WARNING_TEXT }),
      });
      if (!response.ok) throw new Error(`email_${response.status}`);
    } : null,
    markWarned: (userId) => rpcOrThrow(client, 'service_mark_inactivity_notice', { p_user_id: userId }),
    async deleteAccount(userId) { return (await processDeletion(deletionDeps(client), userId, crypto.randomUUID(), 'inactivity')).status; },
    log: logEvent,
  });
  return json(200, summary);
});
