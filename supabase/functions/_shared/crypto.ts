// Chiffrement du jeton Apple (AES-256-GCM, clé hors base) et secret client Apple (JWT ES256).

const encoder = new TextEncoder(), decoder = new TextDecoder();

export function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}
export function fromBase64(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
  return bytes;
}
export function base64Url(bytes: Uint8Array): string {
  return toBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function aesKey(base64Key: string): Promise<CryptoKey> {
  const raw = fromBase64(base64Key);
  if (raw.length !== 32) throw new Error('bad_encryption_key');
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

/** Format : v1.<iv base64>.<chiffré base64> */
export async function encryptSecret(plaintext: string, base64Key: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const sealed = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await aesKey(base64Key), encoder.encode(plaintext)));
  return `v1.${toBase64(iv)}.${toBase64(sealed)}`;
}

export async function decryptSecret(ciphertext: string, base64Key: string): Promise<string> {
  const [version, iv, sealed] = ciphertext.split('.');
  if (version !== 'v1' || !iv || !sealed) throw new Error('bad_ciphertext');
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromBase64(iv) }, await aesKey(base64Key), fromBase64(sealed));
  return decoder.decode(plain);
}

function pemToPkcs8(pem: string): Uint8Array<ArrayBuffer> {
  const body = pem.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s+/g, '');
  return fromBase64(body);
}

export interface AppleKeyConfig { teamId: string; keyId: string; clientId: string; privateKeyPem: string }

/** Secret client Apple : JWT ES256 valable 5 minutes (signature P1363, format JWS). */
export async function appleClientSecret(config: AppleKeyConfig, nowSeconds = Math.floor(Date.now() / 1000)): Promise<string> {
  const key = await crypto.subtle.importKey('pkcs8', pemToPkcs8(config.privateKeyPem), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const header = base64Url(encoder.encode(JSON.stringify({ alg: 'ES256', kid: config.keyId, typ: 'JWT' })));
  const payload = base64Url(encoder.encode(JSON.stringify({
    iss: config.teamId, iat: nowSeconds, exp: nowSeconds + 300, aud: 'https://appleid.apple.com', sub: config.clientId,
  })));
  const signature = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, encoder.encode(`${header}.${payload}`)));
  return `${header}.${payload}.${base64Url(signature)}`;
}
