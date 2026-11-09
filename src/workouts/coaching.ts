import { AppState } from 'react-native';
import * as Speech from 'expo-speech';
import { AudioCue, Settings } from '../core/types';
import { alerts, HapticPattern } from '../services/alerts';
import { CoachingQueue } from './events';
import { CoachingEvent } from './types';
import { effectivePriority, eventCategory, sanitizeCoaching, terminalEvent } from '../coaching/config';
import { audioSession } from '../services/audioSession';

/** Single output arbiter; never controls the music player or the recording engine. */
class CoachingOutput {
  private queue = new CoachingQueue(); private current: CoachingEvent | null = null;
  private until = 0; private generation = 0;
  private timeout: ReturnType<typeof setTimeout> | null = null;
  private speechStop: Promise<unknown> = Promise.resolve();
  private voiceRelease: (() => Promise<void>) | null = null;
  private releaseVoice() { const release = this.voiceRelease; this.voiceRelease = null; void release?.().catch(() => undefined); }
  private stopOutput() {
    alerts.stop(); const release = this.voiceRelease; this.voiceRelease = null;
    this.speechStop = this.speechStop.catch(() => undefined).then(() => Speech.stop()).catch(() => undefined).then(() => release?.()).catch(() => undefined);
  }
  reset() { this.stop(); this.queue.reset(); }
  cancelNavigation() {
    this.queue.cancelNavigation();
    if (this.current && ['routeOff', 'routeBack'].includes(this.current.kind)) {
      this.generation++; this.current = null; this.until = 0; this.clearTimeout(); this.stopOutput();
    }
  }
  stop() { this.queue.clear(); this.generation++; this.current = null; this.until = 0; this.clearTimeout(); this.stopOutput(); }
  private clearTimeout() { if (this.timeout) clearTimeout(this.timeout); this.timeout = null; }
  cancelPace(includeRecovery = false) {
    this.queue.cancelPace(includeRecovery);
    if (this.current?.kind === 'paceDeviation' || (includeRecovery && this.current && ['paceRecovered', 'timeAhead', 'timeBehind', 'goalExpired', 'challengeWarning'].includes(this.current.kind))) {
      this.generation++; this.current = null; this.until = 0; this.clearTimeout(); this.stopOutput();
    }
  }
  pump(events: CoachingEvent[], now: number, segmentIndex: number, settings: Settings, voice: boolean, error: (message: string) => void) {
    if (AppState.currentState !== 'active' && AppState.currentState !== 'background') { this.stop(); return; }
    const config = sanitizeCoaching(settings.coaching);
    const allowed = events.filter(e => config.categories[eventCategory(e.kind)].enabled);
    this.queue.push(allowed, config);
    if (allowed.some(e => (terminalEvent(e) && effectivePriority(e, config) > (this.current ? effectivePriority(this.current, config) : 0)) || e.kind === 'workoutAbandoned' ||
        (e.kind === 'paceDeviation' && this.current?.kind === 'paceDeviation' && e.direction !== this.current.direction) ||
        (e.kind === 'paceRecovered' && this.current?.kind === 'paceDeviation') ||
        (['routeOff', 'routeBack'].includes(e.kind) && this.current && ['routeOff', 'routeBack'].includes(this.current.kind) && e.kind !== this.current.kind) ||
        (['timeAhead', 'timeBehind'].includes(e.kind) && this.current && ['timeAhead', 'timeBehind'].includes(this.current.kind) && e.kind !== this.current.kind) ||
        (e.kind === 'segmentStart' && this.current && e.segmentIndex > this.current.segmentIndex && this.current.priority < 90))) {
      this.generation++; this.current = null; this.clearTimeout(); this.stopOutput();
    }
    if (this.current && now < this.until) return;
    if (this.current && now >= this.until) { this.generation++; this.current = null; this.clearTimeout(); this.stopOutput(); }
    const event = this.queue.next(now, segmentIndex, config); if (!event) return;
    const queuedAt = Date.now();
    this.current = event; const generation = ++this.generation;
    const speaking = voice && settings.audioEnabled && AppState.currentState === 'active';
    this.until = now + (speaking ? 20 : 2);
    const cue: AudioCue = event.direction ?? (event.kind === 'challengeLost' ? 'failure' : ['challengeWon', 'paceRecovered', 'workoutCompleted', 'runCompleted'].includes(event.kind) ? 'success' : 'transition');
    const haptic: HapticPattern = event.direction ? 'default' : event.kind === 'distanceMilestone' || event.kind === 'progressUpdate' ? 'distance'
      : terminalEvent(event) || event.kind === 'paceRecovered' ? 'default' : 'transition';
    const done = () => { if (generation === this.generation) { this.current = null; this.clearTimeout(); this.releaseVoice(); } };
    const failed = () => {
      if (generation !== this.generation) return;
      done(); error('Annonce vocale indisponible. L’enregistrement continue.');
      this.stopOutput();
      void this.speechStop.then(() => {
        if (generation === this.generation && settings.audioEnabled && AppState.currentState === 'active') return alerts.send(cue, { ...settings, hapticsEnabled: false });
      }).catch(() => undefined);
    };
    this.timeout = setTimeout(() => { if (generation === this.generation) { this.generation++; this.current = null; this.clearTimeout(); this.stopOutput(); error('Annonce interrompue. L’enregistrement continue.'); } }, speaking ? 20000 : 8000);
    void this.speechStop.then(async () => {
      const elapsed = Math.max(0, (Date.now() - queuedAt) / 1000);
      if (generation !== this.generation || (event.expiresAt !== undefined && event.expiresAt <= now + elapsed) || elapsed > (terminalEvent(event) ? 20 : 8)) { done(); return; }
      await alerts.send(cue, speaking ? { ...settings, audioEnabled: false } : settings, haptic);
      if (generation !== this.generation) return;
      if (speaking && AppState.currentState === 'active') {
        const release = await audioSession.acquire('coach');
        if (generation !== this.generation || AppState.currentState !== 'active') { await release(); done(); return; }
        this.voiceRelease = release;
        Speech.speak(event.message.slice(0, 350), { language: 'fr-FR', rate: .95,
          useApplicationAudioSession: false, onDone: done, onStopped: done, onError: failed });
      }
    }).catch(() => { if (speaking) failed(); else { done(); if (generation === this.generation) error('Un signal de coaching est indisponible. L’enregistrement continue.'); } });
  }
}
export const coaching = new CoachingOutput();
