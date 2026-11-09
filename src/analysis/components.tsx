import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { duration, km, pace } from '../core/format';
import { Button, Copy, Label, Metric, MetricGrid, Panel } from '../ui/components';
import { useTheme } from '../ui/theme';
import { runRecords } from './records';
import { RECORD_DISTANCES, type RunAnalysis } from './types';

export function AnalysisDeviations({ analysis }: { analysis: RunAnalysis }) {
  const { colors } = useTheme(); const [expanded, setExpanded] = useState(false), s = analysis.deviations;
  const items = (expanded ? s.items : s.items.slice(-12)).slice().reverse();
  return <Panel style={{ gap: 14 }}><Label>Écarts d’allure</Label><MetricGrid><Metric label="Écarts documentés" value={s.count === null ? '—' : String(s.count)} /><Metric label="Hors cible" value={s.outsideSeconds === null ? '—' : duration(s.outsideSeconds)} /></MetricGrid>
    <Copy muted variant="caption">Écarts durables : {s.confirmedCount ?? '—'} · plus long : {s.longestSeconds === null ? '—' : duration(s.longestSeconds)}.</Copy>
    <Copy muted variant="caption">{s.source === 'journal' ? 'Journal enregistré pendant la course.' : s.source === 'reconstructed' ? 'Analyse des intervalles et allures fiables enregistrés. Les portions absentes sont exclues.' : s.source === 'counters' ? 'Compteurs archivés conservés. Le nombre et le détail des écarts ne sont pas disponibles.' : 'Mesures insuffisantes pour analyser les écarts.'} Les marges d’alerte ne modifient pas la plage statistique.</Copy>
    {s.partial && <Copy muted variant="caption">Ce détail est partiel ; aucun écart manquant n’a été inventé.</Copy>}
    {items.map(item => <View key={item.id} style={{ gap: 4, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.line }}><Copy style={{ fontWeight: '600' }}>{item.direction === 'tooFast' ? 'Trop rapide' : 'Trop lent'} · {item.seconds.toFixed(1)} s</Copy>
      <Copy muted variant="caption">{item.context} · cible {pace(item.target.fast)} – {pace(item.target.slow)} /km</Copy><Copy muted variant="caption">Temps actif {duration(item.fromSeconds)} → {duration(item.toSeconds)} · {km(item.fromMeters)} → {km(item.toMeters)} km</Copy></View>)}
    {s.items.length > 12 && <Button title={expanded ? 'Réduire le détail' : `Afficher les ${s.items.length} derniers écarts`} secondary onPress={() => setExpanded(!expanded)} />}
    {s.omitted > 0 && <Copy muted variant="caption">{s.omitted} écart(s) antérieur(s) inclus dans les totaux ; détail limité aux 500 derniers.</Copy>}
    {analysis.run.target.kilometerTargets && <View style={{ gap: 6 }}><Label>Plan par kilomètre</Label>{analysis.run.target.kilometerTargets.map(target => <Copy key={target.kilometer} muted variant="caption">Km {target.kilometer} : {pace(target.fast)} – {pace(target.slow)} /km</Copy>)}</View>}
  </Panel>;
}
export function ActivitySegments({ analysis }: { analysis: RunAnalysis }) {
  const results = useMemo(() => runRecords(analysis.run), [analysis.run]);
  return <Panel style={{ gap: 13 }}><Label>Meilleurs segments de cette sortie</Label><Copy muted variant="caption">Temps écoulé sur une distance mesurée dans un segment GPS continu. Chaque segment peut être inclus dans une sortie plus longue.</Copy>
    {!results.length && <Copy muted>Aucune distance de record entièrement couverte avec des mesures suffisamment fiables.</Copy>}
    {results.map(result => <View key={result.meters} style={{ gap: 4 }}><Copy style={{ fontWeight: '600' }}>{RECORD_DISTANCES.find(d => d.meters === result.meters)?.label} · {duration(result.seconds)} · {pace(result.pace)} /km</Copy>
      <Copy muted variant="caption">Du km {km(result.fromMeters, 3)} au km {km(result.toMeters, 3)} · {duration(result.activeSeconds)} actifs.</Copy></View>)}
  </Panel>;
}
