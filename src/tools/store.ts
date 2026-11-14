import { AppState, Platform } from 'react-native';
import type { SessionState } from '../services/session';
import type { RunRecord } from '../core/types';
import { openTools, type ToolsPersistence } from '../routes/persistence';
import { readRoute, readTools } from '../routes/validation';
import { defaultToolsData, type SavedRoute, type ToolsData, type NavigationStatus } from '../routes/types';
import { routeFromActivity } from '../routes/gpx';
import { TraceNavigator } from '../routes/navigation';
import { Metronome } from './metronome';
import { CadenceSensor, cadenceBridge, emptyCadenceCapabilities, type CadenceCapabilities } from './cadence';

interface ToolsState {
  ready: boolean; busy: boolean; message: string | null; routes: SavedRoute[]; preferences: ToolsData;
  navigation: NavigationStatus; cadence: { spm: number; timestamp: number } | null; cadenceCapabilities: CadenceCapabilities;
}
class ToolsStore {
  private value: ToolsState = { ready: false, busy: false, message: null, routes: [], preferences: defaultToolsData(), navigation: { status: 'unavailable', distanceMeters: null }, cadence: null, cadenceCapabilities: emptyCadenceCapabilities };
  private listeners = new Set<() => void>(); private persistence: ToolsPersistence | null = null;
  private initialization: Promise<void> | null = null; private queue: Promise<unknown> = Promise.resolve();
  private latest: SessionState | null = null; private navigator: TraceNavigator | null = null; private navigationKey = ''; private lastNavigationAt = -Infinity;
  private metronome = new Metronome(message => this.emit({ message }));
  private sensor = new CadenceSensor(cadence => this.emit({ cadence }), message => this.emit({ message }));
  getSnapshot = () => this.value;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private emit(patch: Partial<ToolsState>) { this.value = { ...this.value, ...patch }; this.listeners.forEach(l => l()); }
  initialize = (): Promise<void> => {
    if (this.value.ready) return Promise.resolve(); if (this.initialization) return this.initialization;
    this.initialization = (async () => {
      try {
        this.persistence = await openTools(); const data = await this.persistence.load();
        const cadenceCapabilities = cadenceBridge?.capabilities() ?? emptyCadenceCapabilities;
        this.emit({ ...data, ready: true, cadenceCapabilities, message: null });
        if (this.latest) this.observe(this.latest);
      } catch (error) { this.emit({ message: `Outils indisponibles : ${error instanceof Error ? error.message : String(error)}. Vos données sont conservées.` }); }
    })().finally(() => { this.initialization = null; });
    return this.initialization;
  };
  private operation(action: () => Promise<void>): Promise<boolean> {
    const task = this.queue.then(async () => {
      this.emit({ busy: true, message: null });
      try { await this.initialize(); if (!this.persistence || !this.value.ready) throw new Error('Le stockage des outils est indisponible.'); await action(); return true; }
      catch (error) { this.emit({ message: error instanceof Error ? error.message : String(error) }); return false; }
      finally { this.emit({ busy: false }); }
    });
    this.queue = task.catch(() => undefined); return task;
  }
  update = (patch: Partial<ToolsData>) => this.operation(async () => {
    if (this.latest?.run && (patch.selectedRouteId !== undefined || patch.departureMeters !== undefined)) throw new Error('Choisissez le tracé et sa tolérance entre deux courses.');
    const preferences = readTools({ ...this.value.preferences, ...patch, version: 1 });
    if (preferences.selectedRouteId && !this.value.routes.some(r => r.id === preferences.selectedRouteId)) throw new Error('Parcours sélectionné indisponible.');
    await this.persistence!.savePreferences(preferences); this.emit({ preferences }); if (this.latest) this.observe(this.latest);
  });
  addRoute = (input: SavedRoute, select = false) => this.operation(async () => {
    const route = readRoute(input);
    if (this.value.routes.some(r => r.id === route.id)) return;
    if (route.sourceActivityId && this.value.routes.some(r => r.sourceActivityId === route.sourceActivityId)) { this.emit({ message: 'Cette sortie possède déjà un parcours favori.' }); return; }
    if (this.value.routes.length >= 50 || this.value.routes.reduce((n, r) => n + r.segments.reduce((m, s) => m + s.length, 0), 0) + route.segments.reduce((n, s) => n + s.length, 0) > 200000) throw new Error('La bibliothèque atteint sa limite locale (50 parcours ou 200 000 points). Supprimez des favoris avant cet import.');
    await this.persistence!.saveRoute(route); this.emit({ routes: [route, ...this.value.routes] });
    if (select && !this.latest?.run) { const preferences = { ...this.value.preferences, selectedRouteId: route.id }; await this.persistence!.savePreferences(preferences); this.emit({ preferences }); }
    this.emit({ message: 'Parcours enregistré localement. Aucun partage ni nouvelle activité n’a été créé.' });
  });
  saveActivityRoute = async (run: RunRecord) => {
    const existing = this.value.routes.find(r => r.sourceActivityId === run.id);
    if (existing) { this.emit({ message: 'Cette sortie possède déjà un parcours favori.' }); return true; }
    try { return await this.addRoute(routeFromActivity(run)); }
    catch (error) { this.emit({ message: error instanceof Error ? error.message : String(error) }); return false; }
  };
  renameRoute = (id: string, name: string, syncedAt?: number) => this.operation(async () => {
    const route = this.value.routes.find(r => r.id === id); if (!route) throw new Error('Parcours introuvable.');
    if (!name.trim()) throw new Error('Donnez un nom au parcours.');
    const updatedAt = syncedAt ?? Math.max(Date.now(), (route.updatedAt ?? route.createdAt) + 1);
    const updated = { ...route, name: name.trim().slice(0, 100), updatedAt }; await this.persistence!.saveRoute(updated);
    this.emit({ routes: this.value.routes.map(r => r.id === id ? updated : r) });
  });
  deleteRoute = (id: string) => this.operation(async () => {
    if (this.latest?.run?.routeId === id) throw new Error('Ce tracé est utilisé par la course en cours.');
    if (this.value.preferences.selectedRouteId === id) {
      const preferences = { ...this.value.preferences, selectedRouteId: null }; await this.persistence!.savePreferences(preferences); this.emit({ preferences });
    }
    await this.persistence!.deleteRoute(id); this.emit({ routes: this.value.routes.filter(r => r.id !== id) });
  });
  clearForAccountSwitch = () => this.operation(async () => {
    if (this.latest?.run) throw new Error('Terminez votre course avant de changer de compte.');
    const preferences = { ...this.value.preferences, selectedRouteId: null };
    await this.persistence!.clearRoutes(preferences);
    this.emit({ routes: [], preferences });
    if (this.latest) this.observe(this.latest);
  });
  requestCadence = () => this.operation(async () => {
    if (!cadenceBridge) throw new Error('La cadence Core Motion exige une version iOS reconstruite. Le tempo cible du métronome reste disponible dans Expo Go.');
    if (AppState.currentState !== 'active') throw new Error('Ouvrez Sprinter pour autoriser les mouvements.');
    const cadenceCapabilities = await cadenceBridge.requestAuthorization(); this.emit({ cadenceCapabilities });
    if (!cadenceCapabilities.available || cadenceCapabilities.permission !== 'authorized') throw new Error('Cadence indisponible ou mouvements non autorisés sur cet iPhone.');
    const preferences = { ...this.value.preferences, cadenceEnabled: true }; await this.persistence!.savePreferences(preferences); this.emit({ preferences });
    if (this.latest) this.observe(this.latest);
  });
  refreshCapabilities() { try { this.emit({ cadenceCapabilities: cadenceBridge?.capabilities() ?? emptyCadenceCapabilities }); } catch {} }
  suspend() {
    this.metronome.configure(false, this.value.preferences.bpm, this.value.preferences.volume);
    this.sensor.configure(false); this.navigator?.interrupt();
  }
  observe(state: SessionState): { kind: 'routeOff' | 'routeBack'; message: string } | null {
    this.latest = state;
    const active = AppState.currentState === 'active', run = state.run, prefs = this.value.preferences;
    const audible = this.value.ready && !!run && state.running && (active || (AppState.currentState === 'background' && state.backgroundActive));
    this.metronome.configure(audible && prefs.metronomeEnabled && Platform.OS !== 'web', prefs.bpm, prefs.volume);
    this.sensor.configure(this.value.ready && !!run && state.running && active && prefs.cadenceEnabled && this.value.cadenceCapabilities.permission === 'authorized');
    if (this.value.cadence && Date.now() - this.value.cadence.timestamp > 10000) this.emit({ cadence: null });
    const route = this.value.routes.find(r => r.id === run?.routeId), key = `${run?.id ?? ''}:${route?.id ?? ''}:${prefs.departureMeters}`;
    if (key !== this.navigationKey) { this.navigationKey = key; this.navigator = route ? new TraceNavigator(route, prefs.departureMeters) : null; this.lastNavigationAt = -Infinity; }
    if (!this.navigator || !run || !state.running || !['good', 'stationary'].includes(state.quality)) {
      this.navigator?.interrupt();
      const status = !run?.routeId || !route ? 'unavailable' : !state.running ? 'paused' : 'acquiring';
      if (this.value.navigation.status !== status || this.value.navigation.distanceMeters !== null) this.emit({ navigation: { status, distanceMeters: null } });
      return null;
    }
    if (performance.now() - this.lastNavigationAt < 5000) return null;
    this.lastNavigationAt = performance.now();
    const fix = run.points.at(-1)?.fix;
    if (!fix) { this.navigator.interrupt(); this.emit({ navigation: { status: 'acquiring', distanceMeters: null } }); return null; }
    const navigation = this.navigator.observe(fix, run.activeSeconds, Date.now()); this.emit({ navigation });
    return navigation.event ? { kind: navigation.event === 'off' ? 'routeOff' : 'routeBack', message: navigation.event === 'off' ? 'Vous vous éloignez du tracé choisi. Vérifiez le parcours lorsque vous pouvez le faire.' : 'Vous êtes de nouveau à proximité du tracé choisi.' } : null;
  }
}
export const toolsStore = new ToolsStore();
