/** The series and track producers keep active time in ascending order. */
export function nearestTimeIndex<T>(
  samples: readonly T[],
  seconds: number,
  time: (sample: T) => number,
): number {
  let low = 0;
  let high = samples.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (time(samples[middle]!) < seconds) low = middle + 1;
    else high = middle;
  }
  if (low === 0) return samples.length === 0 ? -1 : 0;
  if (low === samples.length) return low - 1;
  return seconds - time(samples[low - 1]!) <= time(samples[low]!) - seconds ? low - 1 : low;
}
