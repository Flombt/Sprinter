import * as SQLite from 'expo-sqlite';
import { emptyProgression, ProgressionData } from './types';
import { readProgression } from './validation';
export interface ProgressionPersistence { load(): Promise<ProgressionData>; save(data: ProgressionData): Promise<void> }
export async function openProgression(): Promise<ProgressionPersistence> {
  const db = await SQLite.openDatabaseAsync('sprinter-progression-v1.db');
  const version = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  if ((version?.user_version ?? 0) > 1) throw new Error('Version de stockage de progression plus récente. Les données ont été conservées.');
  await db.execAsync('PRAGMA journal_mode = WAL; CREATE TABLE IF NOT EXISTS progression (slot INTEGER PRIMARY KEY CHECK(slot=1), payload TEXT NOT NULL); PRAGMA user_version = 1;');
  return { async load() { const row = await db.getFirstAsync<{ payload: string }>('SELECT payload FROM progression WHERE slot=1'); return row ? readProgression(JSON.parse(row.payload)) : emptyProgression(); },
    async save(data) { await db.runAsync('INSERT INTO progression (slot,payload) VALUES (1,?) ON CONFLICT(slot) DO UPDATE SET payload=excluded.payload', JSON.stringify(data)); } };
}
