import { uid, validateWorkout } from './definition';
import { defaultPreferences, openWorkoutPersistence, WorkoutPersistence } from './persistence';
import { WorkoutDefinition, WorkoutPreferences } from './types';
import { coaching } from './coaching';
import { MAX_WORKOUT_FAVORITES, readWorkoutFavorites, savedFavoriteKey, validWorkoutFavoriteKey } from './favorites';
interface LibraryState { ready: boolean; busy: boolean; message: string | null; definitions: WorkoutDefinition[]; preferences: WorkoutPreferences; unreadable: number }
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
class WorkoutLibrary {
  private value: LibraryState = { ready: false, busy: false, message: null, definitions: [], preferences: defaultPreferences(), unreadable: 0 };
  private listeners = new Set<() => void>(); private persistence: WorkoutPersistence | null = null;
  private initialization: Promise<void> | null = null; private writes: Promise<unknown> = Promise.resolve();
  getSnapshot = () => this.value;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private emit(value: Partial<LibraryState>) { this.value = { ...this.value, ...value }; this.listeners.forEach(listener => listener()); }
  initialize = () => this.initialization ?? (this.initialization = this.load().finally(() => { this.initialization = null; }));
  private async load() {
    if (this.value.ready) return;
    try { this.persistence = await openWorkoutPersistence(); this.emit({ ...await this.persistence.load(), ready: true, message: null }); }
    catch { this.emit({ message: 'La bibliothèque locale est indisponible. La course libre reste accessible.' }); }
  }
  private write(action: () => Promise<void>): Promise<boolean> {
    const operation = this.writes.catch(() => {}).then(async () => {
      this.emit({ busy: true, message: null });
      try { if (!this.persistence) throw new Error('Bibliothèque indisponible.'); await action(); return true; }
      catch (error) { this.emit({ message: error instanceof Error ? error.message : 'Sauvegarde impossible.' }); return false; }
      finally { this.emit({ busy: false }); }
    });
    this.writes = operation; return operation;
  }
  save = (definition: WorkoutDefinition, select = false) => this.write(async () => {
    const errors = validateWorkout(definition); if (errors.length) throw new Error(errors[0]);
    const saved = { ...clone(definition), name: definition.name.trim(), updatedAt: Date.now() };
    await this.persistence!.save(saved);
    const preferences = { ...this.value.preferences, selected: select || this.value.preferences.selected?.id === saved.id ? saved : this.value.preferences.selected };
    // Publish each committed part separately; a preference failure must not hide a saved definition.
    this.emit({ definitions: [saved, ...this.value.definitions.filter(d => d.id !== saved.id)] });
    await this.persistence!.preferences(preferences); this.emit({ preferences });
  });
  select = (definition: WorkoutDefinition | null) => this.write(async () => {
    if (definition) { const errors = validateWorkout(definition); if (errors.length) throw new Error(errors[0]); }
    const preferences = { ...this.value.preferences, selected: clone(definition) };
    await this.persistence!.preferences(preferences); this.emit({ preferences });
  });
  duplicate = (definition: WorkoutDefinition) => this.save({ ...clone(definition), id: uid(), name: `${definition.name.slice(0, 90)} (copie)`, createdAt: Date.now(), updatedAt: Date.now() });
  remove = (id: string) => this.write(async () => {
    if (this.value.preferences.selected?.id === id) { const preferences = { ...this.value.preferences, selected: null }; await this.persistence!.preferences(preferences); this.emit({ preferences }); }
    await this.persistence!.remove(id); this.emit({ definitions: this.value.definitions.filter(d => d.id !== id) });
    if (this.value.preferences.favoriteKeys?.includes(savedFavoriteKey(id))) {
      const preferences = { ...this.value.preferences, favoriteKeys: this.value.preferences.favoriteKeys.filter(key => key !== savedFavoriteKey(id)) };
      // The workout deletion is committed. Optional bookmark cleanup cannot turn it into a failed deletion.
      this.emit({ preferences });
      try { await this.persistence!.preferences(preferences); }
      catch { this.emit({ message: 'Séance supprimée. Le nettoyage du favori n’a pas pu être enregistré et sera repris lors d’une prochaine sauvegarde.' }); }
    }
  });
  clearForAccountSwitch = async () => {
    await this.initialize();
    return this.write(async () => {
      if (!this.value.ready) throw new Error('Bibliothèque indisponible.');
      const preferences = { ...this.value.preferences, selected: null,
        favoriteKeys: this.value.preferences.favoriteKeys?.filter((key) => !key.startsWith('saved:')) };
      await this.persistence!.clear(preferences);
      this.emit({ definitions: [], preferences, unreadable: 0 });
    });
  };
  toggleFavorite = (key: string) => this.write(async () => {
    if (!validWorkoutFavoriteKey(key)) throw new Error('Cette référence de favori est invalide.');
    if (key.startsWith('saved:') && !this.value.definitions.some(d => savedFavoriteKey(d.id) === key)) throw new Error('Cette séance n’est plus disponible.');
    const savedKeys = new Set(this.value.definitions.map(definition => savedFavoriteKey(definition.id)));
    const current = readWorkoutFavorites(this.value.preferences.favoriteKeys).filter(value =>
      !value.startsWith('saved:') || this.value.unreadable > 0 || savedKeys.has(value));
    const favoriteKeys = current.includes(key) ? current.filter(value => value !== key) : [...current, key];
    if (favoriteKeys.length > MAX_WORKOUT_FAVORITES) throw new Error('La bibliothèque est limitée à 200 favoris. Retirez-en un avant cet ajout.');
    const preferences = { ...this.value.preferences, favoriteKeys };
    await this.persistence!.preferences(preferences); this.emit({ preferences });
  });
  setVoice = (voiceEnabled: boolean) => this.write(async () => {
    coaching.stop();
    const preferences = { ...this.value.preferences, voiceEnabled }; await this.persistence!.preferences(preferences); this.emit({ preferences });
  });
}
export const workouts = new WorkoutLibrary();
