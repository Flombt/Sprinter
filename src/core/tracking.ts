import { CoachConfig, GPSFix } from './types';
import { distance, usableSpeed } from './geo';

export type FilteredFix = { kind: 'accepted'; fix: GPSFix; meters: number; gap: boolean; moving: boolean; acquiredSeconds?: number }
  | { kind: 'ignored' } | { kind: 'rejected' };
const radians = Math.PI / 180, radius = 6371000;
/** Horizontal, constant-velocity alpha/beta filter. No platform, timers, network, or altitude distance. */
export class HorizontalTracker {
  private last: GPSFix | null = null;
  private origin: GPSFix | null = null;
  private position = { x: 0, y: 0 }; private velocity = { x: 0, y: 0 };
  private moving = false; private recent: GPSFix[] = [];
  constructor(private config: CoachConfig) {}
  reset() { this.last = null; this.origin = null; this.position = { x: 0, y: 0 }; this.velocity = { x: 0, y: 0 }; this.moving = false; this.recent = []; }
  private xy(fix: GPSFix) {
    let longitude = fix.longitude - this.origin!.longitude;
    if (longitude > 180) longitude -= 360; if (longitude < -180) longitude += 360;
    return { x: longitude * radians * radius * Math.cos(this.origin!.latitude * radians), y: (fix.latitude - this.origin!.latitude) * radians * radius };
  }
  private coordinates(fix: GPSFix): GPSFix {
    const longitude = this.origin!.longitude + this.position.x / (radius * Math.max(.00001, Math.cos(this.origin!.latitude * radians))) / radians;
    return { ...fix, latitude: this.origin!.latitude + this.position.y / radius / radians, longitude: ((longitude + 540) % 360) - 180 };
  }
  process(fix: GPSFix, receivedAt: number): FilteredFix {
    // An old callback must not invalidate a newer, healthy pace or reset its filter.
    if (this.last && Number.isFinite(fix.timestamp) && fix.timestamp <= this.last.timestamp) return { kind: 'ignored' };
    const c = this.config, age = (receivedAt - fix.timestamp) / 1000;
    if (![fix.latitude, fix.longitude, fix.accuracy, fix.timestamp, age].every(Number.isFinite) ||
        Math.abs(fix.latitude) > 90 || Math.abs(fix.longitude) > 180 || fix.accuracy < 0 || fix.accuracy > c.maximumAccuracy ||
        age < -1 || age > c.maximumSampleAge) return { kind: 'rejected' };
    const speed = usableSpeed(fix);
    if (speed !== null && speed > c.maximumSpeed) return { kind: 'rejected' };
    const previous = this.last, dt = previous ? (fix.timestamp - previous.timestamp) / 1000 : 0;
    const gap = !!previous && dt > c.maximumGap;
    if (!previous || gap) {
      this.reset(); this.last = { ...fix }; this.origin = { ...fix }; this.recent = [{ ...fix }];
      return { kind: 'accepted', fix: { ...fix }, meters: 0, moving: false, gap };
    }
    const rawStep = distance(previous, fix);
    if (rawStep / dt > c.maximumSpeed) return { kind: 'rejected' };
    const observed = this.xy(fix);
    const predicted = { x: this.position.x + this.velocity.x * dt, y: this.position.y + this.velocity.y * dt };
    const residual = Math.hypot(observed.x - predicted.x, observed.y - predicted.y);
    const stepLimit = Math.max(6, speed !== null ? speed * dt * 1.8 : Math.max(fix.accuracy * 1.5, (Math.hypot(this.velocity.x, this.velocity.y) * 2 + 3) * dt));
    if (this.moving && residual > Math.max(6, Math.max(previous.accuracy, fix.accuracy) * 1.5) && rawStep > stepLimit) return { kind: 'rejected' };
    const recent = [...this.recent, { ...fix }].filter(p => fix.timestamp - p.timestamp <= 8000);
    const first = recent[0]!;
    const quiet = fix.timestamp - first.timestamp >= 4000 && distance(first, fix) <= Math.max(3, fix.accuracy) &&
      recent.every(p => distance(first, p) <= Math.max(4, fix.accuracy * 1.5));
    if ((speed !== null && speed < .4) || (speed === null && quiet)) {
      // Rebase rather than summing jitter or integrating predicted motion while stationary.
      this.last = { ...fix }; this.origin = { ...fix }; this.position = { x: 0, y: 0 }; this.velocity = { x: 0, y: 0 };
      this.moving = false; this.recent = recent;
      return { kind: 'accepted', fix: { ...fix }, meters: 0, moving: false, gap: false };
    }
    let meters = 0, acquiredSeconds: number | undefined;
    if (!this.moving) {
      // At least two consistent steps beyond the uncertainty radius are required for acquisition.
      const a = this.recent.at(-2), b = this.recent.at(-1);
      const total = Math.hypot(observed.x, observed.y);
      const threshold = speed !== null && speed >= .8 ? Math.max(2, fix.accuracy * .5) : Math.max(6, fix.accuracy * 1.5);
      let consistent = false;
      if (a && b) {
        const p = this.xy(a), q = this.xy(b), ux = q.x - p.x, uy = q.y - p.y, vx = observed.x - q.x, vy = observed.y - q.y;
        consistent = ux * vx + uy * vy > .25 * Math.hypot(ux, uy) * Math.hypot(vx, vy);
      }
      const seconds = (fix.timestamp - this.origin!.timestamp) / 1000;
      if (consistent && total >= threshold && seconds > 0 && total / seconds >= .5) {
        this.moving = true; this.position = observed; this.velocity = { x: observed.x / seconds, y: observed.y / seconds }; meters = total; acquiredSeconds = seconds;
      }
    } else {
      const alpha = Math.max(.2, Math.min(.65, dt / (dt + Math.max(1, fix.accuracy * .35))));
      const next = { x: predicted.x + alpha * (observed.x - predicted.x), y: predicted.y + alpha * (observed.y - predicted.y) };
      const velocity = { x: this.velocity.x + .08 / dt * (observed.x - predicted.x), y: this.velocity.y + .08 / dt * (observed.y - predicted.y) };
      meters = Math.hypot(next.x - this.position.x, next.y - this.position.y);
      if (meters / dt > c.maximumSpeed) return { kind: 'rejected' };
      // Commit both state vectors only after the sample passes every speed gate.
      this.position = next; this.velocity = velocity;
    }
    this.last = { ...fix }; this.recent = recent;
    const filtered = this.coordinates(fix);
    if (Math.hypot(this.position.x, this.position.y) >= 1000) { this.origin = filtered; this.position = { x: 0, y: 0 }; }
    return { kind: 'accepted', fix: filtered, meters, moving: this.moving, gap: false, acquiredSeconds };
  }
}
