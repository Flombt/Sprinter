import type { PaceTarget } from '../core/types';

export function paceGaugePosition(value: number | null, target: Pick<PaceTarget, 'fast' | 'slow'>, tolerance: number) {
  const exact = target.fast === target.slow;
  const fast = exact ? Math.round(target.fast) : target.fast - tolerance;
  const slow = exact ? fast : target.slow + tolerance;
  const padding = Math.max(10, (slow - fast) / 3);
  const minimum = fast - padding;
  const span = slow + padding - minimum;
  const measured = exact && value !== null ? Math.round(value) : value;

  return {
    start: (fast - minimum) / span,
    end: (slow - minimum) / span,
    cursor: measured === null || !Number.isFinite(measured) ? null : Math.min(1, Math.max(0, (measured - minimum) / span)),
  };
}
