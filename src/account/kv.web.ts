import type { KeyValueStore } from './kvStore';

const PREFIX = 'sprinter.account.';
const storage = () => (typeof localStorage === 'undefined' ? null : localStorage);

/** Aperçu web : stockage du navigateur, sans garantie de chiffrement. */
export const accountKv: KeyValueStore = {
  async get(key) { return storage()?.getItem(PREFIX + key) ?? null; },
  async set(key, value) { storage()?.setItem(PREFIX + key, value); },
  async remove(key) { storage()?.removeItem(PREFIX + key); },
  async removePrefix(prefix) {
    const store = storage();
    if (!store) return;
    for (let index = store.length - 1; index >= 0; index--) {
      const key = store.key(index);
      if (key?.startsWith(PREFIX + prefix)) store.removeItem(key);
    }
  },
};

export function openAccountDatabase(): Promise<never> {
  return Promise.reject(new Error('Base locale du compte indisponible dans l’aperçu web.'));
}
