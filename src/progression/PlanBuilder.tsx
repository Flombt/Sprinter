import { useState } from 'react';
import { Pressable, View } from 'react-native';
import type { RunRecord } from '../core/types';
import { km } from '../core/format';
import { uid } from '../workouts/definition';
import { Button, Copy, Header, Label, Panel, Screen, styles } from '../ui/components';
import { useTheme } from '../ui/theme';
import { confirm } from '../ui/confirm';
import { addDays, dayKey, dayLabel, dayStart, monday } from './dates';
import { aggregate } from './aggregates';
import { generatePlan } from './plans';
import { useLocalNow, useProgression } from './hooks';
import { progression } from './store';
import type { CalendarEntry, TrainingPlan } from './types';
import { Choices, Field, numberValue } from './ui';
export function Plans({ history, onBack, onSaved }: { history: RunRecord[]; onBack: () => void; onSaved: (day: string) => void }) {
  const state = useProgression(), { colors } = useTheme(), now = useLocalNow(), today = dayKey(now);
  const recent = aggregate(history, dayStart(addDays(today, -27)), now + 1, now);
  const [goal, setGoal] = useState<TrainingPlan['goalMeters']>(5000), [name, setName] = useState('Préparation 5 km');
  const [start, setStart] = useState(addDays(monday(today), 7)), [weeks, setWeeks] = useState('6'), [weekdays, setWeekdays] = useState([1, 3, 6]);
  const [base, setBase] = useState(recent.meters > 0 ? (recent.meters / 4000).toFixed(1) : ''), [maximum, setMaximum] = useState(recent.runs.length ? (recent.runs.reduce((n, r) => Math.max(n, r.distanceMeters), 0) / 1000).toFixed(1) : '');
  const [growth, setGrowth] = useState('0'), [error, setError] = useState<string | null>(null), [preview, setPreview] = useState<{ plan: TrainingPlan; entries: CalendarEntry[] } | null>(null);
  const changed = (action: () => void) => { action(); setPreview(null); setError(null); };
  const build = () => { try {
    const plan: TrainingPlan = { id: uid(), name: name.trim(), goalMeters: goal, start, weeks: numberValue(weeks), weekdays,
      baseWeekMeters: numberValue(base) * 1000, maximumSessionMeters: numberValue(maximum) * 1000, growthPercent: numberValue(growth), createdAt: Date.now() };
    if (plan.start < today) throw new Error('Choisissez un lundi présent ou futur pour créer un plan.');
    setPreview({ plan, entries: generatePlan(plan) }); setError(null);
  } catch (e) { setError(e instanceof Error ? e.message : 'Plan invalide.'); setPreview(null); } };
  const save = async () => { if (preview && await progression.savePlan(preview.plan, preview.entries)) onSaved(preview.plan.start); };
  return <Screen bottom={40}><Header title="Plans de préparation" onBack={onBack} /><Copy muted>Une structure locale pour organiser votre préparation. Vous choisissez le volume, les jours et le plafond par sortie. Allure libre par défaut, sans prédiction de performance ni obligation de courir la distance finale à une date donnée.</Copy>
    <Choices<TrainingPlan['goalMeters']> value={goal} choices={[[5000, '5 km'], [10000, '10 km'], [21097.5, 'Semi-marathon']]} onChange={v => changed(() => { setGoal(v); setName(`Préparation ${v === 5000 ? '5 km' : v === 10000 ? '10 km' : 'semi-marathon'}`); setWeeks(v === 5000 ? '6' : v === 10000 ? '8' : '12'); })} />
    <Field label="Nom du plan" value={name} onChange={v => changed(() => setName(v))} /><Field label="Lundi de début (AAAA-MM-JJ)" value={start} onChange={v => changed(() => setStart(v))} /><Field label="Nombre de semaines (4 à 24)" value={weeks} numeric onChange={v => changed(() => setWeeks(v))} />
    <Label>Jours de course · choisissez 2 à 4 jours</Label><View style={[styles.row, { gap: 6, flexWrap: 'wrap' }]}>{['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((label, i) => <Pressable key={i} accessibilityRole="button" accessibilityState={{ selected: weekdays.includes(i) }} onPress={() => changed(() => setWeekdays(weekdays.includes(i) ? weekdays.filter(d => d !== i) : [...weekdays, i]))}
      style={{ minHeight: 44, padding: 11, borderWidth: 1, borderColor: weekdays.includes(i) ? colors.text : colors.line, borderRadius: 12 }}><Copy>{label}</Copy></Pressable>)}</View>
    <Field label="Volume initial choisi (km/semaine)" value={base} numeric onChange={v => changed(() => setBase(v))} /><Field label="Plafond choisi par sortie (km)" value={maximum} numeric onChange={v => changed(() => setMaximum(v))} /><Field label="Progression linéaire par semaine (%)" value={growth} numeric onChange={v => changed(() => setGrowth(v))} />
    <Copy muted variant="caption">Si disponibles, les champs sont préremplis avec les kilomètres enregistrés sur les 28 jours calendaires et la plus longue sortie de cette fenêtre. Vérifiez ces valeurs : elles ne mesurent pas votre capacité future. La progression vaut zéro par défaut. Les jours non choisis sont indiqués comme repos prévu, sans certifier un repos réel.</Copy>
    <Button title="Prévisualiser le calendrier" secondary onPress={build} />{error && <Copy accessibilityRole="alert" style={{ color: colors.danger }}>{error}</Copy>}
    {preview && <Panel style={{ gap: 12 }}><Label>Calendrier proposé · allures libres</Label><Copy>{preview.plan.weeks} semaines, {preview.plan.weekdays.length} sorties par semaine. Chaque séance peut ensuite être déplacée ou éditée.</Copy>
      {Array.from({ length: preview.plan.weeks }, (_, i) => { const entries = preview.entries.slice(i * 7, i * 7 + 7), meters = entries.reduce((sum, e) => sum + (e.workout?.blocks[0]?.kind === 'segment' ? e.workout.blocks[0].end.value : 0), 0); return <Copy key={i} muted variant="caption">S{i + 1} · {dayLabel(entries[0]!.day)} · {km(meters)} km</Copy>; })}
      <Button title="Ajouter ce plan au calendrier" disabled={state.busy || !state.ready} onPress={() => void save()} /><Copy muted variant="small">Les éléments déjà présents sont conservés ; les dates communes restent visibles pour vous permettre d’adapter le plan.</Copy>
    </Panel>}
    {state.message && <Copy accessibilityRole="alert">{state.message}</Copy>}
    <Label>Plans enregistrés</Label>{state.data.plans.map(plan => <Panel key={plan.id} style={{ gap: 12 }}><Copy style={{ fontWeight: '600' }}>{plan.name}</Copy><Copy muted>{plan.weeks} semaines à partir du {dayLabel(plan.start)}</Copy>
      <Button title="Voir les dates et personnaliser" secondary onPress={() => onSaved(plan.start)} /><Button title="Retirer les éléments non réalisés" secondary danger disabled={state.busy} onPress={() => confirm('Retirer ce plan ?', 'Les activités et leurs associations réalisées restent conservées. Les éléments non réalisés de ce plan seront retirés du calendrier.', 'Retirer', () => { void progression.removePlan(plan.id, history); }, true)} />
    </Panel>)}
  </Screen>;
}
