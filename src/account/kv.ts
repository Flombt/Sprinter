import * as SQLite from 'expo-sqlite';
import type { SqlDatabase } from '../storage/repository';
import { createSqlKeyValueStore, type KeyValueStore } from './kvStore';

let database: Promise<SqlDatabase> | null = null;

/** Base locale du module compte, séparée de l'historique des courses. */
export function openAccountDatabase(): Promise<SqlDatabase> {
  database ??= SQLite.openDatabaseAsync('sprinter-account-v1.db').then(async (db) => {
    const version = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
    if ((version?.user_version ?? 0) > 1) throw new Error('Données de compte d’une version plus récente. Données conservées.');
    await db.execAsync('PRAGMA journal_mode = WAL; CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL, updated_at REAL NOT NULL); PRAGMA user_version = 1;');
    return db as unknown as SqlDatabase;
  });
  return database;
}

export const accountKv: KeyValueStore = createSqlKeyValueStore(openAccountDatabase);
