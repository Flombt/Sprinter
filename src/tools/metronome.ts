import { File, Directory, Paths } from 'expo-file-system';
import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import { audioSession } from '../services/audioSession';
/** A native loop contains eight precisely spaced clicks; JS never schedules individual beats. */
function clickWave(bpm: number): Uint8Array {
  const rate = 22050, samples = Math.round(rate * 60 / bpm * 8);
  const bytes = new Uint8Array(44 + samples * 2), view = new DataView(bytes.buffer);
  const text = (at: number, value: string) => { for (let i = 0; i < value.length; i++) bytes[at + i] = value.charCodeAt(i); };
  text(0, 'RIFF'); view.setUint32(4, 36 + samples * 2, true); text(8, 'WAVE'); text(12, 'fmt '); view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); view.setUint16(22, 1, true); view.setUint32(24, rate, true); view.setUint32(28, rate * 2, true);
  view.setUint16(32, 2, true); view.setUint16(34, 16, true); text(36, 'data'); view.setUint32(40, samples * 2, true);
  for (let beat = 0; beat < 8; beat++) {
    const start = Math.round(beat * rate * 60 / bpm), count = Math.round(rate * .018);
    for (let i = 0; i < count && start + i < samples; i++) {
      const envelope = Math.sin(Math.PI * i / count) ** 2 * Math.exp(-i / (rate * .006));
      view.setInt16(44 + (start + i) * 2, Math.round(11000 * envelope * Math.sin(2 * Math.PI * 1100 * i / rate)), true);
    }
  }
  return bytes;
}
export class Metronome {
  private player: AudioPlayer | null = null; private release: (() => Promise<void>) | null = null;
  private desired = false; private bpm = 170; private volume = .3; private loadedBpm = 0;
  private generation = 0; private queue: Promise<void> = Promise.resolve(); private failed = false;
  constructor(private onError: (message: string) => void) { audioSession.subscribe(() => this.reconcile()); }
  configure(enabled: boolean, bpm: number, volume: number) {
    if (enabled === this.desired && bpm === this.bpm && volume === this.volume) return;
    if (enabled !== this.desired || bpm !== this.bpm) this.failed = false;
    this.desired = enabled; this.bpm = bpm; this.volume = volume; this.reconcile();
  }
  private reconcile() {
    const generation = ++this.generation;
    const play = this.desired && !audioSession.coaching && !this.failed;
    if (!play) { try { this.player?.pause(); } catch {} }
    const task = this.queue.then(async () => {
      if (generation !== this.generation) return;
      if (!play) {
        const release = this.release; this.release = null;
        try { await release?.(); }
        finally { if (!this.desired) { this.player?.remove(); this.player = null; this.loadedBpm = 0; } }
        return;
      }
      try {
        if (this.loadedBpm !== this.bpm || !this.player) {
          this.player?.pause(); this.player?.remove(); this.player = null;
          const directory = new Directory(Paths.cache, 'sprinter-metronome'); directory.create({ idempotent: true, intermediates: true });
          const file = new File(directory, `tempo-${this.bpm}.wav`);
          if (!file.exists) { file.create({ overwrite: true }); file.write(clickWave(this.bpm)); }
          this.player = createAudioPlayer(file.uri); this.player.loop = true; this.loadedBpm = this.bpm;
        }
        if (!this.release) this.release = await audioSession.acquire('metronome');
        if (generation !== this.generation || audioSession.coaching || !this.desired) { this.player?.pause(); return; }
        this.player.volume = this.volume; this.player.play();
      } catch (error) {
        this.failed = true; this.player?.pause(); const release = this.release; this.release = null; await release?.().catch(() => undefined);
        this.onError(`Métronome indisponible : ${error instanceof Error ? error.message : String(error)}. La course continue.`);
      }
    });
    this.queue = task.catch(() => undefined);
  }
}
