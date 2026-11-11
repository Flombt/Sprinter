import { describe, expect, it } from 'vitest';
import { RunEngine } from '../src/core/engine';
import { DEFAULT_EXACT_TARGET } from '../src/core/types';
import { resolveRun } from '../src/navigation/routes';

describe('résolution d’une sortie depuis une route', () => {
  const run = new RunEngine(DEFAULT_EXACT_TARGET, undefined, 0, 0, 'test-run').record;

  it('relit l’entrée actuelle de l’historique à partir de son identifiant', () => {
    const updated = { ...run, distanceMeters: 1234 };
    expect(resolveRun([updated], run.id)).toBe(updated);
  });

  it('renvoie un résultat absent après suppression ou pour un identifiant inconnu', () => {
    expect(resolveRun([], run.id)).toBeUndefined();
    expect(resolveRun([run], 'absent')).toBeUndefined();
  });
});
