import type { GPSFix, SignalQuality } from '../core/types';

export function recentMapFix(fix: GPSFix | undefined, quality: SignalQuality, now: number): GPSFix | undefined {
  if ((quality === 'good' || quality === 'stationary') && fix && now - fix.timestamp < 8000) return fix;
  return undefined;
}
