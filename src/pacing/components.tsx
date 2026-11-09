import { useState } from 'react';
import { View } from 'react-native';
import type { RunRecord, SignalQuality } from '../core/types';
import { duration, km, pace, targetPercentage } from '../core/format';
import { Button, Copy, Label, Metric, MetricGrid, Panel } from '../ui/components';
import { useTheme } from '../ui/theme';
import { pacingProgress } from './metrics';
import type { DeviationEnd } from './types';

const endLabels: Record<DeviationEnd, string> = { recovered: 'Retour en cible', directionChanged: 'Changement de sens', targetChanged: 'Changement de cible',
  gpsUnavailable: 'Mesure interrompue', paused: 'Pause', finished: 'Fin de sortie', restored: 'Reprise après interruption', free: 'Fin de cible' };
export function PacingProgressPanel({ run, quality = 'good', running = false }: { run: RunRecord; quality?: SignalQuality; running?: boolean }) {
  const { colors } = useTheme(); const progress = pacingProgress(run, quality, running), reference = progress.reference;
  if (!reference || !run.pacing) return null;
  const capital = progress.capitalSeconds === null ? null : Math.round(progress.capitalSeconds);
  const signed = capital === null ? '—' : `${capital > 0 ? '+' : capital < 0 ? '−' : ''}${Math.abs(capital)}`;
  const status = progress.status;
  return <Panel style={{ gap: 15 }}><Label>{reference.explicitTime ? 'Objectif chronométrique' : 'Référence du plan d’allure'}</Label>
    <Copy style={{ fontSize: 19, fontWeight: '600' }}>{km(reference.meters, 2)} km en {duration(reference.seconds)} · temps {reference.timeBasis === 'total' ? 'total' : 'actif'}</Copy>
    {!reference.explicitTime && <Copy muted variant="caption">Référence calculée à partir du milieu des plages prévues ; aucun temps final n’a été imposé.</Copy>}
    <MetricGrid><Metric label="Capital de temps" value={signed} unit={capital === null ? undefined : 's'} />
      <Metric label={status === 'completed' ? 'Temps à la distance cible' : 'Arrivée estimée'} value={progress.projectedFinishSeconds === null ? '—' : duration(progress.projectedFinishSeconds)} /></MetricGrid>
    {capital !== null && <Copy style={{ fontWeight: '600', color: capital < 0 ? colors.orange : colors.text }}>{capital === 0 ? 'À l’heure sur la référence.' : `${Math.abs(capital)} secondes ${capital > 0 ? 'd’avance' : 'de retard'} à la distance mesurée.`}</Copy>}
    {progress.estimatedArrival !== null && <Copy muted>Heure estimée : {new Date(progress.estimatedArrival).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}.</Copy>}
    {status === 'running' && <>{reference.explicitTime && <><Copy>Allure moyenne restante nécessaire : {progress.reachable && progress.requiredPace !== null && progress.requiredPace <= 1200 ? `${pace(progress.requiredPace)} /km` : '—'}.</Copy>
      {progress.requiredPace !== null && progress.requiredPace > 1200 && <Copy muted variant="caption">Marge importante : aucune accélération supplémentaire n’est nécessaire pour respecter ce temps.</Copy>}
      {!progress.reachable && <Copy style={{ fontSize: 12, color: colors.orange }}>Le temps restant exige une allure plus rapide que les limites du guide, ou le temps visé est déjà dépassé.</Copy>}</>}
      <Copy muted variant="caption">Projection à partir de l’allure moyenne active mesurée, sans prévoir de futur arrêt. Le capital suit le temps de passage prévu à cette position.</Copy></>}
    {status === 'acquiring' && <Copy muted>Le capital et l’arrivée deviennent disponibles après 50 m et la stabilisation GPS.</Copy>}
    {status === 'gpsUnavailable' && <Copy muted>Estimations suspendues pendant la stabilisation ou l’interruption GPS.</Copy>}
    {status === 'estimatedTime' && <Copy muted>La chronologie totale comporte une estimation après interruption. Le capital et l’arrivée sur cet objectif de temps total restent indisponibles.</Copy>}
    {status === 'partialDistance' && <Copy style={{ color: colors.orange, fontSize: 12 }}>La distance comporte une interruption ou un historique incomplet. Capital et arrivée indisponibles pour éviter une comparaison trompeuse.</Copy>}
    {status === 'paused' && <Copy muted>{reference.timeBasis === 'total' ? 'Pause : le temps total et le capital continuent d’évoluer. La projection d’arrivée est suspendue.' : 'Pause : le temps actif et le capital sont suspendus.'}</Copy>}
    {status === 'completed' && <Copy muted>Capital figé au franchissement mesuré de la distance cible. L’enregistrement de la sortie peut continuer.</Copy>}
    {status === 'stopped' && <Copy muted>Sortie terminée avant la distance cible. Le capital correspond au dernier point accepté ; aucune arrivée future n’est projetée.</Copy>}
    {reference.timeBasis === 'total' && run.totalEstimated && <Copy muted variant="caption">Le temps total contient une estimation d’interruption après récupération.</Copy>}
  </Panel>;
}
export function PaceHistory({ run, live = false }: { run: RunRecord; live?: boolean }) {
  const { colors } = useTheme(); const [expanded, setExpanded] = useState(false), s = run.pacing;
  if (!s) return run.pacingError ? <Copy style={{ color: colors.orange }}>{run.pacingError}</Copy> : null;
  const items = expanded ? [...s.deviations].reverse() : s.deviations.slice(live ? -3 : -12).reverse();
  const percentage = targetPercentage(run);
  return <Panel style={{ gap: 15 }}><Label>Coach · historique des écarts</Label>
    <MetricGrid><Metric label="Temps fiable en cible" value={percentage === null ? '—' : `${percentage.toFixed(0)} %`} /><Metric label="Écarts mesurés" value={String(s.deviationCount)} /></MetricGrid>
    <Copy muted variant="caption">{s.confirmedCount} écart(s) durable(s) · hors cible {duration(s.tooFastSeconds + s.tooSlowSeconds + s.legacyOutsideSeconds)} · plus long {duration(s.longestDeviationSeconds)}.</Copy>
    <Copy muted variant="caption">Pourcentage sur les mesures d’allure fiables dans les plages exactes. La marge et l’hystérésis des alertes ne modifient pas ce score. Chaque écart peut être enregistré avant d’être assez long pour déclencher une alerte.</Copy>
    {s.legacyReliableSeconds > 0 && <Copy muted variant="caption">Les statistiques antérieures à ce journal sont conservées ; leurs écarts détaillés ne sont pas disponibles.</Copy>}
    {!items.length && <Copy muted>{s.reliableSeconds > 0 ? 'Aucun écart mesuré dans les portions fiables.' : 'Les écarts apparaîtront avec des mesures d’allure fiables.'}</Copy>}
    {items.map(item => <View key={item.id} style={{ gap: 5, paddingTop: 11, borderTopWidth: 1, borderTopColor: colors.line }}>
      <Copy style={{ fontWeight: '600' }}>{item.direction === 'tooFast' ? 'Trop rapide' : 'Trop lent'} · {item.seconds.toFixed(1)} s{item.confirmed ? ' · durable' : ''}</Copy>
      <Copy muted variant="caption">{item.context} · {pace(item.target.fast)} – {pace(item.target.slow)} /km</Copy>
      <Copy muted variant="caption">Temps actif {duration(item.fromSeconds)} → {duration(item.toSeconds)} · {km(item.fromMeters)} → {km(item.toMeters)} km · extrême lissée {pace(item.extremePace)} /km</Copy>
      <Copy muted variant="small">{item.endReason === null ? 'En cours de mesure' : endLabels[item.endReason]}</Copy>
    </View>)}
    {s.deviations.length > (live ? 3 : 12) && <Button title={expanded ? 'Réduire l’historique' : `Afficher les ${s.deviations.length} derniers écarts`} secondary onPress={() => setExpanded(!expanded)} />}
    {s.omittedDeviations > 0 && <Copy muted variant="caption">{s.omittedDeviations} écart(s) plus ancien(s) inclus dans les totaux. Le détail est limité aux 500 derniers.</Copy>}
    {run.target.kilometerTargets && !live && <View style={{ gap: 8 }}><Label>Plages prévues par kilomètre</Label>{run.target.kilometerTargets.map(p => <Copy key={p.kilometer} muted variant="caption">Km {p.kilometer} : {pace(p.fast)} – {pace(p.slow)} /km</Copy>)}</View>}
  </Panel>;
}
