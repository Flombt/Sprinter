import { spacing, fontWeights, fontSizes, radii } from '../ui/tokens';
import { Picker } from '../ui/controls';
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { View } from 'react-native';
import { FeedbackPressable } from '../ui/FeedbackPressable';

import type { RunRecord } from '../core/types';
import { duration, km } from '../core/format';
import { newWorkout, uid } from '../workouts/definition';
import type { WorkoutDefinition } from '../workouts/types';
import { workouts } from '../workouts/store';
import { WorkoutSummary } from '../screens/Workouts';
import { Button, Copy, Header, IconButton, Label, Panel, Screen, ScreenList, styles } from '../ui/components';
import { useTheme } from '../ui/theme';
import { confirm } from '../ui/confirm';
import { entryState, recordedRun } from './aggregates';
import { addDays, addMonths, dateOf, dayKey, dayLabel, monday, monthStart, validDay } from './dates';
import { newEntry, progression } from './store';
import { useLocalNow, useProgression } from './hooks';
import type { CalendarEntry } from './types';
import { Choices, Field } from './ui';
const labels = { planned: 'À venir', missed: 'Manquée · aucune activité associée', skipped: 'Non réalisée', completed: 'Activité réalisée', partial: 'Activité associée · séance partielle ou différente', orphaned: 'Activité source supprimée ou indisponible', rest: 'Repos prévu', restPast: 'Repos prévu · à rapprocher des activités réelles' };
export function EntryEditor({ initial, updatedWorkout, history, canStart, onBack, onSaved, onStart, onEditBlocks }: {
  initial: CalendarEntry; updatedWorkout?: WorkoutDefinition; history: RunRecord[]; canStart: boolean;
  onBack: () => void; onSaved: (day: string) => void; onStart: () => void; onEditBlocks: (definition: WorkoutDefinition) => void;
}) {
  const state = useProgression(), library = useSyncExternalStore(workouts.subscribe, workouts.getSnapshot, workouts.getSnapshot), { colors } = useTheme();
  const [draft, setDraft] = useState<CalendarEntry>(() => JSON.parse(JSON.stringify(initial))), [linking, setLinking] = useState(false);
  const actual = entryState(state.data.entries.find(e => e.id === draft.id) ?? draft, history, state.data), update = (patch: Partial<CalendarEntry>) => setDraft({ ...draft, ...patch });
  const save = async () => { if (await progression.saveEntry(draft, history)) onSaved(draft.day); };
  useEffect(() => { if (updatedWorkout) setDraft(current => ({ ...current, workout: updatedWorkout })); }, [updatedWorkout]);
  return <Screen bottom={40}><Header title="Date et séance" onBack={onBack} /><Field label="Date locale (AAAA-MM-JJ)" value={draft.day} onChange={day => update({ day })} /><Field label="Titre" value={draft.title} onChange={title => update({ title })} />
    {!actual.run && !draft.completedRunId && <Choices value={draft.kind} choices={[["run", "Course"], ["rest", "Repos prévu"]]} onChange={kind => update({ kind, workout: kind === 'rest' ? null : draft.workout })} />}
    {draft.kind === 'run' && <Panel style={{ gap: spacing.md }}><Label>Séance associée · copie indépendante</Label>{draft.workout ? <><Copy>{draft.workout.name}</Copy><WorkoutSummary definition={draft.workout} /></> : <Copy muted>Course libre, sans blocs imposés.</Copy>}
      <Picker accessibilityLabel="Séance du calendrier" selectedValue={draft.workout ? 'current' : 'none'} onValueChange={value => { if (value === 'current') return; const definition = library.definitions.find(d => d.id === value); update({ workout: definition ? JSON.parse(JSON.stringify(definition)) : null }); }} itemStyle={{ color: colors.text }}>
        {draft.workout && <Picker.Item label={draft.workout.name} value="current" />}<Picker.Item label="Course libre" value="none" />{library.definitions.map(d => <Picker.Item key={d.id} label={d.name} value={d.id} />)}</Picker>
      <Button title={draft.workout ? 'Personnaliser les blocs planifiés' : 'Créer des blocs pour cette date'} secondary onPress={() => onEditBlocks(draft.workout ?? newWorkout())} /><Copy muted variant="small">Après avoir appliqué les blocs, enregistrez cette date. La bibliothèque et les sorties passées ne sont pas modifiées.</Copy>
    </Panel>}
    {!actual.run && !draft.completedRunId && <Choices value={draft.status === 'skipped' ? 'skipped' : 'planned'} choices={[["planned", "Planifiée"], ["skipped", "Non réalisée"]]} onChange={status => update({ status })} />}
    <Field label="Notes de planification" value={draft.note} multiline limit={3000} onChange={note => update({ note })} />
    {actual.run && <Copy muted>Associée à la sortie du {dayLabel(dayKey(actual.run.startedAt))} : {km(actual.run.distanceMeters)} km. Déplacer cette date ne déplace pas les statistiques de la sortie.</Copy>}
    <Button title="Enregistrer cette date" disabled={state.busy} onPress={() => void save()} />
    {state.data.entries.some(e => e.id === draft.id) && <><Button title="Dupliquer vers une autre date" secondary disabled={state.busy} onPress={() => { setDraft({ ...draft, id: uid(), status: 'planned', completedRunId: null, planId: null, createdAt: Date.now() }); setLinking(false); }} />
      {draft.kind === 'run' && (actual.run || draft.completedRunId ? <Button title="Dissocier l’activité" secondary disabled={state.busy} onPress={() => { void progression.unlinkEntry(draft.id, history).then(ok => { if (ok) update({ completedRunId: null, status: 'planned' }); }); }} /> : <Button title="Associer une sortie enregistrée" secondary onPress={() => setLinking(!linking)} />)}
      {linking && history.filter(recordedRun).map(run => <Button key={run.id} title={`${dayLabel(dayKey(run.startedAt))} · ${km(run.distanceMeters)} km · ${duration(run.activeSeconds)}`} secondary disabled={state.busy} onPress={() => { void (async () => { if (await progression.saveEntry(draft, history) && await progression.linkEntry(draft.id, run, history)) onSaved(draft.day); })(); }} />)}
      {draft.kind === 'run' && !actual.run && !draft.completedRunId && draft.status !== 'skipped' && <Button title="Enregistrer et préparer cette séance" secondary disabled={state.busy || !canStart} onPress={() => { void (async () => { if (await progression.saveEntry(draft, history) && await progression.selectEntry(draft.id, history)) onStart(); })(); }} />}
      <Button title="Supprimer cet élément du calendrier" secondary danger disabled={state.busy} onPress={() => confirm('Retirer cette date ?', 'Les activités enregistrées et leurs données GPS seront conservées.', 'Retirer', () => { void progression.removeEntry(draft.id, history).then(ok => { if (ok) onBack(); }); }, true)} /></>}
    {state.message && <Copy accessibilityRole="alert" style={{ color: colors.danger }}>{state.message}</Copy>}
  </Screen>;
}
export function Calendar({ history, dateRequest, canStart, onBack, onDetail, onStart, onEdit }: {
  history: RunRecord[]; dateRequest?: { day?: string; revision?: number }; canStart: boolean;
  onBack: () => void; onDetail: (run: RunRecord) => void; onStart: () => void; onEdit: (entry: CalendarEntry) => void;
}) {
  const state = useProgression(), now = useLocalNow(), today = dayKey(now), { colors } = useTheme();
  const [month, setMonth] = useState(monthStart(dateRequest?.day ?? today)), [day, setDay] = useState(dateRequest?.day ?? today);
  useEffect(() => { if (dateRequest?.day) { setDay(dateRequest.day); setMonth(monthStart(dateRequest.day)); } }, [dateRequest]);
  const days = useMemo(() => Array.from({ length: 42 }, (_, i) => addDays(monday(month), i)), [month]);
  const byDay = useMemo(() => { const values = new Map<string, RunRecord[]>(); for (const run of history.filter(recordedRun)) { const key = dayKey(run.startedAt), items = values.get(key) ?? []; items.push(run); values.set(key, items); } return values; }, [history]);
  const entries = state.data.entries.filter(e => e.day === day).sort((a, b) => a.createdAt - b.createdAt), actual = byDay.get(day) ?? [];
  const navigateMonth = (offset: number) => { const next = addMonths(month, offset); if (validDay(next)) { setMonth(next); setDay(next); } };
  const header = <View style={{ gap: spacing.lg, paddingBottom: spacing.md }}><Header title="Mon calendrier" onBack={onBack} /><View style={[styles.row, { justifyContent: 'space-between' }]}><IconButton icon="chevron-back" label="Mois précédent" onPress={() => navigateMonth(-1)} /><Copy style={{ fontWeight: fontWeights.semibold }}>{dateOf(month).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}</Copy><IconButton icon="chevron-forward" label="Mois suivant" onPress={() => navigateMonth(1)} /></View>
    <View style={{ gap: spacing.xs }}><View style={styles.row}>{['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d, i) => <Copy key={i} muted style={{ width: '14.2857%', textAlign: 'center', fontSize: fontSizes.small }}>{d}</Copy>)}</View><View style={[styles.row, { flexWrap: 'wrap' }]}>{days.map(d => { const recorded = byDay.get(d)?.length ?? 0, planned = state.data.entries.filter(e => e.day === d).length; return <FeedbackPressable key={d} accessibilityRole="button" accessibilityLabel={`${dayLabel(d)}, ${recorded} activité(s), ${planned} élément(s) planifié(s)`} accessibilityState={{ selected: d === day }} onPress={() => setDay(d)}
      style={{ width: '14.2857%', minHeight: 53, paddingVertical: spacing.xs, alignItems: 'center', borderRadius: radii.control, backgroundColor: d === day ? colors.raised : 'transparent', opacity: monthStart(d) === month ? 1 : .45, borderWidth: d === today ? 1 : 0, borderColor: colors.line }}><Copy variant="caption">{dateOf(d).getDate()}</Copy><Copy style={{ fontSize: fontSizes.micro, color: recorded ? colors.secondary : colors.muted }}>{recorded ? `${recorded} ●` : planned ? '○' : ''}</Copy></FeedbackPressable>; })}</View></View>
    <Copy muted variant="small">● Activités enregistrées · ○ Éléments planifiés. Les jours sans course enregistrée ne prouvent pas un repos physique.</Copy>
    <Button title="Revenir à aujourd’hui" secondary onPress={() => { setDay(today); setMonth(monthStart(today)); }} /><Label>{dayLabel(day)}</Label>
  </View>;
  const rows = [...actual.map(run => ({ kind: 'run' as const, run })), ...entries.map(entry => ({ kind: 'entry' as const, entry }))];
  return <ScreenList bottom={40} data={rows} ListHeaderComponent={header}
    keyExtractor={item => item.kind === 'run' ? 'run:' + item.run.id : 'entry:' + item.entry.id}
    ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
    renderItem={({ item }) => {
      if (item.kind === 'run') { const { run } = item; return <Panel style={{ gap: spacing.sm }}><Copy>{km(run.distanceMeters)} km · {duration(run.activeSeconds)} actifs</Copy><Button title="Voir cette activité" secondary onPress={() => onDetail(run)} /></Panel>; }
      const { entry } = item;
      const result = entryState(entry, history, state.data, today); return <Panel style={{ gap: spacing.sm }}><Copy style={{ fontWeight: fontWeights.semibold }}>{entry.title}</Copy><Copy muted variant="caption">{labels[result.state]}</Copy>{entry.workout && <WorkoutSummary definition={entry.workout} />}
      {entry.kind === 'rest' && actual.length > 0 && <Copy muted variant="caption">Une course est enregistrée ce jour : ce repos prévu ne correspond pas à une journée sans course.</Copy>}
      <Button title="Consulter ou modifier" secondary onPress={() => onEdit(entry)} /></Panel>;
    }}
    ListFooterComponent={<View style={{ gap: spacing.md, paddingTop: spacing.md }}>
    {!entries.length && !actual.length && <Copy muted>Aucune activité ni planification pour cette date.</Copy>}
    <Button title="Planifier une séance" icon="add" disabled={!state.ready} onPress={() => onEdit(newEntry(day))} /><Button title="Prévoir un jour de repos" secondary disabled={!state.ready} onPress={() => onEdit(newEntry(day, 'rest'))} />
    {state.message && <Copy accessibilityRole="alert">{state.message}</Copy>}
    </View>} />;
}
