import type { RunRecord } from '../core/types';
import { effectiveEntry, entryState, recordedRun } from './aggregates';
import { openProgression, ProgressionPersistence } from './persistence';
import { CalendarEntry, emptyProgression, ProgressionData, RunJournal, Shoe, TrainingPlan, WeeklyGoal } from './types';
import { readProgression, validateEntry, validateGoal, validateJournal, validatePlan, validateShoe } from './validation';
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
interface State { ready: boolean; busy: boolean; message: string | null; data: ProgressionData }
class ProgressionStore {
  private state: State = { ready: false, busy: false, message: null, data: emptyProgression() };
  private listeners = new Set<() => void>(); private persistence: ProgressionPersistence | null = null;
  private loading: Promise<void> | null = null; private writes: Promise<unknown> = Promise.resolve();
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private emit(patch: Partial<State>) { this.state = { ...this.state, ...patch }; this.listeners.forEach(l => l()); }
  initialize = () => this.loading ?? (this.loading = this.load().finally(() => { this.loading = null; }));
  private async load() {
    if (this.state.ready) return;
    try { this.persistence = await openProgression(); const data = await this.persistence.load(); this.emit({ ready: true, data, message: null }); }
    catch (error) { this.emit({ message: error instanceof Error ? error.message : 'Progression indisponible. Les données de course restent accessibles.' }); }
  }
  private write(change: (data: ProgressionData) => void): Promise<boolean> {
    const action = this.writes.catch(() => undefined).then(async () => {
      await this.initialize(); if (!this.state.ready || !this.persistence) return false;
      this.emit({ busy: true, message: null });
      try { const data = clone(this.state.data); change(data); readProgression(data); await this.persistence.save(data); this.emit({ data }); return true; }
      catch (error) { this.emit({ message: error instanceof Error ? error.message : 'Sauvegarde locale impossible.' }); return false; }
      finally { this.emit({ busy: false }); }
    });
    this.writes = action; return action;
  }
  saveEntry = (entry: CalendarEntry, history: RunRecord[] = []) => { const snapshot = clone(entry); return this.write(data => {
    validateEntry(snapshot); const existing = data.entries.find(e => e.id === snapshot.id);
    const actual = existing ? entryState(existing, history, data).run : null;
    if ((existing?.completedRunId || actual) && snapshot.kind !== existing?.kind) throw new Error('Dissociez l’activité avant de transformer cet élément en jour de repos.');
    const completedRunId = actual?.id ?? existing?.completedRunId ?? snapshot.completedRunId;
    data.entries = [{ ...snapshot, completedRunId, ...(completedRunId ? { status: 'completed' as const } : {}), updatedAt: Date.now() }, ...data.entries.filter(e => e.id !== snapshot.id)];
  }); };
  selectEntry = (id: string | null, history: RunRecord[] = []) => this.write(data => {
    if (id) { const entry = data.entries.find(e => e.id === id); if (!entry || entry.kind !== 'run' || entry.status === 'skipped' || ['completed', 'partial', 'orphaned'].includes(entryState(entry, history, data).state)) throw new Error('Cette séance ne peut pas être relancée avec la même association. Dupliquez-la ou dissociez l’activité.'); }
    data.selectedEntryId = id;
  });
  unlinkEntry = (id: string, history: RunRecord[]) => this.write(data => {
    for (const run of history.filter(r => effectiveEntry(r, data.journals) === id)) this.putJournal(data, { ...this.baseJournal(data, run.id), entryId: null });
    const entry = data.entries.find(e => e.id === id); if (entry) { entry.completedRunId = null; entry.status = 'planned'; entry.updatedAt = Date.now(); }
  });
  removeEntry = (id: string, history: RunRecord[]) => this.write(data => {
    for (const run of history.filter(r => effectiveEntry(r, data.journals) === id)) this.putJournal(data, { ...this.baseJournal(data, run.id), entryId: null });
    data.entries = data.entries.filter(e => e.id !== id); if (data.selectedEntryId === id) data.selectedEntryId = null;
  });
  linkEntry = (id: string, run: RunRecord, history: RunRecord[]) => this.write(data => {
    const entry = data.entries.find(e => e.id === id); if (!entry || entry.kind !== 'run' || !recordedRun(run)) throw new Error('Choisissez une activité enregistrée pour une séance de course.');
    const existing = effectiveEntry(run, data.journals);
    if (existing && existing !== id && data.entries.some(e => e.id === existing)) throw new Error('Cette activité est déjà associée à une autre date. Dissociez-la d’abord.');
    if (history.some(r => r.id !== run.id && effectiveEntry(r, data.journals) === id)) throw new Error('Une activité est déjà associée à cette séance. Dissociez-la d’abord.');
    this.putJournal(data, { ...this.baseJournal(data, run.id), entryId: id }); entry.completedRunId = run.id; entry.status = 'completed'; entry.updatedAt = Date.now();
    if (data.selectedEntryId === id) data.selectedEntryId = null;
  });
  reconcile = (history: RunRecord[]) => {
    if (!this.state.ready || !history.some(run => {
      const id = effectiveEntry(run, this.state.data.journals), entry = this.state.data.entries.find(e => e.id === id);
      return recordedRun(run) && entry?.kind === 'run' && !entry.completedRunId;
    })) return Promise.resolve(true);
    return this.write(data => {
      for (const run of [...history].sort((a, b) => a.startedAt - b.startedAt)) {
        const entry = data.entries.find(e => e.id === effectiveEntry(run, data.journals));
        if (recordedRun(run) && entry?.kind === 'run' && !entry.completedRunId) { entry.completedRunId = run.id; entry.status = 'completed'; if (data.selectedEntryId === entry.id) data.selectedEntryId = null; }
      }
    });
  };
  private baseJournal(data: ProgressionData, runId: string): RunJournal { return data.journals.find(j => j.runId === runId) ?? { runId, feeling: null, difficulty: null, note: '', updatedAt: Date.now() }; }
  private putJournal(data: ProgressionData, journal: RunJournal) { validateJournal(journal); data.journals = [{ ...journal, updatedAt: Date.now() }, ...data.journals.filter(j => j.runId !== journal.runId)]; }
  saveJournal = (journal: RunJournal) => { const copy = clone(journal); return this.write(data => { const previous = data.journals.find(j => j.runId === copy.runId); this.putJournal(data, { ...previous, ...copy }); }); };
  saveGoal = (goal: WeeklyGoal) => { const copy = clone(goal); return this.write(data => { validateGoal(copy); data.goals = [copy, ...data.goals.filter(g => g.week !== copy.week)]; }); };
  removeGoal = (week: string) => this.write(data => { data.goals = data.goals.filter(g => g.week !== week); });
  saveShoe = (shoe: Shoe) => { const copy = clone(shoe); return this.write(data => { validateShoe(copy); data.shoes = [copy, ...data.shoes.filter(s => s.id !== copy.id)]; if (copy.archived && data.defaultShoeId === copy.id) data.defaultShoeId = null; }); };
  selectShoe = (id: string | null) => this.write(data => { if (id && !data.shoes.some(s => s.id === id && !s.archived)) throw new Error('Chaussure active introuvable.'); data.defaultShoeId = id; });
  saveProfileName = (name: string) => this.write(data => { data.profileName = name.trim(); });
  savePlan = (plan: TrainingPlan, entries: CalendarEntry[]) => { const copy = clone({ plan, entries }); return this.write(data => {
    validatePlan(copy.plan); if (data.plans.some(p => p.id === plan.id)) throw new Error('Ce plan est déjà enregistré. Modifiez les dates individuellement.');
    copy.entries.forEach(validateEntry); data.plans.unshift(copy.plan); data.entries.push(...copy.entries);
  }); };
  removePlan = (id: string, history: RunRecord[]) => this.write(data => {
    data.plans = data.plans.filter(p => p.id !== id);
    data.entries = data.entries.filter(e => e.planId !== id || !!entryState(e, history, data).run || !!e.completedRunId);
    for (const e of data.entries) if (e.planId === id) e.planId = null;
    if (!data.entries.some(e => e.id === data.selectedEntryId)) data.selectedEntryId = null;
  });
  clearForAccountSwitch = () => this.write((data) => {
    delete data.profileName;
    Object.assign(data, emptyProgression());
  });
}
export const progression = new ProgressionStore();
export { newEntry } from './entries';
