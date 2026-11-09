import { GPSFix } from './types';
import { distance, usableSpeed } from './geo';
/** Decisions require fresh, precise observations; silence and poor GPS never mean a stop. */
export class AutoPauseDetector {
  private first: GPSFix | null = null; private last: GPSFix | null = null; private samples = 0;
  reset() { this.first = null; this.last = null; this.samples = 0; }
  update(fix: GPSFix, paused: boolean): 'pause' | 'resume' | null {
    if (fix.accuracy > 10 || (this.last && (fix.timestamp <= this.last.timestamp || fix.timestamp - this.last.timestamp > 6000))) { this.reset(); return null; }
    const speed = usableSpeed(fix), radius = Math.max(3, Math.min(5, fix.accuracy * .75));
    if (!this.first) { this.first = fix; this.samples = 0; }
    this.last = fix; this.samples++;
    const seconds = (fix.timestamp - this.first.timestamp) / 1000, moved = distance(this.first, fix);
    if (paused) {
      if (speed !== null && speed < .8) { this.first = fix; this.samples = 1; return null; }
      if (this.samples >= 3 && seconds >= 2 && moved >= radius) { this.reset(); return 'resume'; }
    } else {
      if ((speed !== null && speed > .5) || moved > radius) { this.first = fix; this.samples = 1; return null; }
      if (this.samples >= 4 && seconds >= (speed === null ? 10 : 5)) { this.reset(); return 'pause'; }
    }
    return null;
  }
}
