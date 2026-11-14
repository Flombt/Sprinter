// Échange du code d'autorisation et révocation du jeton Apple (§6.6 étape 3).
// https://developer.apple.com/documentation/sign_in_with_apple/revoke_tokens
import { appleClientSecret, type AppleKeyConfig } from './crypto.ts';
import { decodeJwtPayload } from './auth.ts';

export type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

export function appleConfigFromEnv(get: (name: string) => string | undefined): AppleKeyConfig | null {
  const teamId = get('APPLE_TEAM_ID'), keyId = get('APPLE_KEY_ID'), clientId = get('APPLE_BUNDLE_ID'), privateKeyPem = get('APPLE_PRIVATE_KEY');
  if (!teamId || !keyId || !clientId || !privateKeyPem) return null;
  return { teamId, keyId, clientId, privateKeyPem };
}

export async function exchangeAuthorizationCode(config: AppleKeyConfig, code: string, fetchImpl: FetchLike = fetch) {
  const body = new URLSearchParams({
    client_id: config.clientId, client_secret: await appleClientSecret(config), code, grant_type: 'authorization_code',
  });
  const response = await fetchImpl('https://appleid.apple.com/auth/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body,
  });
  if (!response.ok) throw new Error(`apple_token_${response.status}`);
  const result = await response.json() as { refresh_token?: string; id_token?: string };
  if (!result.refresh_token || !result.id_token) throw new Error('apple_token_incomplete');
  const subject = decodeJwtPayload(result.id_token).sub;
  if (typeof subject !== 'string' || !subject) throw new Error('apple_token_subject');
  return { refreshToken: result.refresh_token, subject };
}

export async function revokeRefreshToken(config: AppleKeyConfig, refreshToken: string, fetchImpl: FetchLike = fetch) {
  const body = new URLSearchParams({
    client_id: config.clientId, client_secret: await appleClientSecret(config), token: refreshToken, token_type_hint: 'refresh_token',
  });
  const response = await fetchImpl('https://appleid.apple.com/auth/revoke', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body,
  });
  if (!response.ok) throw new Error(`apple_revoke_${response.status}`);
}
