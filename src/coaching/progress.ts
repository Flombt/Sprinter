import type { PaceState, RunRecord, SignalQuality } from '../core/types';
import type { CoachingEvent } from '../workouts/types';
import type { CoachingPreferences } from './config';

const spokenTime = (seconds: number) => {
  const n = Math.max(0, Math.round(seconds)), minutes = Math.floor(n / 60);
  return `${minutes ? `${minutes} minute${minutes > 1 ? 's' : ''}` : ''}${n % 60 ? `${minutes ? ' et ' : ''}${n % 60} secondes` : ''}` || 'zéro seconde';
};
/** Observes real counters. Restores and preference changes rebase markers without replay. */
export class ProgressAnnouncements {
  private runId: string | null = null; private step = 1000; private marker = 0; private progressAt = 0;
  private recoveryPending = false; private inTargetSince: number | null = null; private anticipated = -1;
  reset(run: RunRecord) {
    this.runId = run.id; this.marker = Math.floor(run.distanceMeters / this.step); this.progressAt = run.activeSeconds;
    this.recoveryPending = false; this.inTargetSince = null; this.anticipated = -1;
  }
  interrupt() { this.recoveryPending = false; this.inTargetSince = null; }
  observe(run: RunRecord, quality: SignalQuality, state: PaceState, running: boolean, pace: number | null,
          segmentIndex: number, config: CoachingPreferences, incoming: CoachingEvent[], insideTarget: boolean): CoachingEvent[] {
    if (this.runId !== run.id) this.reset(run);
    if (this.step !== config.distanceStepMeters) { this.step = config.distanceStepMeters; this.marker = Math.floor(run.distanceMeters / this.step); }
    const now = run.activeSeconds, result: CoachingEvent[] = [];
    const event = (kind: CoachingEvent['kind'], message: string, priority: number, expiresAt?: number) => result.push({
      id: `${kind}:${run.id}:${segmentIndex}:${now.toFixed(3)}`, kind, message, priority, at: now, segmentIndex, ...(expiresAt === undefined ? {} : { expiresAt }),
    });
    if (!running) { this.interrupt(); this.marker = Math.floor(run.distanceMeters / this.step); this.progressAt = now; return result; }
    if (quality !== 'good') this.interrupt();
    else if (incoming.some(e => e.kind === 'paceDeviation')) this.recoveryPending = true;
    if (quality === 'good' && state === 'onTarget' && insideTarget) {
      this.inTargetSince ??= now;
      if (this.recoveryPending && now - this.inTargetSince >= 4) { event('paceRecovered', 'Vous êtes dans la bonne plage d’allure.', 50); this.recoveryPending = false; }
    } else this.inTargetSince = null;
    const marker = Math.floor(run.distanceMeters / this.step);
    if (marker > this.marker && quality === 'good') {
      const kilometers = marker * this.step / 1000;
      event('distanceMilestone', `Vous avez parcouru ${kilometers.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} kilomètre${kilometers > 1 ? 's' : ''}.`, 45);
    }
    this.marker = marker;
    const interval = config.categories.progress.intervalSeconds;
    if (now - this.progressAt >= interval) {
      this.progressAt = now;
      if (quality === 'good' && pace !== null && Number.isFinite(pace) && !result.some(e => e.kind === 'distanceMilestone') && run.distanceMeters > 0) {
        event('progressUpdate', `${(run.distanceMeters / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} kilomètres en ${spokenTime(now)} de temps actif. Allure actuelle : ${spokenTime(pace)} par kilomètre.`, 25);
      }
    }
    const workout = run.workout, current = workout?.segments[workout.currentIndex];
    if (workout?.status === 'running' && current?.startedAt !== null && current && this.anticipated !== workout.currentIndex) {
      const end = current.planned.end, next = workout.segments[workout.currentIndex + 1];
      const estimate = end.kind === 'distance';
      const remaining = end.kind === 'duration' ? current.startedAt! + end.value - now
        : estimate && quality === 'good' && pace !== null && Number.isFinite(pace) ? Math.max(0, end.value - (run.distanceMeters - current.startMeters)) * pace / 1000 : null;
      if (remaining !== null && remaining > 0 && remaining <= 10) {
        this.anticipated = workout.currentIndex;
        const what = !next ? 'Fin de séance' : next.planned.effort === 'recovery' ? 'Récupération' : next.planned.repetition !== null && next.planned.repetition !== current.planned.repetition ? 'Prochaine répétition' : 'Prochain bloc';
        event('transitionSoon', `${what} dans ${estimate ? 'environ ' : ''}${Math.ceil(remaining)} secondes.`, 40, now + Math.min(remaining, 1.5));
      }
    }
    return result;
  }
}
