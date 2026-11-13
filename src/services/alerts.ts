import { AppState, Vibration } from 'react-native';
import * as Haptics from 'expo-haptics';
import { createAudioPlayer } from 'expo-audio';
import { audioSession } from './audioSession';
import { AudioCue, Settings } from '../core/types';
import { CueAudio } from './cueAudio';

export type HapticPattern = 'default' | 'distance' | 'transition';
export interface AlertOutput { send(cue: AudioCue, settings: Settings, pattern?: HapticPattern): Promise<void>; stop(): void }
class DeviceAlerts implements AlertOutput {
  private pending: ReturnType<typeof setTimeout> | null = null;
  private generation = 0;
  private audio = new CueAudio({
    activateDuck: () => audioSession.acquire('coach'),
    deactivate: async () => {}, // Production activations return their own idempotent release function.
    create(cue) {
      const sources = { slowDown: require('../../assets/slowDown.wav'), speedUp: require('../../assets/speedUp.wav'),
        transition: require('../../assets/transition.wav'), success: require('../../assets/success.wav'), failure: require('../../assets/failure.wav') };
      const player = createAudioPlayer(sources[cue]);
      return { seekTo: seconds => player.seekTo(seconds), play: () => player.play(), pause: () => player.pause(),
        onFinish(listener) { player.addListener('playbackStatusUpdate', status => {
          // Ignore a delayed completion of the previous playback after this player was reset/reused.
          if (status.didJustFinish && !player.playing && player.duration > 0 && player.currentTime >= player.duration - .05) listener();
        }); } };
    },
  });
  async send(cue: AudioCue, settings: Settings, pattern: HapticPattern = 'default') {
    this.stop();
    const generation = ++this.generation;
    // Haptic APIs may be unavailable or suppressed by iOS; they must never prevent audio.
    const haptic = this.sendHaptic(cue, settings, generation, pattern).catch(() => undefined);
    const audio = settings.audioEnabled && generation === this.generation ? this.audio.play(cue) : Promise.resolve();
    await Promise.all([haptic, audio]);
  }
  private async sendHaptic(cue: AudioCue, settings: Settings, generation: number, pattern: HapticPattern) {
    if (settings.hapticsEnabled && AppState.currentState === 'active') {
      if (pattern === 'distance') await Haptics.selectionAsync();
      else if (pattern === 'transition') await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      else if (cue === 'slowDown') {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        if (generation === this.generation) this.pending = setTimeout(() => {
          if (generation === this.generation && AppState.currentState === 'active') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => undefined);
        }, 180);
      } else if (cue === 'speedUp') {
        // iOS defines the fixed system vibration duration (~400 ms); it is not a custom Core Haptics waveform.
        Vibration.vibrate();
      } else {
        await Haptics.notificationAsync(cue === 'success' ? Haptics.NotificationFeedbackType.Success
          : cue === 'failure' ? Haptics.NotificationFeedbackType.Error : Haptics.NotificationFeedbackType.Warning);
      }
    }
  }
  stop() {
    this.generation++;
    if (this.pending) clearTimeout(this.pending);
    this.pending = null; try { Vibration.cancel(); } catch {}
    this.audio.stop();
  }
}
export const alerts: AlertOutput = new DeviceAlerts();
