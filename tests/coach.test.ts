import { describe, it, expect } from 'vitest';
import { PaceCoach, sanitizeConfig } from '../src/core/coach';
import { DEFAULT_CONFIG, DEFAULT_TARGET } from '../src/core/types';
import { duration, pace, estimatedDuration, validateTarget } from '../src/core/format';

describe('pace coach', () => {
  it('never alerts between 5′10 and 5′20', () => {
    const coach = new PaceCoach(DEFAULT_TARGET);
    for (let t = 0; t < 300; t++) expect(coach.update(310 + t % 11, t)).toBeNull();
    expect(coach.state).toBe('onTarget');
  });
  it.each([[300, 'slowDown'], [330, 'speedUp']] as const)('confirms sustained %i s/km after ten seconds', (value, cue) => {
    const coach = new PaceCoach(DEFAULT_TARGET);
    for (let t = 0; t < 10; t++) expect(coach.update(value, t)).toBeNull();
    expect(coach.update(value, 10)).toBe(cue);
  });
  it('respects global cooldown and stops immediately on return', () => {
    const coach = new PaceCoach(DEFAULT_TARGET); const times: number[] = [];
    for (let t = 0; t < 150; t++) if (coach.update(t < 75 ? 300 : 315, t)) times.push(t);
    expect(times).toEqual([10, 40, 70]); expect(coach.state).toBe('onTarget');
  });
  it('does not alert for brief variations', () => {
    const coach = new PaceCoach(DEFAULT_TARGET);
    for (let t = 0; t < 120; t++) expect(coach.update(t % 10 < 8 ? 300 : 315, t)).toBeNull();
  });
  it('restarts confirmation after GPS loss', () => {
    const coach = new PaceCoach(DEFAULT_TARGET);
    for (let t = 0; t <= 8; t++) expect(coach.update(300, t)).toBeNull();
    for (let t = 30; t < 40; t++) expect(coach.update(300, t)).toBeNull();
    expect(coach.update(300, 40)).toBe('slowDown');
  });
  it('invalid samples and pauses clear pending alerts', () => {
    const coach = new PaceCoach(DEFAULT_TARGET);
    for (let t = 0; t <= 8; t++) coach.update(300, t);
    expect(coach.update(NaN, 9)).toBeNull(); coach.invalidate(true);
    expect(coach.state).toBe('paused'); expect(coach.update(300, 100)).toBeNull();
  });
  it('applies entry hysteresis and immediate recovery inside target', () => {
    const coach = new PaceCoach(DEFAULT_TARGET);
    for (let t = 0; t < 60; t++) expect(coach.update(t % 2 ? 309 : 321, t)).toBeNull();
    for (let t = 60; t <= 70; t++) coach.update(300, t);
    expect(coach.state).toBe('tooFast'); expect(coach.update(310, 71)).toBeNull();
    expect(coach.state).toBe('onTarget');
  });
  it('ignores duplicate and out-of-order samples', () => {
    const coach = new PaceCoach(DEFAULT_TARGET); coach.update(300, 10);
    expect(coach.update(300, 9)).toBeNull(); expect(coach.update(300, 10)).toBeNull();
  });
});
describe('units and configuration', () => {
  it('validates pace direction, finite numbers, and distances', () => {
    expect(validateTarget(DEFAULT_TARGET)).toBeNull();
    for (const target of [{ fast: 320, slow: 310, distanceMeters: null },
      { fast: NaN, slow: 320, distanceMeters: null }, { ...DEFAULT_TARGET, distanceMeters: -1 }]) {
      expect(validateTarget(target)).not.toBeNull();
    }
  });
  it('only estimates a finish time when a distance exists', () => {
    expect(estimatedDuration(DEFAULT_TARGET)).toBeNull();
    expect(estimatedDuration({ ...DEFAULT_TARGET, distanceMeters: 10000 })).toEqual([3100, 3200]);
  });
  it('formats carry and hour boundaries', () => {
    expect(pace(319.6)).toBe('5′20″'); expect(pace(359.8)).toBe('6′00″');
    expect(pace(null)).toBe('—'); expect(duration(3661)).toBe('1:01:01');
    expect(duration(-1)).toBe('0:00');
  });
  it('sanitizes persisted settings', () => {
    const config = sanitizeConfig({ ...DEFAULT_CONFIG, repeatSeconds: 0, smoothingSeconds: 0, confirmationSeconds: NaN });
    expect(config.repeatSeconds).toBe(10); expect(config.confirmationSeconds).toBe(10);
    expect(config.minimumWindowSeconds).toBeLessThanOrEqual(config.smoothingSeconds);
  });
});
