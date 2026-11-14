import { validateWorkout } from './definition';
import { WorkoutDefinition, WorkoutPreferences } from './types';
import type { WorkoutPersistence } from './persistence';
import { readWorkoutFavorites } from './favorites';
export const defaultPreferences = (): WorkoutPreferences => ({ version: 1, selected: null, voiceEnabled: false });
export async function openWorkoutPersistence(): Promise<WorkoutPersistence> {
  const key = 'sprinter.workouts.v1';
  const read = () => JSON.parse(localStorage.getItem(key) ?? '{"definitions":[],"preferences":{"version":1,"selected":null,"voiceEnabled":false}}') as { definitions: WorkoutDefinition[]; preferences: WorkoutPreferences };
  return {
    async load() {
      const value = read(); const definitions = value.definitions.filter(d => !validateWorkout(d).length);
      return { definitions, preferences: { version: 1, voiceEnabled: value.preferences.voiceEnabled === true,
        selected: value.preferences.selected && !validateWorkout(value.preferences.selected).length ? value.preferences.selected : null,
        ...(Array.isArray(value.preferences.favoriteKeys) ? { favoriteKeys: readWorkoutFavorites(value.preferences.favoriteKeys) } : {}) }, unreadable: value.definitions.length - definitions.length };
    },
    async save(definition) { const value = read(); value.definitions = [definition, ...value.definitions.filter(d => d.id !== definition.id)]; localStorage.setItem(key, JSON.stringify(value)); },
    async remove(id) { const value = read(); value.definitions = value.definitions.filter(d => d.id !== id); localStorage.setItem(key, JSON.stringify(value)); },
    async preferences(preferences) { const value = read(); localStorage.setItem(key, JSON.stringify({ ...value, preferences })); },
    async clear(preferences) { localStorage.setItem(key, JSON.stringify({ definitions: [], preferences })); },
  };
}
