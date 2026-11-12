import { describe, expect, it } from 'vitest';
import { paceGaugePosition } from '../src/ui/paceGaugePosition';

describe('pace gauge position', () => {
  it('matches whole-second exact targets without applying a tolerance', () => {
    const target = { fast: 300, slow: 300 };
    expect(paceGaugePosition(300.49, target, 12)).toEqual({ start: .5, end: .5, cursor: .5 });
    expect(paceGaugePosition(299.49, target, 12).cursor).toBeLessThan(.5);
    expect(paceGaugePosition(300.5, target, 12).cursor).toBeGreaterThan(.5);
  });

  it('shows the tolerated range and bounds measurements at both ends of the rail', () => {
    const target = { fast: 310, slow: 320 };
    const lower = paceGaugePosition(305, target, 5);
    const upper = paceGaugePosition(325, target, 5);
    expect(lower.cursor).toBe(lower.start);
    expect(upper.cursor).toBe(upper.end);
    expect(paceGaugePosition(120, target, 5).cursor).toBe(0);
    expect(paceGaugePosition(900, target, 5).cursor).toBe(1);
  });

  it('omits the cursor when there is no valid measurement', () => {
    const target = { fast: 310, slow: 320 };
    expect(paceGaugePosition(null, target, 0).cursor).toBeNull();
    expect(paceGaugePosition(Number.NaN, target, 0).cursor).toBeNull();
  });
});
