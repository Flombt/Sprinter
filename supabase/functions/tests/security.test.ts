import assert from 'node:assert/strict';
import { decodeJwtPayload, isRecentAuthentication, lastAuthenticationAt } from '../_shared/auth.ts';
import { appleClientSecret, base64Url, decryptSecret, encryptSecret, toBase64 } from '../_shared/crypto.ts';
import { exchangeAuthorizationCode, revokeRefreshToken } from '../_shared/apple.ts';
import { bearer, corsHeaders, safeEqual } from '../_shared/http.ts';

const jwt = (payload: Record<string, unknown>) =>
  `${base64Url(new TextEncoder().encode('{"alg":"none"}'))}.${base64Url(new TextEncoder().encode(JSON.stringify(payload)))}.sig`;

Deno.test('ré-authentification : seule une authentification réelle de moins de 5 min compte', () => {
  const now = 2_000_000_000;
  assert.equal(isRecentAuthentication({ amr: [{ method: 'otp', timestamp: now - 120 }] }, now), true);
  assert.equal(isRecentAuthentication({ amr: [{ method: 'oauth', timestamp: now - 3600 }] }, now), false);
  // Un JWT rafraîchi a un iat récent mais garde l'ancienne date d'authentification.
  assert.equal(isRecentAuthentication({ iat: now - 5, amr: [{ method: 'otp', timestamp: now - 86400 }] }, now), false);
  assert.equal(isRecentAuthentication({}, now), false);
  assert.equal(lastAuthenticationAt({ amr: [{ timestamp: 10 }, { timestamp: 30 }] }), 30);
  assert.equal(decodeJwtPayload(jwt({ sub: 'u1' })).sub, 'u1');
});

Deno.test('jeton Apple chiffré : aller-retour et altération détectée', async () => {
  const key = toBase64(crypto.getRandomValues(new Uint8Array(32)));
  const sealed = await encryptSecret('refresh-token-synthetique', key);
  assert.match(sealed, /^v1\./);
  assert.equal(await decryptSecret(sealed, key), 'refresh-token-synthetique');
  const [v, iv, data] = sealed.split('.');
  const tampered = `${v}.${iv}.${data!.slice(0, -4)}AAAA`;
  await assert.rejects(() => decryptSecret(tampered, key));
  await assert.rejects(() => encryptSecret('x', toBase64(new Uint8Array(16))), /bad_encryption_key/);
});

async function testAppleConfig() {
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const pkcs8 = new Uint8Array(await crypto.subtle.exportKey('pkcs8', pair.privateKey));
  const pem = `-----BEGIN PRIVATE KEY-----\n${toBase64(pkcs8)}\n-----END PRIVATE KEY-----`;
  return { pair, config: { teamId: 'TEAM123456', keyId: 'KEY1234567', clientId: 'app.sprinter.running', privateKeyPem: pem } };
}

Deno.test('secret client Apple : JWT ES256 vérifiable', async () => {
  const { pair, config } = await testAppleConfig();
  const token = await appleClientSecret(config, 1_900_000_000);
  const [header, payload, signature] = token.split('.');
  const claims = decodeJwtPayload(token);
  assert.deepEqual({ iss: claims.iss, sub: claims.sub, aud: claims.aud, exp: claims.exp }, {
    iss: 'TEAM123456', sub: 'app.sprinter.running', aud: 'https://appleid.apple.com', exp: 1_900_000_300,
  });
  const raw = Uint8Array.from(atob(signature!.replace(/-/g, '+').replace(/_/g, '/') + '=='.slice(0, (4 - signature!.length % 4) % 4)), (c) => c.charCodeAt(0));
  const valid = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, pair.publicKey, raw, new TextEncoder().encode(`${header}.${payload}`));
  assert.equal(valid, true);
});

Deno.test('Apple : échange du code et révocation envoient les bons paramètres', async () => {
  const { config } = await testAppleConfig();
  const requests: { url: string; body: URLSearchParams }[] = [];
  const fake = async (url: string, init: RequestInit) => {
    requests.push({ url, body: init.body as URLSearchParams });
    if (url.endsWith('/token')) return new Response(JSON.stringify({ refresh_token: 'r1', id_token: jwt({ sub: 'apple-sub' }) }));
    return new Response('', { status: 200 });
  };
  assert.deepEqual(await exchangeAuthorizationCode(config, 'code-123', fake), { refreshToken: 'r1', subject: 'apple-sub' });
  await revokeRefreshToken(config, 'r1', fake);
  assert.equal(requests[0]!.body.get('grant_type'), 'authorization_code');
  assert.equal(requests[1]!.url, 'https://appleid.apple.com/auth/revoke');
  assert.equal(requests[1]!.body.get('token_type_hint'), 'refresh_token');
  assert.equal(requests[1]!.body.get('client_id'), 'app.sprinter.running');
  await assert.rejects(() => revokeRefreshToken(config, 'r1', async () => new Response('', { status: 400 })), /apple_revoke_400/);
});

Deno.test('HTTP : jeton porteur, CORS limité aux origines déclarées, comparaison constante', () => {
  assert.equal(bearer(new Request('https://x', { headers: { Authorization: 'Bearer abc.def.ghi' } })), 'abc.def.ghi');
  assert.equal(bearer(new Request('https://x', { headers: { Authorization: 'Basic abc' } })), null);
  const request = new Request('https://x', { headers: { Origin: 'https://evil.example' } });
  assert.deepEqual(corsHeaders(request, 'https://sprinter.example'), {});
  const allowed = new Request('https://x', { headers: { Origin: 'https://sprinter.example' } });
  assert.equal(corsHeaders(allowed, 'https://sprinter.example')['Access-Control-Allow-Origin'], 'https://sprinter.example');
  assert.equal(safeEqual('abc', 'abc'), true);
  assert.equal(safeEqual('abc', 'abd'), false);
  assert.equal(safeEqual('abc', 'abcd'), false);
});
