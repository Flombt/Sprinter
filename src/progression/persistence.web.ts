import type { ProgressionPersistence } from './persistence';
import { emptyProgression } from './types';
import { readProgression } from './validation';
export async function openProgression(): Promise<ProgressionPersistence> {
  const key = 'sprinter.progression.v1';
  return { async load() { const raw = localStorage.getItem(key); return raw ? readProgression(JSON.parse(raw)) : emptyProgression(); }, async save(data) { localStorage.setItem(key, JSON.stringify(data)); } };
}
