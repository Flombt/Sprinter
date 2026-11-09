import { TEMPLATE_INFO } from './templates';
import type { WorkoutKind } from './types';

export const MAX_WORKOUT_FAVORITES = 200;
export const templateFavoriteKey = (kind: Exclude<WorkoutKind, 'custom'>) => `template:${kind}`;
export const savedFavoriteKey = (id: string) => `saved:${id}`;
const templateKeys = new Set(TEMPLATE_INFO.map(item => templateFavoriteKey(item.kind)));

export function validWorkoutFavoriteKey(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 256 &&
    (templateKeys.has(value) || value.startsWith('saved:') && value.length > 6);
}
/** Optional UI metadata must never make a valid workout library unreadable. */
export function readWorkoutFavorites(value: unknown): string[] {
  return Array.isArray(value) ? [...new Set(value.slice(0, MAX_WORKOUT_FAVORITES).filter(validWorkoutFavoriteKey))] : [];
}
