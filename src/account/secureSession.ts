import aesjs from 'aes-js';
import type { KeyValueStore } from './kvStore';

/**
 * Stockage de session recommandé par Supabase pour Expo (§6.3) : la clé de chiffrement
 * (256 bits) vit dans le trousseau (SecureStore), la session chiffrée en AES-CTR dans la
 * base locale du compte. La session brute n'est jamais écrite en clair.
 */
export interface SecretStore {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
}

export interface SessionStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export const SESSION_PREFIX = 'session.';
const KEY_NAME = 'sprinter.session-key.v1';

export function createEncryptedSessionStorage(deps: {
  secrets: SecretStore;
  kv: KeyValueStore;
  random: (length: number) => Uint8Array;
}): SessionStorage & { clear(): Promise<void> } {
  let cached: Uint8Array | null = null;
  async function key(create: boolean): Promise<Uint8Array | null> {
    if (cached) return cached;
    const stored = await deps.secrets.getItemAsync(KEY_NAME);
    if (stored && /^[0-9a-f]{64}$/.test(stored)) return (cached = aesjs.utils.hex.toBytes(stored));
    if (!create) return null;
    const fresh = deps.random(32);
    await deps.secrets.setItemAsync(KEY_NAME, aesjs.utils.hex.fromBytes(fresh));
    return (cached = fresh);
  }
  return {
    async getItem(name) {
      const sealed = await deps.kv.get(SESSION_PREFIX + name);
      if (!sealed) return null;
      const [version, iv, body] = sealed.split(':');
      const secret = await key(false);
      if (version !== 'v1' || !iv || !body || !secret) return null;
      try {
        const cipher = new aesjs.ModeOfOperation.ctr(secret, new aesjs.Counter(aesjs.utils.hex.toBytes(iv)));
        return aesjs.utils.utf8.fromBytes(cipher.decrypt(aesjs.utils.hex.toBytes(body)));
      } catch {
        return null;
      }
    },
    async setItem(name, value) {
      const secret = (await key(true))!;
      const iv = deps.random(16);
      const cipher = new aesjs.ModeOfOperation.ctr(secret, new aesjs.Counter(iv));
      const body = cipher.encrypt(aesjs.utils.utf8.toBytes(value));
      await deps.kv.set(SESSION_PREFIX + name, `v1:${aesjs.utils.hex.fromBytes(iv)}:${aesjs.utils.hex.fromBytes(body)}`);
    },
    async removeItem(name) {
      await deps.kv.remove(SESSION_PREFIX + name);
    },
    /** Efface la session et sa clé (déconnexion, suppression du compte). */
    async clear() {
      await deps.kv.removePrefix(SESSION_PREFIX);
      await deps.secrets.deleteItemAsync(KEY_NAME);
      cached = null;
    },
  };
}
