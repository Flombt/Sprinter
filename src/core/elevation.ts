import { GPSFix } from './types';
/** Conservative GPS elevation: vertical precision gate, median, low-pass, then prominence hysteresis. */
export class ElevationTracker {
  current: number | null = null; private last: { time: number; altitude: number } | null = null;
  private samples: number[] = []; private anchor: number | null = null;
  reset() { this.current = null; this.last = null; this.samples = []; this.anchor = null; }
  update(fix: GPSFix, moving: boolean) {
    const zero = { ascent: 0, descent: 0, seconds: 0 };
    const altitude = fix.altitude, accuracy = fix.altitudeAccuracy;
    if (altitude == null || accuracy == null || !Number.isFinite(altitude) || !Number.isFinite(accuracy) || accuracy < 0 || accuracy > 8 || altitude < -500 || altitude > 9000) { this.reset(); return zero; }
    const dt = this.last ? (fix.timestamp - this.last.time) / 1000 : 0;
    if (this.last && (dt <= 0 || dt > 6 || Math.abs(altitude - this.last.altitude) / dt > 3)) { this.reset(); return zero; }
    this.last = { time: fix.timestamp, altitude }; this.samples = [...this.samples.slice(-4), altitude];
    if (this.samples.length < 3) return zero;
    const sorted = [...this.samples].sort((a, b) => a - b), median = sorted[Math.floor(sorted.length / 2)]!;
    this.current = this.current === null ? median : this.current + Math.min(1, dt / (4 + dt)) * (median - this.current);
    if (this.anchor === null || !moving) { this.anchor = this.current; return { ...zero, seconds: dt }; }
    const change = this.current - this.anchor, threshold = Math.max(3, accuracy * .75);
    if (Math.abs(change) < threshold) return { ...zero, seconds: dt };
    this.anchor = this.current;
    return { ascent: Math.max(0, change), descent: Math.max(0, -change), seconds: dt };
  }
}
