import { spacing, fontSizes, fontWeights } from '../ui/tokens';
import { Picker } from '../ui/controls';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import type { RunRecord } from '../core/types';
import { duration, km, pace } from '../core/format';
import { compareRuns, equivalentDistance } from '../analysis/compare';
import { Copy, Header, Label, Metric, MetricGrid, Panel, Screen, styles } from '../ui/components';
import { useAdaptiveLayout, useTheme } from '../ui/theme';
const time = (n: number | null | undefined) => n == null ? '—' : duration(n);
const delta = (n: number | null) => n === null ? '—' : `${n < 0 ? '−' : n > 0 ? '+' : ''}${duration(Math.abs(n))}`;
function Row({ title, a, b }: { title: string; a: string; b: string }) {
  const { largeText } = useAdaptiveLayout();
  return largeText ? <View style={{ gap: spacing.sm }}><Label>{title}</Label><MetricGrid><Metric label="Sortie A" value={a} /><Metric label="Sortie B" value={b} /></MetricGrid></View>
    : <View style={[styles.row, { gap: spacing.sm, alignItems: 'flex-start' }]}><Copy muted variant="caption" style={{ flex: 1 }}>{title}</Copy><Copy variant="caption" style={{ flex: 1, textAlign: 'right' }}>{a}</Copy><Copy variant="caption" style={{ flex: 1, textAlign: 'right' }}>{b}</Copy></View>;
}
export default function Comparison({ history, initialId, onBack }: { history: RunRecord[]; initialId?: string; onBack: () => void }) {
  const { colors } = useTheme(); const [firstId, setFirst] = useState(initialId ?? ''), [secondId, setSecond] = useState('');
  const first = history.find(r => r.id === firstId), second = history.find(r => r.id === secondId);
  const candidates = first ? history.filter(run => equivalentDistance(first, run)) : [];
  const comparison = useMemo(() => first && second ? compareRuns(first, second) : null, [first, second]);
  const label = (run: RunRecord) => `${new Date(run.startedAt).toLocaleDateString('fr-FR')} · ${km(run.distanceMeters)} km · ${duration(run.activeSeconds)}`;
  return <Screen bottom={40}><Header title="Comparer deux sorties" onBack={onBack} /><Copy muted>Choisissez deux distances équivalentes à 5 % près. Les temps sont comparés à la même distance réellement couverte, sans extrapoler la sortie la plus courte.</Copy>
    <Panel style={{ gap: spacing.sm }}><Label>Sortie A</Label><Picker accessibilityLabel="Première sortie" selectedValue={firstId} onValueChange={id => { setFirst(String(id)); setSecond(''); }} itemStyle={{ color: colors.text }}><Picker.Item label="Choisir une sortie" value="" />{history.map(run => <Picker.Item key={run.id} label={label(run)} value={run.id} />)}</Picker></Panel>
    <Panel style={{ gap: spacing.sm }}><Label>Sortie B · distance équivalente</Label><Picker accessibilityLabel="Seconde sortie" enabled={!!first && candidates.length > 0} selectedValue={secondId} onValueChange={id => setSecond(String(id))} itemStyle={{ color: colors.text }}><Picker.Item label="Choisir une autre sortie" value="" />{candidates.map(run => <Picker.Item key={run.id} label={label(run)} value={run.id} />)}</Picker>
      {first && !candidates.length && <Copy muted>Aucune autre activité de distance équivalente dans l’historique.</Copy>}</Panel>
    {comparison && <><Panel style={{ gap: spacing.md }}><Label>Bilans enregistrés · A / B</Label>
      <Row title="Distance" a={`${km(first!.distanceMeters)} km`} b={`${km(second!.distanceMeters)} km`} /><Row title="Temps actif" a={time(first!.activeSeconds)} b={time(second!.activeSeconds)} />
      <Row title="Temps total" a={first!.totalEstimated ? 'Estimé' : time(first!.totalSeconds)} b={second!.totalEstimated ? 'Estimé' : time(second!.totalSeconds)} />
      <Row title="Allure moyenne active" a={`${pace(comparison.a.averagePace)} /km`} b={`${pace(comparison.b.averagePace)} /km`} />
      <Row title="Plus rapide fiable" a={`${pace(comparison.a.fastestReliablePace)} /km`} b={`${pace(comparison.b.fastestReliablePace)} /km`} />
      <Row title="Temps fiable en cible" a={comparison.a.deviations.percentage === null ? '—' : `${comparison.a.deviations.percentage.toFixed(0)} %`} b={comparison.b.deviations.percentage === null ? '—' : `${comparison.b.deviations.percentage.toFixed(0)} %`} />
      <Row title="Dénivelé positif" a={comparison.a.ascent === null ? '—' : `${Math.round(comparison.a.ascent)} m`} b={comparison.b.ascent === null ? '—' : `${Math.round(comparison.b.ascent)} m`} />
    </Panel><Panel style={{ gap: spacing.md }}><Label>À distance identique</Label>{comparison.commonMeters !== null && <Copy style={{ fontSize: fontSizes.section, fontWeight: fontWeights.semibold }}>{km(comparison.commonMeters, 3)} km</Copy>}
      {comparison.reason ? <Copy muted>{comparison.reason}</Copy> : <><Row title="Temps actif au passage" a={time(comparison.commonA!.activeSeconds)} b={time(comparison.commonB!.activeSeconds)} />
        <Row title="Temps total au passage" a={time(comparison.commonA!.totalSeconds)} b={time(comparison.commonB!.totalSeconds)} /><Copy style={{ fontWeight: fontWeights.semibold }}>Écart B − A : {delta(comparison.activeDelta)} actif · {delta(comparison.totalDelta)} total.</Copy>
        {comparison.activeDelta !== null && <Copy muted>{Math.abs(comparison.activeDelta) < .5 ? 'Temps actifs équivalents à cette distance.' : comparison.activeDelta < 0 ? 'B atteint cette distance plus rapidement en temps actif.' : 'A atteint cette distance plus rapidement en temps actif.'}</Copy>}
        {comparison.totalDelta === null && <Copy muted variant="caption">Le temps total ne peut pas être comparé sans deux chronométrages enregistrés et non estimés.</Copy>}
      </>}
    </Panel><Copy muted variant="caption">Les plages cibles et les parcours peuvent différer. Le pourcentage en cible décrit le respect du plan de chaque sortie.</Copy></>}
  </Screen>;
}
