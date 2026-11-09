import { describe, expect, it } from 'vitest';
import { RunEngine, distance } from '../src/core/engine';
import { DEFAULT_CONFIG, DEFAULT_TARGET, GPSFix } from '../src/core/types';
import { averagePace } from '../src/core/format';
import { ElevationTracker } from '../src/core/elevation';
import { AutoPauseDetector } from '../src/core/autoPause';
import { newWorkout, validWorkoutSnapshot, workoutStatistics } from '../src/workouts/definition';
import { createTemplate } from '../src/workouts/templates';

const epoch = 1800000000000, deg = 180 / Math.PI / 6371000;
function point(t: number, north: number, east = 0, extra: Partial<GPSFix> = {}): GPSFix {
  return { latitude: 48 + north * deg, longitude: 2 + east * deg / Math.cos(48 * Math.PI / 180),
    timestamp: epoch + t * 1000, accuracy: 4, speed: 1000 / 315, ...extra };
}
const runner = (auto = false) => new RunEngine(DEFAULT_TARGET, DEFAULT_CONFIG, 0, epoch, 'simulated', undefined, { autoPauseEnabled: auto });
const feed = (run: RunEngine, from: number, to: number, position: (t: number) => GPSFix) => {
  for (let t = from; t <= to; t++) run.process(position(t), t, epoch + t * 1000);
};
describe('tracking robustness on simulated GPS routes', () => {
  it('keeps a noisy straight route within 5% and reduces raw GPS distance inflation', () => {
    let seed = 12345; const noise = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return (seed / 4294967296 - .5) * 4; };
    const run = runner(); let raw = 0, previous: GPSFix | null = null;
    feed(run, 0, 630, t => { const fix = point(t, t * 1000 / 315 + noise(), noise()); if (previous) raw += distance(previous, fix); previous = fix; return fix; });
    expect(Math.abs(run.record.distanceMeters - 2000)).toBeLessThan(100);
    expect(run.record.distanceMeters).toBeLessThan(raw * .95);
    expect(run.currentPace).toBeGreaterThan(290); expect(run.currentPace).toBeLessThan(340);
  });
  it('does not turn oscillating GPS positions into a stationary run when speed is unavailable', () => {
    const run = runner(); feed(run, 0, 120, t => point(t, t === 0 ? 0 : t % 2 ? 5 : -5, 0, { speed: null }));
    expect(run.record.distanceMeters).toBe(0); expect(run.currentPace).toBeNull(); expect(run.record.bestPace).toBeNull();
  });
  it('handles real right-angle turns without starving the filter or bridging GPS gaps', () => {
    const run = runner();
    feed(run, 0, 160, t => {
      const side = Math.min(3, Math.floor(t / 40)), p = (t - side * 40) * 2.5;
      return side === 0 ? point(t, p, 0, { speed: 2.5 }) : side === 1 ? point(t, 100, p, { speed: 2.5 })
        : side === 2 ? point(t, 100 - p, 100, { speed: 2.5 }) : point(t, 0, 100 - p, { speed: 2.5 });
    });
    expect(run.record.distanceMeters).toBeGreaterThan(380); expect(run.record.distanceMeters).toBeLessThan(420);
    expect(new Set(run.record.points.map(p => p.segment)).size).toBe(1);
  });
  it('ignores duplicate and out-of-order callbacks without invalidating a good pace', () => {
    const run = runner(); feed(run, 0, 30, t => point(t, t * 1000 / 315)); const meters = run.record.distanceMeters, pace = run.currentPace;
    run.process(point(20, 999, 0, { accuracy: 100 }), 20, epoch + 30000);
    run.process(point(30, 999), 30, epoch + 30000);
    expect(run.record.distanceMeters).toBe(meters); expect(run.currentPace).toBe(pace); expect(run.quality).toBe('good');
  });
  it('never joins an accepted point to a teleport after a prolonged bad-signal interval', () => {
    const run = runner(); feed(run, 0, 20, t => point(t, t * 3)); const before = run.record.distanceMeters;
    feed(run, 21, 40, t => point(t, 2000, 0, { accuracy: 100 }));
    run.process(point(41, 2000), 41, epoch + 41000);
    expect(run.record.distanceMeters).toBe(before); expect(run.currentPace).toBeNull();
    expect(run.record.points.at(-1)!.segment).toBeGreaterThan(run.record.points[0]!.segment);
  });
  it('rebases after a wall-clock correction while monotonic time remains correct', () => {
    const run = runner(); feed(run, 0, 20, t => point(t, t * 3)); const meters = run.record.distanceMeters;
    run.tick(21, epoch - 3600000 + 21000);
    const shifted = { ...point(22, 500), timestamp: epoch - 3600000 + 22000 };
    run.process(shifted, 22, shifted.timestamp);
    expect(run.record.activeSeconds).toBe(22); expect(run.record.totalSeconds).toBe(22); expect(run.record.distanceMeters).toBe(meters);
  });
  it('separates total time and active time, excluding movement during a manual pause', () => {
    const run = runner(); feed(run, 0, 20, t => point(t, t * 3)); const meters = run.record.distanceMeters;
    run.pause(20); run.tick(80, epoch + 80000);
    expect(run.record.activeSeconds).toBe(20); expect(run.record.totalSeconds).toBe(80);
    run.resume(80); run.process(point(79, 500), 79, epoch + 80000); // queued before resumption
    expect(run.record.points.at(-1)!.activeSeconds).toBe(20);
    feed(run, 81, 101, t => point(t, 500 + (t - 81) * 3));
    expect(run.record.activeSeconds).toBe(41); expect(run.record.totalSeconds).toBe(101);
    expect(run.record.distanceMeters - meters).toBeCloseTo(60, 4);
  });
  it('includes estimated interruption only in total time on recovery, and resumes from a new GPS origin', () => {
    const run = runner(); feed(run, 0, 30, t => point(t, t * 3));
    const restored = RunEngine.restore(run.record, 100, 600);
    restored.tick(110, epoch + 700000);
    expect(restored.running).toBe(false); expect(restored.tracking).toBe(false);
    expect(restored.record.activeSeconds).toBe(30); expect(restored.record.totalSeconds).toBe(640); expect(restored.record.totalEstimated).toBe(true);
    restored.resume(110); restored.process(point(111, 1000), 111, epoch + 111000);
    expect(restored.record.distanceMeters).toBe(run.record.distanceMeters);
  });
  it('does not mutate an already finalized value if the recoverable engine is resumed', () => {
    const run = runner(); feed(run, 0, 20, t => point(t, t * 3)); run.pause(20); const saved = run.finish(epoch + 20000), count = saved.points.length;
    run.resume(30); feed(run, 31, 40, t => point(t, t * 3)); expect(saved.points).toHaveLength(count);
  });
});
describe('optional automatic pause', () => {
  const stopRoute = (t: number) => point(t, Math.min(20, t) * 3, 0, { speed: t > 20 ? 0 : 3 });
  it('pauses after confirmed stationary fixes and resumes without counting movement during the pause', () => {
    const run = runner(true); feed(run, 0, 35, stopRoute);
    expect(run.autoPaused).toBe(true); expect(run.tracking).toBe(true); expect(run.running).toBe(false);
    const active = run.record.activeSeconds, meters = run.record.distanceMeters;
    run.tick(45, epoch + 45000); expect(run.record.activeSeconds).toBe(active); expect(run.record.totalSeconds).toBe(45);
    feed(run, 46, 65, t => point(t, 1000 + (t - 46) * 3, 0, { speed: 3 }));
    expect(run.running).toBe(true); expect(run.autoPaused).toBe(false); expect(run.record.autoPauseCount).toBe(1);
    expect(run.record.distanceMeters - meters).toBeLessThan(60); expect(run.record.distanceMeters - meters).toBeGreaterThan(30);
    expect(averagePace(run.record)).not.toBeNull();
  });
  it('leaves the active timer running at stops when auto-pause is disabled', () => {
    const run = runner(); feed(run, 0, 35, stopRoute); expect(run.running).toBe(true); expect(run.autoPaused).toBe(false); expect(run.record.activeSeconds).toBe(35);
  });
  it('does not interpret GPS loss or imprecise stationary fixes as an automatic pause', () => {
    const run = runner(true); feed(run, 0, 20, t => point(t, t * 3)); run.tick(60, epoch + 60000);
    expect(run.running).toBe(true); expect(run.autoPaused).toBe(false);
    feed(run, 61, 90, t => point(t, 60, 0, { speed: 0, accuracy: 20 }));
    expect(run.running).toBe(true); expect(run.autoPaused).toBe(false);
  });
  it('requires a longer observation and bounded displacement without reported speed', () => {
    const detector = new AutoPauseDetector(); let decision: string | null = null;
    for (let t = 0; t <= 9; t++) expect(detector.update(point(t, 0, 0, { speed: null }), false)).toBeNull();
    decision = detector.update(point(10, 0, 0, { speed: null }), false); expect(decision).toBe('pause');
  });
  it('a manual pause during auto-pause disables automatic resumption', () => {
    const run = runner(true); feed(run, 0, 35, stopRoute); expect(run.autoPaused).toBe(true); run.pause(35);
    feed(run, 36, 60, t => point(t, t * 3)); expect(run.tracking).toBe(false); expect(run.running).toBe(false); expect(run.autoPaused).toBe(false);
  });
});
describe('reliable GPS altitude and elevation', () => {
  it('does not turn flat-course vertical noise into elevation gain', () => {
    const run = runner(); feed(run, 0, 120, t => point(t, t * 3, 0, { altitude: 100 + Math.sin(t) * 1.2, altitudeAccuracy: 2 }));
    expect(run.record.ascentMeters).toBe(0); expect(run.record.descentMeters).toBe(0); expect(run.record.elevationReliableSeconds).toBeGreaterThan(100);
    expect(run.record.points.at(-1)!.altitude).not.toBeNull();
  });
  it('records a conservative climb and descent while rejecting a vertical spike', () => {
    const run = runner(); feed(run, 0, 220, t => point(t, t * 3, 0, { altitude: t <= 110 ? 100 + t * .2 : 122 - (t - 110) * .2, altitudeAccuracy: 2 }));
    expect(run.record.ascentMeters).toBeGreaterThan(16); expect(run.record.ascentMeters).toBeLessThan(23);
    expect(run.record.descentMeters).toBeGreaterThan(15); expect(run.record.descentMeters).toBeLessThan(23);
    const before = run.record.ascentMeters; run.process(point(221, 663, 0, { altitude: 2000, altitudeAccuracy: 1 }), 221, epoch + 221000);
    expect(run.record.ascentMeters).toBe(before); expect(run.altitude).toBeNull();
  });
  it.each([null, -1, 20, NaN])('ignores altitude with unusable vertical accuracy %s', accuracy => {
    const run = runner(); feed(run, 0, 40, t => point(t, t * 3, 0, { altitude: t * 2, altitudeAccuracy: accuracy }));
    expect(run.record.ascentMeters).toBe(0); expect(run.record.elevationReliableSeconds).toBe(0); expect(run.altitude).toBeNull();
  });
  it('never joins elevation across a signal gap or accumulates weather drift at rest', () => {
    const tracker = new ElevationTracker(); let ascent = 0;
    for (let t = 0; t <= 60; t++) ascent += tracker.update(point(t, 0, 0, { altitude: 100 + t * .2, altitudeAccuracy: 2 }), false).ascent;
    expect(ascent).toBe(0); tracker.reset();
    for (let t = 100; t <= 110; t++) ascent += tracker.update(point(t, 0, 0, { altitude: 500, altitudeAccuracy: 2 }), true).ascent;
    expect(ascent).toBe(0);
  });
});
describe('workout integration with the improved recording engine', () => {
  it('evaluates short intervals on their elapsed distance rather than instantaneous pace', () => {
    const definition = createTemplate('intervals');
    if (definition.blocks[0]?.kind === 'segment') definition.blocks[0].end = { kind: 'duration', value: 5 };
    const group = definition.blocks[1];
    if (group?.kind === 'repeat') {
      group.count = 2;
      if (group.blocks[0]?.kind === 'segment') { group.blocks[0].end = { kind: 'distance', value: 20 }; group.blocks[0].target = { fast: 300, slow: 330 }; }
      if (group.blocks[1]?.kind === 'segment') group.blocks[1].end = { kind: 'duration', value: 5 };
    }
    if (definition.blocks[2]?.kind === 'segment') definition.blocks[2].end = { kind: 'duration', value: 5 };
    const run = runner(); run.attachWorkout(definition); feed(run, 0, 45, t => point(t, t * 1000 / 315));
    const workout = run.record.workout!;
    expect(workout.status).toBe('completed'); expect(workout.challengeStatus).toBe('succeeded'); expect(run.running).toBe(true);
    expect(workoutStatistics(workout).elapsed).toBeCloseTo(32.6, 4); expect(validWorkoutSnapshot(workout)).toBe(true);
    expect(workout.segments.filter(s => s.planned.effort === 'effort').every(s => s.outcome === 'succeeded')).toBe(true);
  });
  it('freezes both workout and active clocks on automatic pause, preserving a restorable snapshot', () => {
    const definition = newWorkout(); const run = runner(true); run.attachWorkout(definition);
    feed(run, 0, 35, t => point(t, Math.min(20, t) * 3, 0, { speed: t > 20 ? 0 : 3 }));
    const seconds = run.record.workout!.lastSeconds; run.tick(40, epoch + 40000);
    expect(run.record.workout!.status).toBe('paused'); expect(run.record.workout!.lastSeconds).toBe(seconds);
    expect(validWorkoutSnapshot(run.record.workout!)).toBe(true);
    const restored = RunEngine.restore(run.record); expect(restored.record.workout!.status).toBe('paused');
  });
});
