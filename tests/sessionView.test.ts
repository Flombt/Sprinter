import { describe, expect, it, vi } from 'vitest';
import { recentMapFix } from '../src/services/sessionView';
import { sameFields, snapshotSelection } from '../src/services/snapshotSelection';

describe('abonnement aux données de présentation', () => {
  it('stabilise la sélection pendant les ticks qui ne changent que le temps', () => {
    let state = { time: 0, running: true };
    const select = vi.fn((snapshot: typeof state) => ({ running: snapshot.running }));
    const read = snapshotSelection(() => state, select, sameFields);
    const original = read();
    expect(read()).toBe(original);
    expect(select).toHaveBeenCalledTimes(1);
    state = { ...state, time: 1 };
    expect(read()).toBe(original);
    state = { ...state, running: false };
    expect(read()).not.toBe(original);
    expect(read()).toEqual({ running: false });
  });

  it('compare les clés et les références de chaque champ', () => {
    expect(sameFields<Record<string, undefined>>({ one: undefined }, { two: undefined })).toBe(false);
    const shared: number[] = [];
    expect(sameFields({ shared }, { shared })).toBe(true);
    expect(sameFields({ shared }, { shared: [] })).toBe(false);
  });
});

it('expose le dernier point récent uniquement avec un signal exploitable', () => {
  const fix = { latitude: 43, longitude: 7, timestamp: 10000, accuracy: 10, speed: null };
  expect(recentMapFix(fix, 'good', 17999)).toBe(fix);
  expect(recentMapFix(fix, 'stationary', 12000)).toBe(fix);
  expect(recentMapFix(fix, 'good', 18000)).toBeUndefined();
  expect(recentMapFix(fix, 'stale', 12000)).toBeUndefined();
  expect(recentMapFix(undefined, 'good', 12000)).toBeUndefined();
});
