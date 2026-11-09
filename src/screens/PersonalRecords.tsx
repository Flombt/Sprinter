import { View } from 'react-native';
import type { RunRecord } from '../core/types';
import { duration, km, pace } from '../core/format';
import { Button, Copy, Header, Label, Panel, Screen } from '../ui/components';
import { usePersonalRecords } from '../analysis/useRecords';
export default function PersonalRecords({ history, onBack, onDetail }: { history: RunRecord[]; onBack: () => void; onDetail: (run: RunRecord) => void }) {
  const state = usePersonalRecords(history);
  return <Screen bottom={40}><Header title="Records personnels GPS" onBack={onBack} /><Copy muted>Les meilleures performances mesurées sur 1 km, 5 km, 10 km, semi et marathon. Une portion de course peut établir un record ; les pauses et pertes GPS ne sont pas traversées.</Copy>
    {state.busy && <Copy accessibilityLiveRegion="polite">Analyse de l’historique : {state.done} / {history.length} activités.</Copy>}
    {!history.length && <Copy>Aucune activité enregistrée. Les records seront calculés à partir de vos propres parcours.</Copy>}
    {state.records.map(record => <Panel key={record.meters} style={{ gap: 12 }}><Label>{record.label}</Label>{record.best ? <><Copy style={{ fontSize: 32, lineHeight: 40, fontWeight: '600' }}>{duration(record.best.seconds)}</Copy><Copy>{pace(record.best.pace)} /km · {new Date(record.best.startedAt).toLocaleDateString('fr-FR')}</Copy>
      <Copy muted variant="caption">Segment du km {km(record.best.fromMeters, 3)} au km {km(record.best.toMeters, 3)} · {record.performances.length} activité(s) qualifiée(s).</Copy>
      <Button title="Consulter la course" secondary onPress={() => { const run = history.find(r => r.id === record.best!.runId); if (run) onDetail(run); }} />
    </> : <Copy muted>{state.busy ? 'Recherche dans vos activités…' : 'Aucune portion continue suffisamment longue et fiable.'}</Copy>}</Panel>)}
    {state.unavailable > 0 && <View><Copy muted variant="caption">{state.unavailable} activité(s) sans portion qualifiée pour ces distances. Leur historique reste disponible.</Copy></View>}
    <Copy muted variant="caption">Qualification : précision horizontale ≤ 15 m, pas de trou GPS de plus de 6 s, chronologie cohérente et aucune extrapolation de distance. Ces records sont issus du GPS.</Copy>
  </Screen>;
}
