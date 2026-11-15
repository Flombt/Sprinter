export type UpdateStatus = 'idle' | 'checking' | 'downloading' | 'ready' | 'deferred' | 'failed';
export type UpdateDeferral = 'startup' | 'session' | 'storage' | 'background' | 'network';
export type UpdateFailure = 'check' | 'download' | 'timeout';

export interface UpdateState {
  status: UpdateStatus;
  deferred: UpdateDeferral | null;
  error: UpdateFailure | null;
}

export interface UpdateSafety {
  ready: boolean;
  loading: boolean;
  busy: boolean;
  run: unknown | null;
  recoveryBlocked?: boolean;
  foreground: boolean;
  online: boolean;
}

export interface UpdateInfo {
  version: string;
  build: string | null;
  enabled: boolean;
  channel: string | null;
  runtime: string | null;
  updateId: string | null;
  createdAt: string | null;
  embedded: boolean;
  emergency: boolean;
}

interface UpdateDependencies {
  enabled: () => boolean;
  safety: () => UpdateSafety;
  check: () => Promise<{ isAvailable: boolean; isRollBackToEmbedded?: boolean }>;
  fetch: () => Promise<{ isNew: boolean; isRollBackToEmbedded?: boolean }>;
  report: (error: UpdateFailure) => void;
  now?: () => number;
}

const CHECK_INTERVAL = 6 * 60 * 60 * 1000;
const RETRY_INTERVAL = 15 * 60 * 1000;

/** Downloads through Expo only. Activation belongs to the next native cold start; no reload API. */
export class UpdateManager {
  private value: UpdateState = { status: 'idle', deferred: null, error: null };
  private listeners = new Set<() => void>();
  private inFlight: Promise<void> | null = null;
  private nextCheck = -Infinity;
  private now: () => number;

  constructor(private deps: UpdateDependencies) {
    this.now = deps.now ?? Date.now;
  }

  getSnapshot = () => this.value;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  private emit(
    status: UpdateStatus,
    deferred: UpdateDeferral | null = null,
    error: UpdateFailure | null = null,
  ) {
    if (this.value.status === status && this.value.deferred === deferred && this.value.error === error)
      return;
    this.value = { status, deferred, error };
    for (const listener of this.listeners) {
      try {
        listener();
      } catch {
        /* Optional diagnostics cannot stop an OTA operation. */
      }
    }
  }

  private deferIfUnsafe() {
    const state = this.deps.safety();
    const reason: UpdateDeferral | null =
      !state.ready || state.loading
        ? 'startup'
        : state.run !== null || state.recoveryBlocked
          ? 'session'
          : state.busy
            ? 'storage'
            : !state.foreground
              ? 'background'
              : !state.online
                ? 'network'
                : null;
    if (reason) this.emit('deferred', reason);
    return reason !== null;
  }

  request = (): Promise<void> => {
    if (this.inFlight) return this.inFlight;
    if (!this.deps.enabled() || this.value.status === 'ready') return Promise.resolve();
    if (this.deferIfUnsafe() || this.now() < this.nextCheck) return Promise.resolve();
    // Defer execution so even a synchronous observer shares the same operation.
    const task = Promise.resolve()
      .then(() => this.perform())
      .finally(() => {
        if (this.inFlight === task) this.inFlight = null;
      });
    this.inFlight = task;
    return task;
  };

  private fail(error: UpdateFailure) {
    this.nextCheck = this.now() + RETRY_INTERVAL;
    this.emit('failed', null, error);
    // Only a fixed code leaves this service, never native errors/URLs or user data.
    try {
      this.deps.report(error);
    } catch {
      /* Logging is optional. */
    }
  }

  private async nativeCall<T>(operation: () => Promise<T>, timeout: number) {
    let expired = false;
    const timer = setTimeout(() => {
      expired = true;
      this.fail('timeout');
    }, timeout);
    // Expo has no cancellation API. Keep the lock until native work really settles,
    // even after the watchdog, so a timeout cannot create concurrent downloads.
    try {
      return { value: await operation(), expired };
    } finally {
      clearTimeout(timer);
    }
  }

  private async perform() {
    if (!this.deps.enabled() || this.deferIfUnsafe()) return;
    let stage: UpdateFailure = 'check';
    try {
      this.emit('checking');
      const checked = await this.nativeCall(this.deps.check, 30_000);
      if (checked.expired) return;
      if (!checked.value.isAvailable && !checked.value.isRollBackToEmbedded) {
        this.nextCheck = this.now() + CHECK_INTERVAL;
        this.emit('idle');
        return;
      }
      // A run or sensitive operation may have started while the request was pending.
      if (!this.deps.enabled() || this.deferIfUnsafe()) return;
      stage = 'download';
      this.emit('downloading');
      const fetched = await this.nativeCall(this.deps.fetch, 120_000);
      if (fetched.value.isNew || fetched.value.isRollBackToEmbedded) this.emit('ready');
      else if (!fetched.expired) {
        this.nextCheck = this.now() + CHECK_INTERVAL;
        this.emit('idle');
      }
    } catch {
      this.fail(stage);
    }
  }
}
