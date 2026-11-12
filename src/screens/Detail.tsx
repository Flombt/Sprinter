import { useMemo } from 'react';
import { View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { RunRecord } from '../core/types';
import { duration, km, pace, runDate, targetLabel } from '../core/format';
import { Button, Copy, Divider, Header, Icon, Label, Metric, MetricGrid, NumericReadout, Panel, Screen, SectionHeading, styles } from '../ui/components';
import { spacing, fontSizes, motion, radii, iconSizes } from '../ui/tokens';
import RouteMap from '../ui/RouteMap';
import { PaceChart } from '../ui/PaceChart';
import { useAdaptiveLayout, useTheme } from '../ui/theme';
import { confirm } from '../ui/confirm';
import { session } from '../services/session';
import { WorkoutResult } from '../workouts/components';
import { PacingProgressPanel } from '../pacing/components';
import { activityAnalysis } from '../analysis/cache';
import { AnalysisDeviations, ActivitySegments } from '../analysis/components';
import { SeriesChart } from '../analysis/SeriesChart';
import { ActivityJournal, ActivityReview } from '../progression/ActivityReview';
import { HealthSyncPanel } from '../apple/components';
import { ActivityGpxButton, ActivitySharing } from '../sharing/components';
import { FavouriteActions } from '../tools/activityComponents';
import { paceRoute, paceZones } from '../analysis/paceRoute';
import { paceZoneColor } from '../ui/routeMapData';
import { TargetRing } from '../ui/TargetRing';

const summaryEntrance = FadeInDown.duration(motion.duration.standard);
const mapEntrance = FadeInDown.duration(motion.duration.standard).delay(motion.duration.fast);
const zoneLabels = { tooFast: 'Trop rapide', onTarget: 'Dans la cible', tooSlow: 'Trop lent', unknown: 'Allure indisponible' };

export default function Detail({ run, history, onBack, justFinished = false, onCompare, onRecords, onApple, onTools, onRepeat }: { run: RunRecord; history: RunRecord[]; onBack: () => void; justFinished?: boolean; onCompare?: () => void; onRecords?: () => void; onApple?: () => void; onTools?: () => void; onRepeat?: () => void }) {
  const analysis = useMemo(() => activityAnalysis(run), [run]);
  const { colors, reduceMotion } = useTheme(); const { largeText } = useAdaptiveLayout(); const percentage = analysis.deviations.percentage;
  const paceParts = useMemo(() => paceRoute(run, analysis.mapPoints), [analysis.mapPoints, run]);
  const zones = paceZones.filter(zone => paceParts.some(part => part.zone === zone));
  const animate = justFinished && !reduceMotion;
  const splits = analysis.splits, speed = analysis.averageSpeed;
  const remove = () => confirm('Supprimer cette course ?', 'Son parcours et ses statistiques seront définitivement supprimés de cet appareil.', 'Supprimer', () => { void session.deleteRun(run.id).then(ok => { if (ok) onBack(); }); }, true);
  return <Screen bottom={40}><Header title={justFinished ? 'Course enregistrée' : 'Votre sortie'} onBack={onBack} />
    <Animated.View entering={animate ? summaryEntrance : undefined} style={[{ gap: spacing.sm }, justFinished && {
      backgroundColor: colors.raised, borderRadius: radii.card, padding: spacing.xl,
    }]}><View style={[styles.row, { gap: spacing.sm, flexWrap: 'wrap' }]}><Icon name="walk-outline" size={iconSizes.standard} color={colors.secondary} /><Label>Course à pied · {runDate(run.startedAt)}</Label></View>
      <View style={[styles.row, { alignItems: 'baseline', flexWrap: 'wrap', gap: spacing.sm }]}><NumericReadout value={km(run.distanceMeters)} variant="distance" label={`${km(run.distanceMeters)} kilomètres`} /><Copy muted variant="section">km</Copy></View>
      <Copy muted variant="caption">{new Date(run.startedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} · {duration(run.activeSeconds)} de temps actif · {pace(analysis.averagePace)} /km</Copy></Animated.View>
    <Animated.View entering={animate ? mapEntrance : undefined} style={{ gap: spacing.sm }}>
      <View style={[styles.row, { justifyContent: 'space-between', flexWrap: 'wrap', gap: spacing.sm }]}>
        <SectionHeading title="Votre tracé" />
        {run.endedAt !== null && <ActivityGpxButton run={run} />}
      </View>
      <RouteMap points={analysis.mapPoints} paceParts={paceParts} height={justFinished ? 310 : 250} interactive />
      {zones.length > 0 && <View style={[styles.row, { flexWrap: 'wrap', gap: spacing.md }]}>{zones.map(zone =>
        <View key={zone} style={[styles.row, { gap: spacing.xs }]}>
          <View style={{ width: 12, height: 4, borderRadius: radii.xs, backgroundColor: paceZoneColor(zone, colors) }} />
          <Copy variant="small" muted>{zoneLabels[zone]}</Copy>
        </View>)}</View>}
    </Animated.View>
    {analysis.warnings.map(warning => <Copy key={warning} style={{ color: colors.orange, fontSize: fontSizes.small }}>{warning}</Copy>)}
    <ActivityReview run={run} history={history} />
    <FavouriteActions run={run} onTools={onTools} onRepeat={onRepeat} />
    <Panel style={{ gap: spacing.xxl }}><MetricGrid><Metric label="Temps actif" value={duration(run.activeSeconds)} /><Metric label="Allure moyenne active" value={pace(analysis.averagePace)} unit="/km" /></MetricGrid>
      <MetricGrid><Metric label="Temps total" value={run.totalSeconds === undefined ? '—' : duration(run.totalSeconds)} /><Metric label="Pauses" value={run.totalSeconds === undefined ? '—' : duration(Math.max(0, run.totalSeconds - run.activeSeconds))} /></MetricGrid>
      {run.totalEstimated && <Copy muted variant="small">Le temps total inclut une estimation de l’interruption après récupération. Le temps actif est conservé séparément.</Copy>}
      <Copy muted variant="small">{run.healthKit ? 'Temps issus de Santé ; détail des pauses indisponible.' : run.autoPauseEnabled ? `${run.autoPauseCount ?? 0} pause(s) automatique(s).` : 'Pause automatique désactivée pour cette sortie.'}</Copy>
      <Divider /><MetricGrid><Metric label="Plus rapide fiable" value={pace(analysis.fastestReliablePace)} unit="/km" /><Metric label="Plus lente fiable" value={pace(analysis.slowestReliablePace)} unit="/km" /></MetricGrid>
      <Metric label="Vitesse moyenne active" value={speed === null ? '—' : speed.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} unit="km/h" />
      <Copy muted variant="small">Les extrêmes sont issus des allures lissées fiables enregistrées. Le meilleur segment chronométré est présenté séparément.</Copy>
    </Panel>
    <Panel style={{ gap: spacing.lg }}><MetricGrid><Metric label="Dénivelé positif" value={analysis.ascent === null ? '—' : Math.round(analysis.ascent).toString()} unit="m" /><Metric label="Dénivelé négatif" value={analysis.descent === null ? '—' : Math.round(analysis.descent).toString()} unit="m" /></MetricGrid>
      <Copy muted variant="caption">{analysis.elevationSeconds > 0 ? `Estimation sur ${duration(analysis.elevationSeconds)} d’altitude fiable (${Math.min(100, analysis.elevationSeconds / Math.max(1, run.activeSeconds) * 100).toFixed(0)} % du temps actif). Les portions non fiables et les pauses ne sont pas extrapolées.` : 'Mesures d’altitude fiables indisponibles pour cette sortie.'}</Copy></Panel>
    <Panel style={{ gap: spacing.lg }}><View style={{ flexDirection: largeText ? 'column' : 'row', alignItems: largeText ? 'stretch' : 'center', gap: spacing.xl }}>
      {largeText ? <Metric label="Temps dans la cible" value={percentage === null ? '—' : `${Math.round(percentage)} %`} />
        : <TargetRing value={percentage} animate={justFinished} />}
      <View style={{ flex: largeText ? undefined : 1, minWidth: 0, gap: spacing.sm }}><Label style={{ color: colors.accentText }}>Le rythme juste</Label><Copy variant="section">Du temps dans votre cible</Copy><Copy muted variant="caption">{run.targetUnavailable ? 'Objectif d’allure non disponible dans cet import Santé' : run.workout ? 'Selon la cible de chaque segment' : run.target.kilometerTargets ? 'Selon la cible de chaque kilomètre' : `${targetLabel(run.target)} /km`}</Copy></View></View>
      <Copy muted variant="caption">{analysis.deviations.reliableSeconds > 0 ? `Calculé sur ${duration(analysis.deviations.reliableSeconds)} de mesures fiables, soit ${Math.min(100, analysis.deviations.reliableSeconds / Math.max(1, run.activeSeconds) * 100).toFixed(0)} % du temps actif.` : 'Pas assez de mesures fiables pour calculer ce pourcentage.'} Les pauses, pertes de signal et phases de stabilisation sont exclues.</Copy>
    </Panel>
    {run.workoutError && <Copy style={{ color: colors.orange }}>{run.workoutError}</Copy>}
    {run.workout && <WorkoutResult workout={run.workout} />}
    {!run.targetUnavailable && !analysis.track.hasDistanceGaps && <PacingProgressPanel run={run} />}<AnalysisDeviations analysis={analysis} />
    <ActivitySegments analysis={analysis} />
    <View style={{ gap: spacing.lg }}><SectionHeading title="Votre allure au fil des pas" /><Panel><PaceChart run={run} analysis={analysis} /></Panel></View>
    {analysis.speedSeries.some(s => s.length >= 2) && <View style={{ gap: spacing.lg }}><SectionHeading title="Évolution de la vitesse" /><Panel><SeriesChart series={analysis.speedSeries} seconds={run.activeSeconds} kind="speed" /></Panel></View>}
    {analysis.altitudeSeries.some(s => s.length >= 2) && <View style={{ gap: spacing.lg }}><SectionHeading title="Profil d’altitude" /><Panel style={{ gap: spacing.md }}><SeriesChart series={analysis.altitudeSeries} seconds={run.activeSeconds} kind="altitude" /><Copy muted variant="caption">Altitude fiable de {analysis.minimumAltitude?.toFixed(0)} à {analysis.maximumAltitude?.toFixed(0)} m.</Copy></Panel></View>}
    <View style={{ gap: spacing.md }}><SectionHeading title="Kilomètre par kilomètre" />
      {!splits.length ? <Copy muted>Aucune distance suffisante pour un temps intermédiaire.</Copy> : <Panel style={{ gap: 0 }}>
        {!largeText && <View style={[styles.row, { paddingBottom: spacing.md }]}><Label style={{ flex: 1 }}>KM</Label><Label style={{ width: 62, textAlign: 'right', letterSpacing: 1 }}>Actif</Label><Label style={{ width: 62, textAlign: 'right', letterSpacing: 1 }}>Total</Label><Label style={{ width: 78, textAlign: 'right', letterSpacing: 1 }}>Allure</Label></View>}
        {splits.map(split => <View key={split.kilometer} style={{ flexDirection: largeText ? 'column' : 'row', gap: largeText ? 16 : 0, alignItems: largeText ? 'stretch' : 'center', borderTopWidth: 1, borderTopColor: colors.line, paddingVertical: spacing.lg }}>
          <View style={largeText ? undefined : { flex: 1 }}><Copy variant="emphasis">{String(split.kilometer).padStart(2, '0')}{largeText ? ' · kilomètre' : ''}</Copy>
            {split.partial && <Copy muted variant="small">{km(split.meters)} km · partiel</Copy>}{!split.reliable && <Copy variant="small" style={{ color: colors.orange }}>{split.source === 'counter' ? 'Compteur archivé' : 'GPS incomplet'}</Copy>}</View>
          {largeText ? <MetricGrid><Metric label="Actif" value={split.activeSeconds === null ? '—' : duration(split.activeSeconds)} /><Metric label="Total" value={split.totalSeconds === null ? '—' : duration(split.totalSeconds)} /><Metric label="Allure" value={pace(split.reliable ? split.pace : null)} unit="/km" /></MetricGrid>
            : <><Copy variant="caption" style={{ width: 62, textAlign: 'right', fontVariant: ['tabular-nums'] }}>{split.activeSeconds === null ? '—' : duration(split.activeSeconds)}</Copy><Copy variant="caption" style={{ width: 62, textAlign: 'right', fontVariant: ['tabular-nums'] }}>{split.totalSeconds === null ? '—' : duration(split.totalSeconds)}</Copy><Copy variant="caption" style={{ width: 78, textAlign: 'right', fontVariant: ['tabular-nums'] }}>{pace(split.reliable ? split.pace : null)}</Copy></>}
        </View>)}
        <Copy muted variant="small">Total inclut les pauses. Les temps manquants restent indisponibles ; les intermédiaires GPS incomplets ne qualifient pas un record.</Copy>
      </Panel>}
    </View>
    {onCompare && <Button title="Comparer cette sortie" secondary icon="git-compare-outline" onPress={onCompare} />}
    {onRecords && <Button title="Tous mes records personnels" secondary icon="trophy-outline" onPress={onRecords} />}
    <HealthSyncPanel run={run} onOpen={onApple} />
    <ActivitySharing run={run} />
    <ActivityJournal run={run} />
    <Button title="Supprimer cette sortie" secondary danger icon="trash-outline" onPress={remove} />
  </Screen>;
}
