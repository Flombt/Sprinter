import * as SQLite from 'expo-sqlite';
import { validateWorkout } from './definition';
import { WorkoutDefinition, WorkoutPreferences } from './types';
import { readWorkoutFavorites } from './favorites';

export interface WorkoutPersistence {
  load(): Promise<{ definitions: WorkoutDefinition[]; preferences: WorkoutPreferences; unreadable: number }>;
  save(definition: WorkoutDefinition): Promise<void>;
  remove(id: string): Promise<void>;
  preferences(value: WorkoutPreferences): Promise<void>;
  clear(preferences: WorkoutPreferences): Promise<void>;
}
export const defaultPreferences = (): WorkoutPreferences => ({ version: 1, selected: null, voiceEnabled: false });
export async function openWorkoutPersistence(): Promise<WorkoutPersistence> {
  const db = await SQLite.openDatabaseAsync('sprinter-workouts-v1.db');
  const version = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  if ((version?.user_version ?? 0) > 1) throw new Error('La bibliothèque de séances provient d’une version plus récente. Données conservées.');
  await db.execAsync('PRAGMA journal_mode = WAL; CREATE TABLE IF NOT EXISTS workouts (id TEXT PRIMARY KEY NOT NULL, updated_at REAL NOT NULL, payload TEXT NOT NULL); CREATE TABLE IF NOT EXISTS preferences (slot INTEGER PRIMARY KEY NOT NULL, payload TEXT NOT NULL); PRAGMA user_version=1;');
  return {
    async load() {
      const rows = await db.getAllAsync<{ payload: string }>('SELECT payload FROM workouts ORDER BY updated_at DESC');
      const definitions: WorkoutDefinition[] = []; let unreadable = 0;
      for (const row of rows) try { const value = JSON.parse(row.payload); if (validateWorkout(value).length) throw new Error(); definitions.push(value); } catch { unreadable++; }
      let preferences = defaultPreferences();
      const row = await db.getFirstAsync<{ payload: string }>('SELECT payload FROM preferences WHERE slot = 1');
      if (row) try { const value = JSON.parse(row.payload); preferences = { version: 1, voiceEnabled: value.voiceEnabled === true,
        selected: value.selected && !validateWorkout(value.selected).length ? value.selected : null,
        ...(Array.isArray(value.favoriteKeys) ? { favoriteKeys: readWorkoutFavorites(value.favoriteKeys) } : {}) }; } catch { unreadable++; }
      return { definitions, preferences, unreadable };
    },
    async save(value) { await db.runAsync('INSERT OR REPLACE INTO workouts (id, updated_at, payload) VALUES (?, ?, ?)', value.id, value.updatedAt, JSON.stringify(value)); },
    async remove(id) { await db.runAsync('DELETE FROM workouts WHERE id = ?', id); },
    async preferences(value) { await db.runAsync('INSERT OR REPLACE INTO preferences (slot, payload) VALUES (1, ?)', JSON.stringify(value)); },
    async clear(preferences) {
      await db.withExclusiveTransactionAsync(async (tx) => {
        await tx.runAsync('DELETE FROM workouts');
        await tx.runAsync('INSERT OR REPLACE INTO preferences (slot, payload) VALUES (1, ?)', JSON.stringify(preferences));
      });
    },
  };
}
