import type { SqlDatabase } from '../storage/repository';

/** Petit stockage clé/valeur local (cache de configuration, identifiant d'appareil…). */
export interface KeyValueStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
  /** Supprime toutes les clés commençant par le préfixe (données liées à un compte). */
  removePrefix(prefix: string): Promise<void>;
}

export function createSqlKeyValueStore(open: () => Promise<SqlDatabase>): KeyValueStore {
  return {
    async get(key) {
      const db = await open();
      const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM kv WHERE key = ?', key);
      return row?.value ?? null;
    },
    async set(key, value) {
      const db = await open();
      await db.runAsync('INSERT INTO kv (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at', key, value, Date.now());
    },
    async remove(key) {
      const db = await open();
      await db.runAsync('DELETE FROM kv WHERE key = ?', key);
    },
    async removePrefix(prefix) {
      const db = await open();
      await db.runAsync("DELETE FROM kv WHERE substr(key, 1, length(?)) = ?", prefix, prefix);
    },
  };
}

export function createMemoryKeyValueStore(initial: Record<string, string> = {}): KeyValueStore & { data: Map<string, string> } {
  const data = new Map(Object.entries(initial));
  return {
    data,
    async get(key) { return data.get(key) ?? null; },
    async set(key, value) { data.set(key, value); },
    async remove(key) { data.delete(key); },
    async removePrefix(prefix) { for (const key of [...data.keys()]) if (key.startsWith(prefix)) data.delete(key); },
  };
}
