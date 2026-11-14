import type { RunRecord } from '../core/types';

/**
 * Doublons probables après une union par identifiant (§7.6 C) : départ à ±2 min et distance
 * à ±2 %. Sprinter ne supprime rien de lui-même : le titulaire choisit.
 */
export interface DuplicatePair { key: string; a: RunRecord; b: RunRecord }

export function probableDuplicates(history: readonly RunRecord[], dismissed: ReadonlySet<string> = new Set()): DuplicatePair[] {
  const runs = [...history].filter((run) => run.endedAt !== null).sort((x, y) => x.startedAt - y.startedAt);
  const pairs: DuplicatePair[] = [];
  for (let i = 0; i < runs.length; i++) {
    const a = runs[i]!;
    for (let j = i + 1; j < runs.length; j++) {
      const b = runs[j]!;
      if (b.startedAt - a.startedAt > 120_000) break;
      const largest = Math.max(a.distanceMeters, b.distanceMeters);
      if (largest <= 0 || Math.abs(a.distanceMeters - b.distanceMeters) / largest > 0.02) continue;
      const key = [a.id, b.id].sort().join('|');
      if (!dismissed.has(key)) pairs.push({ key, a, b });
    }
  }
  return pairs;
}
