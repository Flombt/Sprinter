import { describe, expect, it } from 'vitest';
import { RunEngine } from '../src/core/engine';
import { DEFAULT_TARGET } from '../src/core/types';
import { defaultApplePreferences } from '../src/apple/types';
import { healthRetryCandidates } from '../src/apple/recovery';

function activity(id: string) {
  const run = new RunEngine(DEFAULT_TARGET, undefined, 0, 1000, id).record;
  return { ...run, endedAt: 61000, activeSeconds: 60, distanceMeters: 200, healthExportRequestedAt: 61000 };
}

describe('durable automatic Health export recovery', () => {
  it('recovers a committed run even when the Apple outbox was never updated', () => {
    const run = activity('missing-outbox');
    expect(healthRetryCandidates([run], { ...defaultApplePreferences(), autoWrite: true })).toEqual([run]);
  });
  it('respects disabling automatic export and excludes already acknowledged runs', () => {
    const run = activity('completed');
    expect(healthRetryCandidates([run], defaultApplePreferences())).toEqual([]);
    expect(healthRetryCandidates([run], { ...defaultApplePreferences(), autoWrite: true,
      receipts: [{ runId: run.id, uuid: 'receipt', syncedAt: 62000 }] })).toEqual([]);
  });
  it('does not retroactively export old unmarked activities', () => {
    const { healthExportRequestedAt: _, ...old } = activity('old');
    expect(healthRetryCandidates([old], { ...defaultApplePreferences(), autoWrite: true })).toEqual([]);
    expect(healthRetryCandidates([old], { ...defaultApplePreferences(), autoWrite: true, pendingRunIds: [old.id] })).toEqual([old]);
  });
  it('ignores active and empty runs even if their export was requested', () => {
    const run = activity('active');
    expect(healthRetryCandidates([{ ...run, endedAt: null }, { ...run, id: 'empty', distanceMeters: 0 }],
      { ...defaultApplePreferences(), autoWrite: true })).toEqual([]);
  });
});
