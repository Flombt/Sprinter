import { setAudioModeAsync, setIsAudioActiveAsync } from 'expo-audio';
type AudioOwner = 'coach' | 'metronome';
/** Coordinates only Sprinter audio. Music apps remain outside this ownership model. */
class AudioSession {
  private owners = new Map<symbol, AudioOwner>(); private queue: Promise<void> = Promise.resolve();
  private listeners = new Set<() => void>();
  get coaching() { return [...this.owners.values()].includes('coach'); }
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private emit() { this.listeners.forEach(l => l()); }
  private reconcile() {
    const task = this.queue.then(async () => {
      if (!this.owners.size) { await setIsAudioActiveAsync(false); return; }
      await setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: true, allowsRecording: false,
        interruptionMode: this.coaching ? 'duckOthers' : 'mixWithOthers' });
      await setIsAudioActiveAsync(true);
    });
    this.queue = task.catch(() => undefined); return task;
  }
  async acquire(owner: AudioOwner): Promise<() => Promise<void>> {
    const token = Symbol(owner); this.owners.set(token, owner); this.emit();
    try { await this.reconcile(); }
    catch (error) { this.owners.delete(token); this.emit(); void this.reconcile().catch(() => undefined); throw error; }
    let released = false;
    return async () => { if (released) return; released = true; this.owners.delete(token); this.emit(); await this.reconcile(); };
  }
}
export const audioSession = new AudioSession();
