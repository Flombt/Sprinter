// POST /functions/v1/apple-link { authorizationCode } — juste après une connexion Apple.
// Échange le code contre un jeton de rafraîchissement, vérifie qu'il appartient bien à
// l'identité Apple du compte, puis le conserve chiffré pour la révocation à la suppression.
import { bearer, json, logEvent } from '../_shared/http.ts';
import { decodeJwtPayload } from '../_shared/auth.ts';
import { appleConfigFromEnv, exchangeAuthorizationCode } from '../_shared/apple.ts';
import { encryptSecret } from '../_shared/crypto.ts';
import { rpcOrThrow, serverClient } from '../_shared/supabase.ts';

Deno.serve(async (request) => {
  if (request.method !== 'POST') return json(405, { error: 'method_not_allowed' });
  const token = bearer(request);
  if (!token) return json(401, { error: 'unauthenticated' });
  const apple = appleConfigFromEnv((name) => Deno.env.get(name));
  const key = Deno.env.get('APPLE_TOKEN_KEY');
  if (!apple || !key) return json(503, { error: 'apple_not_configured' });
  try {
    const client = serverClient();
    const { data, error } = await client.auth.getUser(token);
    if (error || !data.user || decodeJwtPayload(token).sub !== data.user.id) return json(401, { error: 'unauthenticated' });
    const body = await request.json().catch(() => ({})) as { authorizationCode?: unknown };
    if (typeof body.authorizationCode !== 'string' || body.authorizationCode.length < 10 || body.authorizationCode.length > 2000) {
      return json(400, { error: 'invalid_parameter:authorizationCode' });
    }
    const identity = (data.user.identities ?? []).find((item) => item.provider === 'apple');
    const expected = (identity?.identity_data?.sub as string | undefined) ?? identity?.id;
    if (!expected) return json(409, { error: 'no_apple_identity' });
    const { refreshToken, subject } = await exchangeAuthorizationCode(apple, body.authorizationCode);
    if (subject !== expected) return json(409, { error: 'apple_identity_mismatch' });
    await rpcOrThrow(client, 'service_store_apple_token', {
      p_user_id: data.user.id, p_ciphertext: await encryptSecret(refreshToken, key), p_key_version: 1,
    });
    return json(200, { stored: true });
  } catch (error) {
    logEvent('apple_link.error', { message: error instanceof Error ? error.message : 'unknown' });
    return json(502, { error: 'apple_exchange_failed' });
  }
});
