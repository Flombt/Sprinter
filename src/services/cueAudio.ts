import { AudioCue } from '../core/types';

export interface CuePlayer {
  seekTo(seconds: number): Promise<void>; play(): void; pause(): void;
  onFinish(listener: () => void): void;
}
export interface CueAudioBackend {
  activateDuck(): Promise<void | (() => Promise<void>)>; deactivate(): Promise<void>; create(cue: AudioCue): CuePlayer;
}
/** Owns only Sprinter's brief alert session, never Spotify playback or GPS. */
export class CueAudio {
  private players: Partial<Record<AudioCue, CuePlayer>> = {};
  private current: CuePlayer | null = null;
  private active = false;
  private releaseSession: (() => Promise<void>) | null = null;
  private generation = 0;
  private queue: Promise<void> = Promise.resolve();
  private expiry: ReturnType<typeof setTimeout> | null = null;
  constructor(private backend: CueAudioBackend) {}
  private operation(operation: () => Promise<void>) {
    const task = this.queue.then(operation); this.queue = task.catch(() => undefined); return task;
  }
  private release() {
    if (this.expiry) clearTimeout(this.expiry); this.expiry = null;
    this.current = null;
    if (!this.active) return;
    this.active = false;
    const release = this.releaseSession ?? (() => this.backend.deactivate()); this.releaseSession = null;
    // Bind cleanup to this activation. A newer cue may already be queued before cleanup runs.
    void this.operation(release).catch(() => undefined);
  }
  async play(cue: AudioCue) {
    this.stop(); const generation = ++this.generation;
    await this.operation(async () => {
      if (generation !== this.generation) return;
      try {
        const release = await this.backend.activateDuck();
        if (generation !== this.generation) {
          await (typeof release === 'function' ? release() : this.backend.deactivate()); return;
        }
        this.releaseSession = typeof release === 'function' ? release : null; this.active = true;
        let player = this.players[cue];
        if (!player) {
          player = this.backend.create(cue); this.players[cue] = player;
          const source = player;
          player.onFinish(() => { if (this.current === source) this.release(); });
        }
        await player.seekTo(0);
        if (generation === this.generation) {
          this.current = player;
          player.play();
          this.expiry = setTimeout(() => { if (generation === this.generation) this.stop(); }, 8000);
        } else this.release();
      } catch (error) {
        // Even a partially activated native session must relinquish ducking.
        this.active = true; this.release(); throw error;
      }
    });
  }
  stop() {
    this.generation++;
    for (const player of Object.values(this.players)) { try { player?.pause(); } catch {} }
    this.release();
  }
}
