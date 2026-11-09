import type { GPSFix } from '../core/types';
import type { NavigationStatus, SavedRoute } from './types';
import { nearestTrace } from './geometry';
/** Pure proximity guide. No changes to sports distance, no routing service and no invented turns. */
export class TraceNavigator {
  private outsideSince: number | null = null; private insideSince: number | null = null;
  private off = false; private lastAt: number | null = null; private lastAlert = -Infinity;
  constructor(private route: SavedRoute, private threshold: number) {}
  interrupt() { this.outsideSince = null; this.insideSince = null; this.lastAt = null; }
  observe(fix: GPSFix, activeSeconds: number, receivedAt: number): NavigationStatus {
    if (!Number.isFinite(fix.accuracy) || fix.accuracy < 0 || fix.accuracy > Math.min(15, this.threshold / 3) || receivedAt - fix.timestamp > 8000 || fix.timestamp > receivedAt + 1000) { this.interrupt(); return { status: 'acquiring', distanceMeters: null }; }
    if (this.lastAt !== null && (fix.timestamp <= this.lastAt || fix.timestamp - this.lastAt > 8000)) this.interrupt();
    this.lastAt = fix.timestamp;
    const meters = nearestTrace(fix, this.route.segments); if (meters === null) return { status: 'unavailable', distanceMeters: null };
    let event: NavigationStatus['event'];
    // Accuracy margin, ten seconds of confirmation and a separate return threshold.
    if (meters - fix.accuracy > this.threshold) {
      this.insideSince = null; this.outsideSince ??= fix.timestamp;
      if (fix.timestamp - this.outsideSince >= 10000) {
        if ((!this.off || activeSeconds - this.lastAlert >= 90) && activeSeconds - this.lastAlert >= 60) { event = 'off'; this.lastAlert = activeSeconds; }
        this.off = true;
      }
    } else if (meters + fix.accuracy < Math.max(15, this.threshold * .6)) {
      this.outsideSince = null; this.insideSince ??= fix.timestamp;
      if (this.off && fix.timestamp - this.insideSince >= 5000) { this.off = false; event = 'back'; }
    } else { this.outsideSince = null; this.insideSince = null; }
    return { status: this.off ? 'offRoute' : 'onRoute', distanceMeters: meters, ...(event ? { event } : {}) };
  }
}
