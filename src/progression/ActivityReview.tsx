import { spacing } from '../ui/tokens';
import { Picker } from '../ui/controls';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import type { RunRecord } from '../core/types';
import { duration } from '../core/format';
import { activityAnalysis } from '../analysis/cache';
import { usePersonalRecords } from '../analysis/useRecords';
import { Button, Copy, Label, Panel } from '../ui/components';
import { useTheme } from '../ui/theme';
import { useProgression } from './hooks';
import { journalFor } from './aggregates';
import { progression } from './store';
import { recordTimeline } from './records';
import type { ProgressionData, RunJournal } from './types';
import { Choices, Field } from './ui';

export function ActivityReview({ run, history }: { run: RunRecord; history: RunRecord[] }) {
  const state = usePersonalRecords(history), analysis = useMemo(() => activityAnalysis(run), [run]);
  const complete = state.done >= history.length;
  const achievements = useMemo(() => complete ? recordTimeline(state.records.flatMap(r => r.performances)).filter(e => e.performance.runId === run.id).sort((a, b) => b.performance.meters - a.performance.meters) : [], [state.records, run.id, complete]);
  const gains = achievements.filter(a => a.gainSeconds !== null);
  return <Panel style={{ gap: spacing.md }}><Label>Votre bilan automatique</Label>
    <Copy>{analysis.deviations.percentage === null ? 'Les mesures ne permettent pas de calculer un pourcentage fiable en cible.' : `Vous avez respecté votre cible pendant ${analysis.deviations.percentage.toFixed(0)} % du temps d’allure fiable, sur ${duration(analysis.deviations.reliableSeconds)} de mesures.`}</Copy>
    {!complete ? <Copy muted>Analyse des records de l’historique : {state.done} / {history.length}.</Copy> : gains.length ? gains.slice(0, 3).map(gain => <Copy key={gain.performance.meters}>Vous avez amélioré votre record GPS sur {gain.label} de {gain.gainSeconds! < .5 ? 'moins d’une seconde' : `${Math.round(gain.gainSeconds!)} seconde${Math.round(gain.gainSeconds!) > 1 ? 's' : ''}`}.</Copy>)
      : achievements.length ? <Copy>Première marque GPS qualifiée sur {achievements.slice(0, 3).map(a => a.label).join(', ')}.</Copy> : <Copy muted>Aucun nouveau record GPS qualifié pour cette activité.</Copy>}
    <Copy muted variant="small">Bilan calculé localement à partir des mesures et des activités exploitables. Les pauses et pertes GPS ne deviennent pas des records. Aucun service d’IA ni estimation de résultat futur.</Copy>
  </Panel>;
}
function JournalForm({ run, data }: { run: RunRecord; data: ProgressionData }) {
  const existing = journalFor(data, run.id), { colors } = useTheme();
  const [feeling, setFeeling] = useState<RunJournal['feeling']>(existing?.feeling ?? null), [difficulty, setDifficulty] = useState<number | null>(existing?.difficulty ?? null);
  const [note, setNote] = useState(existing?.note ?? ''), [shoeId, setShoe] = useState(existing?.shoeId !== undefined ? existing.shoeId : run.shoeId ?? null);
  const [busy, setBusy] = useState(false), [saved, setSaved] = useState(false);
  const save = async () => { setBusy(true); if (await progression.saveJournal({ runId: run.id, feeling, difficulty, note, shoeId, updatedAt: Date.now() })) setSaved(true); setBusy(false); };
  return <Panel style={{ gap: spacing.lg }}><Label>Journal après course</Label><Copy muted variant="caption">Ces informations sont facultatives et restent sur cet appareil.</Copy>
    <Choices value={feeling ?? 'none'} choices={[["none", "Non renseigné"], ["great", "Très bonnes"], ["good", "Bonnes"], ["neutral", "Neutres"], ["tired", "Fatigué"], ["difficult", "Difficiles"]]} onChange={v => { setFeeling(v === 'none' ? null : v as RunJournal['feeling']); setSaved(false); }} />
    <Label>Difficulté ressentie · 1 très facile, 10 très difficile</Label><Picker accessibilityLabel="Difficulté ressentie de un à dix" selectedValue={difficulty ?? 0} onValueChange={v => { setDifficulty(Number(v) || null); setSaved(false); }} itemStyle={{ color: colors.text }}>
      <Picker.Item label="Non renseignée" value={0} />{Array.from({ length: 10 }, (_, i) => <Picker.Item key={i} label={String(i + 1)} value={i + 1} />)}</Picker>
    <Field label="Vos notes" value={note} multiline limit={5000} onChange={v => { setNote(v); setSaved(false); }} />
    <Label>Chaussures de cette activité</Label><Picker accessibilityLabel="Chaussures de cette activité" selectedValue={shoeId ?? ''} onValueChange={v => { setShoe(String(v) || null); setSaved(false); }} itemStyle={{ color: colors.text }}>
      <Picker.Item label="Non attribuées" value="" />{shoeId && !data.shoes.some(s => s.id === shoeId) && <Picker.Item label="Référence ancienne indisponible" value={shoeId} />}
      {data.shoes.map(s => <Picker.Item key={s.id} label={`${s.name}${s.archived ? ' · archivée' : ''}`} value={s.id} />)}</Picker>
    <Button title={busy ? 'Enregistrement…' : 'Enregistrer mon journal'} secondary disabled={busy} onPress={() => void save()} />{saved && <Copy accessibilityLiveRegion="polite" muted>Journal enregistré.</Copy>}
  </Panel>;
}
export function ActivityJournal({ run }: { run: RunRecord }) {
  const state = useProgression();
  return <View style={{ gap: spacing.md }}>{state.ready ? <JournalForm key={run.id} run={run} data={state.data} /> : <Panel><Copy muted>Journal local en attente.</Copy><Button title="Ouvrir le journal" secondary onPress={() => void progression.initialize()} /></Panel>}
    {state.message && <Copy accessibilityRole="alert">{state.message}</Copy>}</View>;
}
