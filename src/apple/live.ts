import { AppState } from 'react-native';
import { duration, km, pace } from '../core/format';
import type { SessionState } from '../services/session';
import type { LiveActivity } from 'expo-widgets';
import type { RunLiveProps } from './RunLiveActivity';
import { nativeApple } from './bridge';

/** Optional observer: never runs or resumes the location engine. No timers or background entitlement. */
export class RunLiveController {
  private activity: LiveActivity<RunLiveProps> | null = null;
  private factory: typeof import('./RunLiveActivity').default | null = null;
  private latest: SessionState | null = null;
  private enabled = false;
  private pending = false;
  private flushing = false;
  private lastAt = 0;
  private signature = '';
  private runId = '';
  private suppressed = '';
  private initialized = false;
  private retryAt = 0;
  get available() { return this.initialized; }
  constructor(private onError: (message: string) => void) {}
  async initialize() {
    if (!nativeApple) return;
    this.factory = (await import('./RunLiveActivity')).default;
    // A killed process has no live clock authority. Remove old instances; restored sessions stay paused.
    for (const activity of this.factory.getInstances()) await activity.end('immediate');
    this.initialized = true;
  }
  observe(state: SessionState, enabled: boolean) {
    if (enabled !== this.enabled) { this.suppressed = ''; this.signature = ''; }
    this.latest = state; this.enabled = enabled; this.pending = true;
    if (!this.flushing) void this.flush();
  }
  private async flush() {
    this.flushing = true;
    try {
      while (this.pending) {
        this.pending = false;
        if (!this.initialized || !this.factory || Date.now() < this.retryAt) continue;
        const state = this.latest!, run = state.run;
        const id = run?.id ?? '';
        if (id !== this.runId) {
          if (this.activity) await this.activity.end('immediate');
          this.activity = null; this.runId = id; this.signature = ''; this.lastAt = 0;
        }
        if (!this.enabled || !run) {
          if (this.activity) await this.activity.end('immediate');
          this.activity = null; continue;
        }
        if (this.suppressed === id) continue;
        if (!this.activity && (!state.running || state.restored || AppState.currentState !== 'active')) continue;
        const status = state.autoPaused ? 'Pause automatique' : !state.running ? 'En pause' : state.quality === 'good' ? 'Course en cours' : 'GPS en acquisition';
        const signature = `${id}:${status}`;
        const now = Date.now();
        if (this.activity && this.signature === signature && (!state.running || now - this.lastAt < 15000)) continue;
        // Query ActivityKit at the same cadence as content updates, rather than on every GPS/timer callback.
        if (this.activity && !this.factory.getInstances().some(a => a.getId() === this.activity!.getId())) {
          this.activity = null; this.suppressed = id; continue;
        }
        const props: RunLiveProps = { runId: id, running: state.running, capturedAt: now, expiresAt: now + 45000,
          activeSeconds: run.activeSeconds, elapsed: duration(run.activeSeconds), distance: km(run.distanceMeters),
          pace: state.running && state.quality === 'good' ? pace(state.pace) : '—', status };
        // An intentional pause has stable counters; it must not become a false interruption.
        const staleDate = state.running ? new Date(props.expiresAt) : undefined;
        if (!this.activity) this.activity = this.factory.start(props, 'sprinter://run', staleDate);
        else await this.activity.update(props, staleDate);
        this.signature = signature; this.lastAt = now;
      }
    } catch (error) {
      this.retryAt = Date.now() + 45000;
      this.suppressed = this.runId;
      this.onError(`Affichage verrouillé indisponible : ${error instanceof Error ? error.message : String(error)}`);
    } finally { this.flushing = false; }
  }
}
