import { AppState } from 'react-native';
import type { RunRecord } from '../core/types';
import type { SessionState } from '../services/session';
import { nativeApple, APPLE_BUILD_REQUIRED, unavailableCapabilities, readHealthWorkouts, writeHealthWorkout } from './bridge';
import { appleDatabaseDirectory, openApplePersistence, type ApplePersistence } from './persistence';
import { defaultApplePreferences, type ApplePreferences, type HealthCapabilities, type HealthWorkout } from './types';
import { healthExport, validHealthUUID } from './mapping';
import { RunLiveController } from './live';

interface AppleState {
  ready: boolean; busy: boolean; message: string | null; capabilities: HealthCapabilities; preferences: ApplePreferences;
  workouts: HealthWorkout[]; hasMore: boolean;
}
const errorText = (error: unknown) => error instanceof Error ? error.message : String(error);
class AppleStore {
  private value: AppleState = { ready: false, busy: false, message: null, capabilities: unavailableCapabilities, preferences: defaultApplePreferences(), workouts: [], hasMore: false };
  private listeners = new Set<() => void>();
  private persistence: ApplePersistence | null = null;
  private initialization: Promise<void> | null = null;
  private queue: Promise<unknown> = Promise.resolve();
  private anchor: string | null = null;
  private replaying = false;
  private from = 0; private until = 0; private generation = 0;
  private latest: SessionState | null = null;
  private live = new RunLiveController(message => this.emit({ message }));
  getSnapshot = () => this.value;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private emit(patch: Partial<AppleState>) { this.value = { ...this.value, ...patch }; this.listeners.forEach(l => l()); }
  initialize = (): Promise<void> => {
    if (this.value.ready) return Promise.resolve();
    if (this.initialization) return this.initialization;
    this.initialization = (async () => {
      try {
        if (nativeApple) {
          const capabilities = await nativeApple.prepareStorage(appleDatabaseDirectory);
          if (!capabilities.backupProtected) throw new Error('La protection des données Santé est indisponible.');
          this.persistence = await openApplePersistence();
          const preferences = await this.persistence.load();
          this.emit({ preferences, capabilities });
          try { await this.live.initialize(); } catch (error) { this.emit({ message: `Live Activity : ${errorText(error)}` }); }
        }
        this.emit({ ready: true });
        if (this.latest) this.observe(this.latest);
      } catch (error) { this.emit({ message: `Intégrations Apple : ${errorText(error)}` }); }
    })().finally(() => { this.initialization = null; });
    return this.initialization;
  };
  private operation(action: () => Promise<void>): Promise<boolean> {
    const task = this.queue.then(async () => {
      this.emit({ busy: true, message: null });
      try { await this.initialize(); if (!this.value.ready || !nativeApple || !this.persistence) throw new Error(APPLE_BUILD_REQUIRED); await action(); return true; }
      catch (error) { this.emit({ message: errorText(error) }); return false; }
      finally { this.emit({ busy: false }); }
    });
    this.queue = task.catch(() => undefined); return task;
  }
  private async save(patch: Partial<ApplePreferences>) {
    const preferences = { ...this.value.preferences, ...patch };
    await this.persistence!.save(preferences); this.emit({ preferences });
    if (this.latest) this.observe(this.latest);
  }
  refreshCapabilities = () => {
    if (!nativeApple || !this.value.ready) return;
    try { this.emit({ capabilities: nativeApple.capabilities() }); if (this.latest) this.observe(this.latest); }
    catch (error) { this.emit({ message: errorText(error) }); }
  };
  requestAuthorization = (kind: 'read' | 'write') => this.operation(async () => {
    if (AppState.currentState !== 'active') throw new Error('Ouvrez Sprinter pour gérer les permissions Santé.');
    const capabilities = await nativeApple!.requestAuthorization(kind === 'read', kind === 'write');
    this.emit({ capabilities });
    if (kind === 'read') { await this.save({ readRequested: true }); this.emit({ message: 'Demande de lecture présentée. iOS ne révèle pas les types autorisés en lecture ; seules les données rendues visibles pourront être consultées.' }); }
    else this.emit({ message: capabilities.workoutWrite === 'authorized' && capabilities.distanceWrite === 'authorized' ? 'Écriture autorisée. Activez la synchronisation automatique ou envoyez une course depuis son détail.' : 'L’écriture des entraînements et des distances doit être autorisée dans Santé.' });
  });
  setAutoWrite = (autoWrite: boolean) => this.operation(async () => {
    this.refreshCapabilities();
    if (autoWrite && (this.value.capabilities.workoutWrite !== 'authorized' || this.value.capabilities.distanceWrite !== 'authorized')) throw new Error('Autorisez d’abord l’écriture des entraînements et distances.');
    await this.save({ autoWrite });
    if (autoWrite && this.latest?.ready) void this.retryPending(this.latest.history);
  });
  disableRead = () => {
    this.generation++; this.anchor = null; this.emit({ workouts: [], hasMore: false });
    return this.operation(() => this.save({ readRequested: false }));
  };
  setLiveEnabled = (liveEnabled: boolean) => this.operation(async () => {
    this.refreshCapabilities();
    if (liveEnabled && !this.live.available) throw new Error('Le module d’activités en direct n’est pas initialisé. Reconstruisez la version iOS avec son extension.');
    if (liveEnabled && !this.value.capabilities.liveAllowed) throw new Error('Les activités en direct ne sont pas autorisées sur cet iPhone. Consultez ses réglages.');
    await this.save({ liveEnabled });
  });
  observe(state: SessionState) {
    this.latest = state;
    try { this.live.observe(state, this.value.ready && this.value.preferences.liveEnabled && this.value.capabilities.liveAllowed); }
    catch (error) { this.emit({ message: `Live Activity : ${errorText(error)}` }); }
  }
  exportRun = (run: RunRecord, automatic = false) => this.operation(async () => {
    if (automatic && !this.value.preferences.autoWrite) return;
    if (this.value.preferences.receipts.some(r => r.runId === run.id)) return;
    const payload = healthExport(run);
    if (automatic && !this.value.preferences.pendingRunIds?.includes(run.id)) {
      const pendingRunIds = this.value.preferences.pendingRunIds ?? [];
      if (pendingRunIds.length >= 10000) throw new Error('La file Santé est pleine. Envoyez vos courses manuellement depuis leur détail.');
      // Persist intent BEFORE the native transaction; a killed process can resume it with the same sync ID.
      await this.save({ pendingRunIds: [...pendingRunIds, run.id] });
    }
    this.refreshCapabilities();
    if (this.value.capabilities.workoutWrite !== 'authorized' || this.value.capabilities.distanceWrite !== 'authorized') throw new Error('Santé : autorisation d’écriture manquante. La course est conservée localement.');
    const receipt = await writeHealthWorkout(payload);
    if (!validHealthUUID(receipt.uuid)) throw new Error('Santé n’a pas fourni de confirmation exploitable. Réessayez : l’identifiant de synchronisation reste identique.');
    await this.link(receipt.uuid, run.id);
    this.emit({ message: receipt.alreadyExists ? 'Cette course est déjà présente dans Santé ; association récupérée.' : 'Course enregistrée dans Santé.' });
  });
  private async link(uuid: string, runId: string, knownRunIds?: Set<string>) {
    const other = this.value.preferences.receipts.find(r => r.uuid.toLowerCase() === uuid.toLowerCase() && r.runId !== runId);
    if (other && (!knownRunIds || knownRunIds.has(other.runId))) throw new Error('Cette activité Santé est déjà associée à une autre course locale.');
    await this.save({ receipts: [...this.value.preferences.receipts.filter(r => r.runId !== runId && r.uuid.toLowerCase() !== uuid.toLowerCase()), { runId, uuid: uuid.toLowerCase(), syncedAt: Date.now() }],
      pendingRunIds: (this.value.preferences.pendingRunIds ?? []).filter(id => id !== runId) });
  }
  associate = (workout: HealthWorkout, run: RunRecord, history: RunRecord[]) => this.operation(async () => {
    if (!validHealthUUID(workout.uuid)) throw new Error('Identifiant Santé invalide.');
    if (!history.some(r => r.id === run.id)) throw new Error('La course locale n’existe plus. Actualisez l’historique.');
    await this.link(workout.uuid, run.id, new Set(history.map(r => r.id)));
    this.emit({ message: 'Activité associée à la course locale, sans ajouter de distance à l’historique.' });
  });
  async retryPending(history: RunRecord[]) {
    if (this.replaying || !this.value.ready || !this.value.preferences.autoWrite) return;
    this.replaying = true;
    try {
      for (const id of this.value.preferences.pendingRunIds ?? []) {
        if (!this.value.preferences.autoWrite) break;
        const run = history.find(r => r.id === id);
        if (run && !await this.exportRun(run, true)) break; // No polling or permission prompt after a failure.
      }
    } finally { this.replaying = false; }
  }
  read = (days = 30, more = false) => {
    const generation = ++this.generation;
    return this.operation(async () => {
      if (!this.value.preferences.readRequested || generation !== this.generation) return;
      if (more && !this.value.hasMore) return;
      if (!more) { this.until = Date.now(); this.from = this.until - Math.max(1, Math.min(3660, days)) * 86400000; this.anchor = null; this.emit({ workouts: [], hasMore: false }); }
      const page = await readHealthWorkouts(this.from, this.until, this.anchor);
      if (generation !== this.generation || !this.value.preferences.readRequested) return;
      if (!Array.isArray(page.workouts) || !Array.isArray(page.deleted) || typeof page.hasMore !== 'boolean' || (page.anchor !== null && typeof page.anchor !== 'string')) throw new Error('Réponse Santé illisible.');
      const map = new Map(this.value.workouts.map(w => [w.uuid.toLowerCase(), w]));
      for (const id of page.deleted) map.delete(id.toLowerCase());
      for (const w of page.workouts) if (validHealthUUID(w.uuid)) map.set(w.uuid.toLowerCase(), w);
      this.anchor = page.anchor;
      this.emit({ workouts: [...map.values()].sort((a, b) => b.startedAt - a.startedAt), hasMore: page.hasMore,
        message: !map.size ? 'Aucune course visible sur cette période. Cela peut correspondre à des données absentes ou à une lecture non autorisée ; iOS ne permet pas de les distinguer.' : null });
    });
  };
}
export const apple = new AppleStore();
