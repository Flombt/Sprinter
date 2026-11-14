import * as SQLite from 'expo-sqlite';
import type { SavedRoute, ToolsData } from './types';
import { defaultToolsData } from './types';
import { readRoute, readTools } from './validation';
export interface ToolsPersistence {
  load(): Promise<{ routes: SavedRoute[]; preferences: ToolsData }>;
  saveRoute(route: SavedRoute): Promise<void>; deleteRoute(id: string): Promise<void>; savePreferences(data: ToolsData): Promise<void>;
  clearRoutes(preferences: ToolsData): Promise<void>;
}
export async function openTools(): Promise<ToolsPersistence> {
  const db = await SQLite.openDatabaseAsync('sprinter-tools-v1.db');
  const version = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  if ((version?.user_version ?? 0) > 1) throw new Error('Stockage des outils plus récent que cette application.');
  await db.execAsync('PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS routes (id TEXT PRIMARY KEY, payload TEXT NOT NULL); CREATE TABLE IF NOT EXISTS preferences (slot INTEGER PRIMARY KEY CHECK(slot=1), payload TEXT NOT NULL); PRAGMA user_version=1;');
  return { async load() {
    const [rows, preferences] = await Promise.all([db.getAllAsync<{ payload: string }>('SELECT payload FROM routes'), db.getFirstAsync<{ payload: string }>('SELECT payload FROM preferences WHERE slot=1')]);
    return { routes: rows.map(r => readRoute(JSON.parse(r.payload))), preferences: preferences ? readTools(JSON.parse(preferences.payload)) : defaultToolsData() };
  }, async saveRoute(route) { await db.runAsync('INSERT INTO routes (id,payload) VALUES (?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload', route.id, JSON.stringify(route)); },
    async deleteRoute(id) { await db.runAsync('DELETE FROM routes WHERE id=?', id); },
    async savePreferences(data) { await db.runAsync('INSERT INTO preferences (slot,payload) VALUES (1,?) ON CONFLICT(slot) DO UPDATE SET payload=excluded.payload', JSON.stringify(data)); },
    async clearRoutes(preferences) {
      await db.withExclusiveTransactionAsync(async (tx) => {
        await tx.runAsync('DELETE FROM routes');
        await tx.runAsync('INSERT INTO preferences (slot,payload) VALUES (1,?) ON CONFLICT(slot) DO UPDATE SET payload=excluded.payload', JSON.stringify(preferences));
      });
    } };
}
