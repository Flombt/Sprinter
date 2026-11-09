import { describe, it, expect } from 'vitest';
import { ActiveClock, RunEngine } from '../src/core/engine';
import { DEFAULT_TARGET, DEFAULT_CONFIG, GPSFix, AlertCue } from '../src/core/types';
import { averagePace, averageSpeed, targetPercentage, allSplits } from '../src/core/format';

const start = 1800000000000;
function fix(second: number, value = 315, overrides: Partial<GPSFix> = {}): GPSFix {
  return { latitude: 48 + second * 1000 / value / 6371000 * 180 / Math.PI, longitude: 2,
    accuracy: 4, timestamp: start + second * 1000, speed: 1000 / value, ...overrides };
}
function engine() { return new RunEngine(DEFAULT_TARGET, DEFAULT_CONFIG, 0, start, 'test'); }
function feed(run: RunEngine, from: number, to: number, value = 315) {
  const cues: AlertCue[] = [];
  for (let t = from; t <= to; t++) { const cue = run.process(fix(t, value), t, start + t * 1000); if (cue) cues.push(cue); }
  return cues;
}
describe('GPS run engine', () => {
  it('records an exact two-kilometre run, splits, weighted compliance and speed', () => {
    const run = engine(); expect(feed(run, 0, 630)).toEqual([]);
    expect(run.record.distanceMeters).toBeCloseTo(2000, 5); expect(run.record.activeSeconds).toBe(630);
    expect(run.currentPace).toBeCloseTo(315, 5); expect(averagePace(run.record)).toBeCloseTo(315, 5);
    expect(averageSpeed(run.record)).toBeCloseTo(11.42857, 4); expect(targetPercentage(run.record)).toBe(100);
    expect(run.record.bestPace).toBeCloseTo(315, 5); expect(run.record.splits).toHaveLength(2);
    expect(run.record.splits[0]!.seconds).toBeCloseTo(315, 5); expect(run.record.splits[1]!.seconds).toBeCloseTo(315, 5);
  });
  it.each([[300, 'slowDown'], [330, 'speedUp']] as const)('emits correct alert from simulated GPS at %i s/km', (value, expected) => {
    const run = engine(); const cues = feed(run, 0, 60, value);
    expect(cues.length).toBeGreaterThan(0); expect(cues.every(cue => cue === expected)).toBe(true);
  });
  it('rejects a GPS jump without adding distance or a false alert', () => {
    const run = engine(); feed(run, 0, 30); const before = run.record.distanceMeters;
    expect(run.process(fix(31, 315, { latitude: 49 }), 31, start + 31000)).toBeNull();
    expect(run.record.distanceMeters).toBe(before); expect(run.currentPace).toBeNull();
    expect(run.quality).toBe('poor'); expect(feed(run, 32, 60)).toEqual([]);
  });
  it('rejects inaccurate, stale, and invalid coordinate samples', () => {
    const run = engine();
    expect(run.process(fix(0, 315, { accuracy: 100 }), 0, start)).toBeNull();
    expect(run.process(fix(1), 30, start + 30000)).toBeNull();
    expect(run.process(fix(31, 315, { latitude: NaN }), 31, start + 31000)).toBeNull();
    expect(run.record.points).toHaveLength(0);
  });
  it('freezes active time and alerts on pause and never joins the paused route', () => {
    const run = engine(); feed(run, 0, 30); const before = run.record.distanceMeters;
    run.pause(30); expect(feed(run, 31, 80, 300)).toEqual([]); run.tick(80, start + 80000);
    expect(run.record.activeSeconds).toBe(30); expect(run.record.distanceMeters).toBe(before);
    run.resume(80); feed(run, 81, 100);
    expect(run.record.activeSeconds).toBe(50); expect(run.record.distanceMeters - before).toBeCloseTo(19 * 1000 / 315, 5);
    expect(run.record.points[0]!.segment).not.toBe(run.record.points.at(-1)!.segment);
  });
  it('excludes signal gaps from distance and the reliable denominator', () => {
    const run = engine(); feed(run, 0, 30);
    const meters = run.record.distanceMeters, reliable = run.record.reliableSeconds;
    run.tick(50, start + 50000); expect(run.quality).toBe('stale'); expect(run.currentPace).toBeNull();
    feed(run, 60, 60); expect(run.record.distanceMeters).toBe(meters);
    expect(run.record.reliableSeconds).toBe(reliable);
  });
  it('works when reported speed is unavailable', () => {
    const run = engine();
    for (let t = 0; t <= 40; t++) run.process(fix(t, 315, { speed: null }), t, start + t * 1000);
    expect(run.currentPace).toBeCloseTo(315, 5);
  });
  it('does not accumulate stationary GPS drift', () => {
    const run = engine();
    for (let t = 0; t <= 50; t++) expect(run.process(fix(t, 315, { latitude: 48 + (t % 2 ? 0.00001 : 0), speed: 0 }), t, start + t * 1000)).toBeNull();
    expect(run.record.distanceMeters).toBe(0); expect(targetPercentage(run.record)).toBeNull(); expect(run.record.bestPace).toBeNull();
  });
  it('roundtrips an interrupted run, restores PAUSED, and finalizes route and partial split', () => {
    const run = engine(); feed(run, 0, 400); run.pause(400);
    const record = JSON.parse(JSON.stringify(run.record)); const restored = RunEngine.restore(record);
    restored.tick(10000, start + 10000000);
    expect(restored.running).toBe(false); expect(restored.record.activeSeconds).toBe(400);
    expect({ ...restored.record, totalSeconds: record.totalSeconds }).toEqual(record);
    expect(restored.record.totalSeconds).toBe(10400); expect(allSplits(restored.record)).toHaveLength(2);
    expect(allSplits(restored.record)[1]!.complete).toBe(false);
    expect(restored.finish(start + 500000).points).toEqual(record.points);
  });
  it('clears old pace after silence without new GPS callbacks', () => {
    const run = engine(); feed(run, 0, 60); expect(run.currentPace).not.toBeNull();
    run.tick(70, start + 70000); expect(run.currentPace).toBeNull(); expect(run.state).toBe('unreliable');
  });
});
describe('active monotonic clock', () => {
  it('supports idempotent pause/resume and ignores wall-clock changes', () => {
    const clock = new ActiveClock(); expect(clock.elapsed(100)).toBe(0);
    clock.resume(100); clock.resume(110); expect(clock.elapsed(120)).toBe(20);
    clock.pause(130); clock.pause(140); expect(clock.elapsed(900)).toBe(30);
    clock.resume(1000); expect(clock.elapsed(1010)).toBe(40);
  });
});
