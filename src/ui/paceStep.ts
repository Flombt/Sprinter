export function paceStep(value: number, direction: -1 | 1, heldForMilliseconds: number): number {
  const seconds = heldForMilliseconds >= 1500 ? 10 : 5;
  return Math.min(1200, Math.max(120, value + direction * seconds));
}
