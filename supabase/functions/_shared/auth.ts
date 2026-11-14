// Lecture des claims d'un JWT déjà vérifié par Supabase Auth (getUser), et contrôle de
// ré-authentification récente : un rafraîchissement de jeton ne change pas `amr`.

export type Claims = Record<string, unknown> & {
  sub?: string;
  session_id?: string;
  aal?: string;
  amr?: { method?: string; timestamp?: number }[];
};

function base64UrlDecode(input: string): Uint8Array {
  const base64 = input.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(input.length / 4) * 4, '=');
  const binary = atob(base64);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

export function decodeJwtPayload(token: string): Claims {
  const part = token.split('.')[1];
  if (!part) throw new Error('malformed_token');
  return JSON.parse(new TextDecoder().decode(base64UrlDecode(part))) as Claims;
}

/** Date (s) de la dernière authentification réelle (OTP, OAuth, id_token, TOTP…). */
export function lastAuthenticationAt(claims: Claims): number | null {
  const timestamps = (Array.isArray(claims.amr) ? claims.amr : [])
    .map((entry) => entry?.timestamp)
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  return timestamps.length ? Math.max(...timestamps) : null;
}

export const REAUTH_MAX_AGE_SECONDS = 300;

export function isRecentAuthentication(claims: Claims, nowSeconds: number, maxAge = REAUTH_MAX_AGE_SECONDS): boolean {
  const at = lastAuthenticationAt(claims);
  return at !== null && at <= nowSeconds + 60 && nowSeconds - at <= maxAge;
}

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
