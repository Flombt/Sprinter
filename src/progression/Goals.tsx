import { spacing } from '../ui/tokens';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import type { RunRecord } from '../core/types';
import { km } from '../core/format';
import { Button, Copy, Label, Panel } from '../ui/components';
import { aggregate } from './aggregates';
import { addDays, dayLabel, dayStart, monday } from './dates';
import type { ProgressionData } from './types';
import { progression } from './store';
import { Field, numberValue } from './ui';
export function Goals({ data, history, week, busy, now, onSaved }: { data: ProgressionData; history: RunRecord[]; week: string; busy: boolean; now: number; onSaved: (week: string) => void }) {
  const goal = data.goals.find(g => g.week === week);
  const [date, setDate] = useState(week), [distance, setDistance] = useState(''), [outings, setOutings] = useState('');
  const [error, setError] = useState<string | null>(null), [saved, setSaved] = useState(false);
  useEffect(() => { setDate(week); setDistance(goal?.distanceMeters ? String(goal.distanceMeters / 1000) : ''); setOutings(goal?.outings ? String(goal.outings) : ''); setSaved(false); }, [week, goal?.distanceMeters, goal?.outings]);
  const actual = aggregate(history, dayStart(week), dayStart(addDays(week, 7)), now);
  const save = async () => { setError(null); try {
    if (monday(date) !== date) throw new Error('Choisissez la date du lundi de cette semaine.');
    if (await progression.saveGoal({ week: date, distanceMeters: distance.trim() ? numberValue(distance) * 1000 : null, outings: outings.trim() ? numberValue(outings) : null })) { setSaved(true); onSaved(date); }
  } catch (e) { setError(e instanceof Error ? e.message : 'Objectif invalide.'); } };
  return <Panel style={{ gap: spacing.lg }}><Label>Objectif de la semaine du {dayLabel(week)}</Label>
    {goal ? <View style={{ gap: spacing.sm }}>{goal.distanceMeters !== null && <Copy>{km(actual.meters)} / {km(goal.distanceMeters)} km · {Math.min(100, actual.meters / goal.distanceMeters * 100).toFixed(0)} %{actual.meters >= goal.distanceMeters ? ' · atteint' : ''}</Copy>}
      {goal.outings !== null && <Copy>{actual.outings} / {goal.outings} sorties{actual.outings >= goal.outings ? ' · atteint' : ''}</Copy>}</View> : <Copy muted>Aucun objectif pour cette semaine. Les semaines sans objectif ne sont pas considérées comme des échecs.</Copy>}
    <Field label="Lundi de la semaine (AAAA-MM-JJ)" value={date} onChange={v => { setDate(v); setSaved(false); }} />
    <Field label="Distance visée (km, facultatif)" value={distance} numeric onChange={v => { setDistance(v); setSaved(false); }} />
    <Field label="Nombre de sorties visé (facultatif)" value={outings} numeric onChange={v => { setOutings(v); setSaved(false); }} />
    <Button title="Enregistrer cet objectif" secondary disabled={busy} onPress={() => void save()} />
    {goal && <Button title="Retirer l’objectif de cette semaine" secondary disabled={busy} onPress={() => void progression.removeGoal(week)} />}
    {error && <Copy accessibilityRole="alert">{error}</Copy>}{saved && <Copy muted accessibilityLiveRegion="polite">Objectif enregistré.</Copy>}
  </Panel>;
}
