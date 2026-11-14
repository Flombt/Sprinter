// Base locale du profil personnalisé, ouverte au premier usage seulement (§17.8).
import * as SQLite from 'expo-sqlite';
import type { SqlDatabase, SqlValue } from '../storage/repository';

let database: Promise<SQLite.SQLiteDatabase> | null = null;
const open = () => (database ??= SQLite.openDatabaseAsync('sprinter-profile-v1.db'));

export const profileDatabase: SqlDatabase = {
  execAsync: async (sql) => { await (await open()).execAsync(sql); },
  runAsync: async (sql, ...parameters: SqlValue[]) => (await open()).runAsync(sql, ...parameters),
  getFirstAsync: async <T>(sql: string, ...parameters: SqlValue[]) => (await open()).getFirstAsync<T>(sql, ...parameters),
  getAllAsync: async <T>(sql: string, ...parameters: SqlValue[]) => (await open()).getAllAsync<T>(sql, ...parameters),
};
