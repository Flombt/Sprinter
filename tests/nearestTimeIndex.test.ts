import { expect, it } from 'vitest';
import { nearestTimeIndex } from '../src/ui/nearestTimeIndex';

it('sélectionne la mesure la plus proche même de part et d’autre d’une interruption', () => {
  const values = [2, 3, 30, 31].map(seconds => ({ seconds }));
  const time = (sample: { seconds: number }) => sample.seconds;
  expect(nearestTimeIndex(values, 0, time)).toBe(0);
  expect(nearestTimeIndex(values, 16.5, time)).toBe(1);
  expect(nearestTimeIndex(values, 26, time)).toBe(2);
  expect(nearestTimeIndex(values, 31, time)).toBe(3);
  expect(nearestTimeIndex(values, 40, time)).toBe(3);
  expect(nearestTimeIndex([], 15, time)).toBe(-1);
});
