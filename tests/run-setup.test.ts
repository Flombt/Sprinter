import { describe, expect, it } from 'vitest';
import { DEFAULT_TARGET } from '../src/core/types';
import { emptyProgression, type CalendarEntry } from '../src/progression/types';
import type { SavedRoute } from '../src/routes/types';
import { resolveRunSetup } from '../src/services/runSetup';
import { createTemplate } from '../src/workouts/templates';

const base = () => ({ target: { ...DEFAULT_TARGET, distanceMeters: 10000 }, history: [], data: emptyProgression(),
  workout: null, routes: [] as SavedRoute[], routeId: null, maximumSpeed: 12 });

describe('shared preparation for quick start and the full editor', () => {
  it('keeps a custom distance and the selected shoe and route', () => {
    const input = base();
    input.data.shoes = [{ id: 'shoe', name: 'Tempo', initialMeters: 0, archived: false, createdAt: 1 }];
    input.data.defaultShoeId = 'shoe';
    input.routes = [{ version: 1, id: 'route', name: 'Quais', createdAt: 1, source: 'gpx', segments: [], distanceMeters: 5000, warnings: [] }];
    const result = resolveRunSetup({ ...input, routeId: 'route' });
    expect(result.error).toBeNull(); expect(result.target.distanceMeters).toBe(10000);
    expect(result.metadata).toMatchObject({ shoeId: 'shoe', routeId: 'route', routeName: 'Quais' });
  });
  it('prioritizes the selected calendar workout and carries its entry id', () => {
    const input = base(), planned = createTemplate('intervals');
    const entry: CalendarEntry = { id: 'planned', day: '2026-11-11', title: 'Fractionné', kind: 'run', workout: planned,
      status: 'planned', completedRunId: null, planId: null, note: '', createdAt: 1, updatedAt: 1 };
    input.data.entries = [entry]; input.data.selectedEntryId = entry.id;
    const result = resolveRunSetup({ ...input, workout: createTemplate('endurance') });
    expect(result.error).toBeNull(); expect(result.definition).toBe(planned);
    expect(result.target.distanceMeters).toBeNull(); expect(result.metadata.plannedEntryId).toBe(entry.id);
  });
  it('blocks a stale selection instead of silently starting another session', () => {
    const input = base(); input.data.selectedEntryId = 'missing';
    expect(resolveRunSetup(input).error).toContain('calendrier');
    expect(resolveRunSetup({ ...base(), routeId: 'missing' }).error).toContain('parcours');
  });
  it('ignores archived shoes and rejects an invalid workout before expansion', () => {
    const input = base(); input.data.defaultShoeId = 'old';
    input.data.shoes = [{ id: 'old', name: 'Retired', initialMeters: 0, archived: true, createdAt: 1 }];
    expect(resolveRunSetup(input).metadata.shoeId).toBeUndefined();
    const invalid = createTemplate('intervals'); invalid.blocks = [];
    expect(resolveRunSetup({ ...input, workout: invalid }).error).toBeTruthy();
  });
});
