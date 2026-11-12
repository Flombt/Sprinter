import { AppState } from 'react-native';
import type * as Location from 'expo-location';
import { RunEngine } from '../core/engine';
import { DEFAULT_SETTINGS, PaceState, PaceTarget, RunRecord, Settings, SignalQuality, type GPSFix } from '../core/types';
import { StorageRepository, parseRun } from '../storage/repository';
import { healthDuplicate } from '../apple/mapping';
import { openRepository } from '../storage/open';
import { alerts } from './alerts';
import { DeviceLocationService, LocationService, locationFix } from './location';
import { WorkoutDefinition, CoachingEvent } from '../workouts/types';
import { coaching } from '../workouts/coaching';
import { workouts } from '../workouts/store';
import { validateTarget } from '../core/format';
import { validateWorkout } from '../workouts/definition';
import { sanitizeCoaching } from '../coaching/config';
import { ProgressAnnouncements } from '../coaching/progress';
import { progression } from '../progression/store';
import { forgetActivityAnalysis } from '../analysis/cache';
import { recentMapFix } from './sessionView';

export interface SessionState {
  ready: boolean; loading: boolean; busy: boolean; error: string | null; message: string | null;
  run: RunRecord | null; running: boolean; pace: number | null; paceState: PaceState; quality: SignalQuality;
  history: RunRecord[]; settings: Settings; restored: boolean; backgroundActive: boolean; unreadableCount: number;
  autoPaused: boolean; altitude: number | null;
  recoveryBlocked?: boolean;
  readonly mapFix?: GPSFix;
}
const mono = () => performance.now() / 1000;
const textError = (error: unknown) => error instanceof Error ? error.message : String(error);
export class RunningStore {
  private value: SessionState = { ready: false, loading: false, busy: false, error: null, message: null,
    run: null, running: false, pace: null, paceState: 'acquiring', quality: 'warmingUp', history: [],
    settings: { ...DEFAULT_SETTINGS }, restored: false, backgroundActive: false, unreadableCount: 0, autoPaused: false, altitude: null };
  private listeners = new Set<() => void>();
  private engine: RunEngine | null = null;
  private repository: StorageRepository | null = null;
  private initialization: Promise<void> | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private lastSave = -Infinity;
  private revision = 0;
  private checkpointInFlight: Promise<void> | null = null;
  private operation = false;
  private importingHealth = false;
  private recoveryBlocked = false;
  private healthAutoWrite = false;
  private failedObservers = new WeakSet<() => void>();
  private deferredPause = false;
  private progressAnnouncements = new ProgressAnnouncements();
  constructor(private location: LocationService = new DeviceLocationService()) {}
  getSnapshot = () => this.value;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private emit(patch: Partial<SessionState> = {}) {
    const quality = this.engine?.quality ?? 'warmingUp';
    const lastFix = this.engine?.record.points.at(-1)?.fix;
    this.value = { ...this.value, ...patch, run: this.engine ? { ...this.engine.record } : null,
      running: this.engine?.running ?? false, pace: this.engine?.currentPace ?? null,
      paceState: this.engine?.state ?? 'acquiring', quality,
      mapFix: lastFix ? recentMapFix(lastFix, quality, Date.now()) : undefined,
      autoPaused: this.engine?.autoPaused ?? false, altitude: this.engine?.altitude ?? null, recoveryBlocked: this.recoveryBlocked };
    // A failed optional observer cannot stop the GPS callback before its checkpoint.
    for (const listener of [...this.listeners]) {
      try { listener(); }
      catch {
        if (!this.failedObservers.has(listener)) { this.failedObservers.add(listener); console.warn('Sprinter : un observateur a échoué ; le moteur de course reste actif.'); }
      }
    }
  }
  initialize = (): Promise<void> => {
    if (this.value.ready) return Promise.resolve();
    if (this.initialization) return this.initialization;
    this.initialization = this.initializeInternal().finally(() => { this.initialization = null; });
    return this.initialization;
  };
  private async initializeInternal() {
    this.emit({ loading: true, error: null });
    try {
      this.repository = await openRepository(); await this.repository.initialize();
      const [history, settings] = await Promise.all([this.repository.history(), this.repository.loadSettings()]);
      let message: string | null = null;
      this.recoveryBlocked = false;
      try {
        const draft = await this.repository.loadDraft();
        if (draft && !history.some(run => run.id === draft.run.id)) {
          const interruption = Number.isFinite(draft.savedAt) ? Math.max(0, (Date.now() - draft.savedAt) / 1000) : 0;
          this.engine = RunEngine.restore({ ...draft.run, totalEstimated: true }, mono(), interruption); this.revision = draft.revision;
          this.progressAnnouncements.reset(this.engine.record);
          message = this.engine.workoutRecoveryError ?? this.engine.record.workoutError ?? 'Course récupérée en pause. L’interruption est exclue du temps actif et estimée dans le temps total.';
        }
      } catch (error) {
        this.recoveryBlocked = true;
        message = `Récupération impossible : ${textError(error)} Aucun nouveau départ ne remplacera cette sauvegarde. Consultez les options de récupération pour conserver une archive et débloquer le départ.`;
      }
      // A recovered process never silently restarts location services.
      try { await this.location.stop(); } catch (error) { message = `Arrêt du service de localisation résiduel impossible : ${textError(error)}`; }
      this.emit({ ready: true, loading: false, settings, history, message,
        restored: this.engine !== null, unreadableCount: this.repository.unreadableCount });
      if (this.engine && AppState.currentState === 'active') this.startTimer();
    } catch (error) { this.emit({ error: `Le stockage local est indisponible. ${textError(error)}`, loading: false }); }
  }
  clearMessage = () => this.emit({ message: null });
  reportMessage = (message: string) => this.emit({ message });
  setHealthAutoWrite = (enabled: boolean) => { this.healthAutoWrite = enabled; };
  listDraftArchives = async () => { await this.initialize(); return this.repository?.listDraftArchives() ?? []; };
  loadDraftArchive = async (id: string) => { await this.initialize(); return this.repository?.loadDraftArchive(id) ?? null; };
  archiveRecoveryDraft = async (): Promise<boolean> => {
    if (!this.repository || !this.recoveryBlocked || this.engine || this.operation) return false;
    this.operation = true; this.emit({ busy: true });
    try {
      const id = await this.repository.archiveDraft();
      this.recoveryBlocked = false;
      this.emit({ message: id ? 'Sauvegarde archivée sans suppression. Vous pouvez démarrer une nouvelle course.' : 'Aucun brouillon restant. Vous pouvez démarrer une nouvelle course.' });
      return true;
    } catch (error) { this.emit({ message: 'Archivage impossible. La sauvegarde reste conservée et le départ reste bloqué. ' + textError(error) }); return false; }
    finally { this.operation = false; this.emit({ busy: false }); }
  };
  cancelNavigation = () => coaching.cancelNavigation();
  announceNavigation = (kind: 'routeOff' | 'routeBack', message: string) => {
    if (!this.engine?.running) return;
    this.dispatchCoaching([{ id: `${kind}:${this.engine.record.id}:${this.engine.record.activeSeconds}`, kind, message,
      at: this.engine.record.activeSeconds, priority: kind === 'routeOff' ? 75 : 40, segmentIndex: this.engine.coachingIndex, expiresAt: this.engine.record.activeSeconds + 8 }]);
  };
  private async checkpoint(force = false): Promise<void> {
    while (this.checkpointInFlight) { await this.checkpointInFlight; if (!force) return; }
    if (!this.engine || !this.repository) return Promise.resolve();
    this.engine.tick(mono(), Date.now());
    const checkpoint = { version: 1 as const, revision: ++this.revision, savedAt: Date.now(), run: this.engine.record };
    this.lastSave = mono();
    const task = this.repository.saveDraft(checkpoint).catch(error => {
      this.emit({ message: `Sauvegarde progressive indisponible : ${textError(error)}` });
    });
    this.checkpointInFlight = task;
    try { await task; } finally { if (this.checkpointInFlight === task) this.checkpointInFlight = null; }
  }
  private tick = (extra: CoachingEvent[] = []) => {
    if (!this.engine) return;
    this.engine.tick(mono(), Date.now());
    if (this.engine.quality !== 'good' || this.engine.state === 'onTarget' || this.engine.state === 'free') coaching.cancelPace(this.engine.quality !== 'good');
    this.dispatchCoaching(extra);
    this.emit();
    if (this.engine.tracking && mono() - this.lastSave >= 5 && !this.checkpointInFlight) void this.checkpoint();
  };
  private startTimer() {
    this.stopTimer();
    if (this.engine && AppState.currentState === 'active') this.timer = setInterval(this.tick, 1000);
  }
  private stopTimer() { if (this.timer) clearInterval(this.timer); this.timer = null; }

  private dispatchCoaching(extra: CoachingEvent[] = []) {
    if (!this.engine?.running) return;
    const engine = this.engine, good = engine.quality === 'good';
    const incoming = [...engine.drainEvents(), ...extra].filter(event => {
      // One stable-return producer and one countdown producer, shared by all workout types.
      if (event.kind === 'paceRecovered' || event.kind === 'transitionSoon') return false;
      if (event.kind === 'paceDeviation') return good && (event.direction === 'slowDown' ? engine.state === 'tooFast' : engine.state === 'tooSlow');
      if (['timeAhead', 'timeBehind'].includes(event.kind)) return good;
      return true;
    });
    const config = sanitizeCoaching(this.value.settings.coaching);
    const target = engine.activeTarget, value = engine.currentPace;
    const insideTarget = target !== null && value !== null && value >= target.fast && value <= target.slow;
    const progress = this.progressAnnouncements.observe(engine.record, engine.quality, engine.state, engine.running,
      engine.currentPace, engine.coachingIndex, config, incoming, insideTarget);
    coaching.pump([...incoming, ...progress], this.engine.record.activeSeconds,
      this.engine.coachingIndex, this.value.settings, workouts.getSnapshot().preferences.voiceEnabled,
      message => this.emit({ message }));
  }
  abandonWorkout = async () => {
    if (!this.engine || this.operation) return;
    this.engine.abandonWorkout(); coaching.cancelPace(); this.dispatchCoaching(); this.emit(); await this.checkpoint(true);
  };
  async start(target: PaceTarget, definition?: WorkoutDefinition | null, metadata: { plannedEntryId?: string; shoeId?: string; routeId?: string; routeName?: string } = {}): Promise<boolean> {
    if (!this.value.ready || this.engine || this.operation) return false;
    if (this.recoveryBlocked) { this.emit({ message: 'Le départ est bloqué pour conserver une sauvegarde interrompue illisible. Ouvrez les options de récupération pour conserver une archive et débloquer le départ.' }); return false; }
    const invalid = validateTarget(target, this.value.settings.config.maximumSpeed) ?? (definition ? validateWorkout(definition)[0] : null);
    if (invalid) { this.emit({ message: invalid }); return false; }
    this.operation = true; this.emit({ busy: true, message: null });
    try {
      await this.location.stop(); await this.location.ensureForeground(this.location.canBackground && this.value.settings.backgroundEnabled);
      this.engine = new RunEngine(target, this.value.settings.config, mono(), Date.now(), undefined, undefined, { autoPauseEnabled: this.value.settings.autoPauseEnabled });
      if (definition) this.engine.attachWorkout(definition);
      if (typeof metadata.plannedEntryId === 'string' && metadata.plannedEntryId.length > 0 && metadata.plannedEntryId.length <= 200) this.engine.record.plannedEntryId = metadata.plannedEntryId;
      if (typeof metadata.shoeId === 'string' && metadata.shoeId.length > 0 && metadata.shoeId.length <= 200) this.engine.record.shoeId = metadata.shoeId;
      if (typeof metadata.routeId === 'string' && metadata.routeId.length > 0 && metadata.routeId.length <= 200) {
        this.engine.record.routeId = metadata.routeId; this.engine.record.routeName = metadata.routeName?.slice(0, 100);
      }
      this.progressAnnouncements.reset(this.engine.record);
      coaching.reset();
      await this.startTracking(); this.startTimer(); await this.checkpoint(true);
      this.dispatchCoaching();
      this.emit({ restored: false }); return true;
    } catch (error) {
      if (this.engine) { this.engine.pause(mono()); try { await this.stopTracking(); } catch {} await this.checkpoint(true); }
      this.emit({ message: textError(error) }); return false;
    } finally { this.operation = false; this.emit({ busy: false }); if (this.deferredPause) { this.deferredPause = false; await this.pause(); } }
  }
  private async startTracking() {
    const backgroundRequested = this.location.canBackground && this.value.settings.backgroundEnabled;
    const backgroundActive = await this.location.start(backgroundRequested,
      this.engine?.record.autoPauseEnabled === true, locations => this.receive(locations), error => { void this.handleLocationError(error); });
    this.emit({
      backgroundActive,
      ...(backgroundRequested && !backgroundActive && {
        message: 'Gardez Sprinter à l’écran. Pour courir écran verrouillé, autorisez la localisation « Toujours ».'
      }),
    });
  }
  private async stopTracking() {
    try { await this.location.stop(); } finally { this.emit({ backgroundActive: false }); }
  }
  receive(locations: Location.LocationObject[]) {
    if (!this.engine?.tracking) return;
    const received = Date.now(), now = mono();
    const wasAutoPaused = this.engine.autoPaused;
    const announcements: CoachingEvent[] = [];
    for (const location of [...locations].filter(Boolean).sort((a, b) => a.timestamp - b.timestamp)) {
      const fix = locationFix(location); if (!fix) { this.engine.signalLost(); continue; }
      const cue = this.engine.process(fix, now - Math.max(0, (received - fix.timestamp) / 1000), received);
      const extra: CoachingEvent[] = cue ? [{ id: `pace:${fix.timestamp}`, kind: 'paceDeviation', at: this.engine.record.activeSeconds,
        segmentIndex: this.engine.coachingIndex, direction: cue, priority: 65,
        message: cue === 'slowDown' ? 'Ralentissez légèrement.' : 'Accélérez légèrement.' }] : [];
      if (this.engine.state === 'onTarget' || this.engine.state === 'free' || this.engine.quality !== 'good') coaching.cancelPace(this.engine.quality !== 'good');
      announcements.push(...extra);
    }
    if (wasAutoPaused !== this.engine.autoPaused) { coaching.stop(); this.progressAnnouncements.interrupt(); void this.checkpoint(true); }
    // Deliver once after the whole batch and an up-to-date clock; never narrate old fixes in sequence.
    this.tick(announcements);
  }
  async handleBackground(locations: Location.LocationObject[]) {
    await this.initialize();
    if (!this.engine?.tracking) {
      await this.location.stop();
      return;
    }
    this.receive(locations);
    // A delivered background batch is durably checkpointed before yielding to iOS.
    await this.checkpoint(true);
  }
  pause = async () => {
    if (!this.engine) return;
    this.progressAnnouncements.interrupt();
    if (this.operation) {
      if (this.engine.tracking) {
        this.engine.pause(mono()); this.engine.drainEvents(); this.stopTimer(); coaching.stop(); this.emit();
        this.deferredPause = true;
        try { await this.stopTracking(); } catch (error) { this.emit({ message: textError(error) }); }
        await this.checkpoint(true);
      }
      return;
    }
    this.operation = true;
    // Freeze synchronously before awaiting native location teardown.
    this.engine.pause(mono()); this.engine.drainEvents(); this.stopTimer(); coaching.stop(); this.emit({ busy: true });
    try { await this.stopTracking(); }
    catch (error) { this.emit({ message: textError(error) }); }
    finally { await this.checkpoint(true); if (AppState.currentState === 'active') this.startTimer(); this.operation = false; this.emit({ busy: false }); }
  };
  resume = async (): Promise<boolean> => {
    if (!this.engine || this.engine.running || this.operation) return false;
    this.operation = true; this.emit({ busy: true, message: null });
    try {
      await this.location.ensureForeground(this.location.canBackground && this.value.settings.backgroundEnabled); const tracking = this.engine.tracking; this.engine.resume(mono());
      if (!tracking) { await this.stopTracking(); await this.startTracking(); }
      this.startTimer(); await this.checkpoint(true); this.emit({ restored: false }); return true;
    } catch (error) {
      this.engine?.pause(mono()); try { await this.stopTracking(); } catch {} await this.checkpoint(true);
      this.emit({ message: textError(error) }); return false;
    } finally { this.operation = false; this.emit({ busy: false }); if (this.deferredPause) { this.deferredPause = false; await this.pause(); } }
  };
  finish = async (): Promise<RunRecord | null> => {
    if (!this.engine || !this.repository || this.operation) return null;
    // Acquire the operation guard before the first await: a second confirmation
    // must never race a commit or clear a subsequently started session.
    this.operation = true;
    this.engine.pause(mono()); this.engine.drainEvents(); this.stopTimer(); coaching.stop(); this.emit({ busy: true });
    try {
      const result = this.engine.finish(Date.now());
      // Commit the user's Health-export intent with the run itself, before any
      // observer can enqueue a separate Apple database write.
      if (this.healthAutoWrite && !result.healthKit && result.activeSeconds > 0 && result.distanceMeters > 0) result.healthExportRequestedAt = Date.now();
      else delete result.healthExportRequestedAt;
      let shutdownMessage: string | null = null;
      try { await this.stopTracking(); } catch (error) { shutdownMessage = `Course enregistrée. Arrêt du service GPS à vérifier : ${textError(error)}`; }
      await this.checkpoint(true);
      await this.repository.finish(result); this.engine = null;
      coaching.reset();
      coaching.pump([{ id: `runCompleted:${result.id}`, kind: 'runCompleted', at: result.activeSeconds,
        segmentIndex: -1, priority: 90, message: 'Course terminée et enregistrée.' }], result.activeSeconds, -1,
        this.value.settings, workouts.getSnapshot().preferences.voiceEnabled, message => this.emit({ message }));
      this.emit({ restored: false, message: shutdownMessage });
      try { this.emit({ history: await this.repository.history() }); }
      catch { this.emit({ history: [result, ...this.value.history.filter(run => run.id !== result.id)], message: 'Course enregistrée. Le rechargement de l’historique est indisponible.' }); }
      void progression.initialize().then(() => progression.reconcile(this.value.history));
      return result;
    } catch (error) { if (AppState.currentState === 'active') this.startTimer(); this.emit({ message: `Enregistrement impossible. La course reste en pause. ${textError(error)}` }); return null; }
    finally { this.operation = false; this.emit({ busy: false }); }
  };
  updateSettings = async (patch: Partial<Settings>) => {
    if (this.engine && (patch.backgroundEnabled !== undefined || patch.autoPauseEnabled !== undefined)) { this.emit({ message: 'Modifiez le suivi en arrière-plan et la pause automatique entre deux courses.' }); return; }
    const settings = { ...this.value.settings, ...patch, coaching: sanitizeCoaching(patch.coaching ?? this.value.settings.coaching) };
    if (patch.audioEnabled === false || patch.hapticsEnabled === false || patch.coaching !== undefined) coaching.stop();
    this.emit({ settings });
    try { await this.repository?.saveSettings(settings); }
    catch (error) { this.emit({ message: `Réglages non enregistrés : ${textError(error)}` }); }
  };
  deleteRun = async (id: string) => {
    try {
      if (!this.repository) throw new Error('Le stockage des activités est indisponible.');
      await this.repository.deleteRun(id); forgetActivityAnalysis(id);
      this.emit({ history: this.value.history.filter(run => run.id !== id) });
      try { this.emit({ history: await this.repository.history() }); }
      catch { this.emit({ message: 'Sortie supprimée. Le rechargement du reste de l’historique est indisponible.' }); }
      return true;
    }
    catch (error) { this.emit({ message: textError(error) }); return false; }
  };
  importHealthActivity = async (input: RunRecord): Promise<boolean> => {
    if (this.importingHealth) return false;
    this.importingHealth = true;
    try {
      await this.initialize();
      if (!this.repository || this.engine) throw new Error('Importez vos activités Santé entre deux courses.');
      const run = parseRun(JSON.stringify(input)), source = run.healthKit;
      if (!source || run.id !== `healthkit:${source.uuid.toLowerCase()}` || !run.targetUnavailable || run.points.length || run.endedAt === null) throw new Error('Import Santé invalide.');
      const history = await this.repository.history();
      if (healthDuplicate({ ...source, startedAt: run.startedAt, endedAt: run.endedAt, activeSeconds: run.activeSeconds, distanceMeters: run.distanceMeters,
        ownSource: source.sourceBundle === 'app.sprinter.running' }, history)) throw new Error('Une course correspondante existe déjà. Associez-la depuis les intégrations Apple.');
      await this.repository.finish(run);
      this.emit({ history: [run, ...this.value.history.filter(r => r.id !== run.id)].sort((a, b) => b.startedAt - a.startedAt), message: 'Activité Santé importée localement. Aucun parcours GPS ni record de segment n’a été inventé.' });
      try { this.emit({ history: await this.repository.history() }); }
      catch { this.emit({ message: 'Activité Santé importée. Le rechargement du reste de l’historique est indisponible.' }); }
      void progression.initialize().then(() => progression.reconcile(this.value.history));
      return true;
    } catch (error) { this.emit({ message: textError(error) }); return false; }
    finally { this.importingHealth = false; }
  };
  async appStateChanged(state: string) {
    if (state !== 'active') { coaching.stop(); this.progressAnnouncements.interrupt(); }
    if (state === 'background') {
      coaching.stop();
      if (this.engine?.tracking && !this.value.backgroundActive) {
        await this.pause();
        this.emit({ message: 'Course mise en pause : ce mode exige que Sprinter reste à l’écran. Reprenez pour continuer.' });
      } else { this.stopTimer(); if (this.engine) { this.engine.tick(mono(), Date.now()); await this.checkpoint(true); } }
    } else if (state === 'active' && this.engine) {
      const engine = this.engine;
      if (engine.tracking) {
        try { await this.location.checkAccess(this.value.backgroundActive); }
        catch (error) {
          if (this.engine === engine && AppState.currentState === 'active') { await this.pause(); this.emit({ message: textError(error) }); }
          return;
        }
      }
      if (this.engine !== engine || AppState.currentState !== 'active') return;
      this.tick(); this.startTimer();
    }
  }
  async handleLocationError(error: unknown, fatal = false) {
    if (!this.engine?.tracking) return;
    const engine = this.engine, background = this.value.backgroundActive;
    engine.signalLost(); coaching.cancelPace(true); this.emit({ message: `Signal GPS indisponible : ${textError(error)}` });
    if (fatal) { await this.pause(); this.emit({ message: `Course mise en pause après une interruption du GPS : ${textError(error)}` }); return; }
    try { await this.location.checkAccess(background); }
    catch (permissionError) { if (this.engine === engine && engine.tracking) { await this.pause(); this.emit({ message: textError(permissionError) }); } }
  }
  testCue = async (cue: 'slowDown' | 'speedUp') => {
    const settings = this.value.settings;
    if (!settings.audioEnabled && !settings.hapticsEnabled) { this.emit({ message: 'Activez au moins un type de signal pour le tester.' }); return; }
    try { await alerts.send(cue, settings); } catch (error) { this.emit({ message: textError(error) }); }
  };
}
export const session = new RunningStore();
AppState.addEventListener('change', state => { void session.appStateChanged(state); });
