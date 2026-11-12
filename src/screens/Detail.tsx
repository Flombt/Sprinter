import { useCallback, useMemo, useState } from 'react';
import { View } from 'react-native';
import type { SeriesPoint } from '../analysis/types';
import type { RunRecord, TrackPoint } from '../core/types';
import { duration, km, pace, runDate, targetLabel } from '../core/format';
import {
  Button,
  Copy,
  Divider,
  Header,
  Label,
  Metric,
  MetricGrid,
  NumericReadout,
  Panel,
  Screen,
  SectionHeading,
  styles,
} from '../ui/components';
import { RunnerGlyph } from '../ui/brand';
import { SegmentedControl } from '../ui/controls';
import { nearestTimeIndex } from '../ui/nearestTimeIndex';
import { SettingsDisclosure } from '../ui/settings';
import { TargetRing } from '../ui/TargetRing';
import { spacing } from '../ui/tokens';
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
import { ActivitySharing } from '../sharing/components';
import { FavouriteActions } from '../tools/activityComponents';

export default function Detail({
  run,
  history,
  onBack,
  onCompare,
  onRecords,
  onApple,
  onTools,
  onRepeat,
}: {
  run: RunRecord;
  history: RunRecord[];
  onBack: () => void;
  onCompare?: () => void;
  onRecords?: () => void;
  onApple?: () => void;
  onTools?: () => void;
  onRepeat?: () => void;
}) {
  const analysis = useMemo(() => activityAnalysis(run), [run]);
  const { colors } = useTheme();
  const { largeText } = useAdaptiveLayout();
  const percentage = analysis.deviations.percentage;
  const activeSeconds = Math.max(1, run.activeSeconds);
  const altitudeCoverage = Math.min(100, (analysis.elevationSeconds / activeSeconds) * 100).toFixed(0);
  const paceCoverage = Math.min(100, (analysis.deviations.reliableSeconds / activeSeconds) * 100).toFixed(0);
  const [section, setSection] = useState<'summary' | 'paces' | 'kilometers' | 'map'>('summary');
  const [selected, setSelected] = useState<TrackPoint>();
  const select = useCallback(
    (sample: SeriesPoint) => {
      const index = nearestTimeIndex(analysis.mapPoints, sample.seconds, (point) => point.activeSeconds);
      setSelected(analysis.mapPoints[index]);
    },
    [analysis.mapPoints],
  );
  const splits = analysis.splits,
    speed = analysis.averageSpeed;
  const remove = () =>
    confirm(
      'Supprimer cette course ?',
      'Son parcours et ses statistiques seront définitivement supprimés de cet appareil.',
      'Supprimer',
      () => {
        void session.deleteRun(run.id).then((ok) => {
          if (ok) onBack();
        });
      },
      true,
    );
  return (
    <Screen bottom={40}>
      <Header title="Votre sortie" onBack={onBack} />
      <View style={{ gap: spacing.sm }}>
        <View style={[styles.row, { gap: spacing.sm, flexWrap: 'wrap' }]}>
          <RunnerGlyph size={18} color={colors.secondary} />
          <Label>Course à pied · {runDate(run.startedAt)}</Label>
        </View>
        <View style={[styles.row, { alignItems: 'baseline', flexWrap: 'wrap', gap: spacing.sm }]}>
          <NumericReadout
            value={km(run.distanceMeters)}
            variant="distance"
            label={`${km(run.distanceMeters)} kilomètres`}
          />
          <Copy muted variant="section">
            km
          </Copy>
        </View>
        <Copy muted variant="caption">
          {new Date(run.startedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} ·{' '}
          {duration(run.activeSeconds)} de temps actif · {pace(analysis.averagePace)} /km
        </Copy>
      </View>
      <SegmentedControl
        label="Détail de la sortie"
        value={section}
        choices={[
          ['summary', 'Résumé'],
          ['paces', 'Allures'],
          ['kilometers', 'Kilomètres'],
          ['map', 'Carte'],
        ]}
        onChange={setSection}
      />
      {section === 'map' && (
        <View style={{ gap: spacing.sm }}>
          <SectionHeading title="Votre tracé" />
          <RouteMap points={analysis.mapPoints} selected={selected?.fix} height={310} interactive />
          {selected && (
            <Copy variant="caption" muted>
              Repère du graphique · {duration(selected.activeSeconds)} · {km(selected.meters)} km
            </Copy>
          )}
        </View>
      )}
      {section === 'summary' && (
        <>
          <ActivityReview run={run} history={history} />
          <FavouriteActions run={run} onTools={onTools} onRepeat={onRepeat} />
          <Panel style={{ gap: 24 }}>
            <MetricGrid>
              <Metric label="Temps actif" value={duration(run.activeSeconds)} />
              <Metric label="Allure moyenne active" value={pace(analysis.averagePace)} unit="/km" />
            </MetricGrid>
            <MetricGrid>
              <Metric
                label="Temps total"
                value={run.totalSeconds === undefined ? '—' : duration(run.totalSeconds)}
              />
              <Metric
                label="Pauses"
                value={
                  run.totalSeconds === undefined
                    ? '—'
                    : duration(Math.max(0, run.totalSeconds - run.activeSeconds))
                }
              />
            </MetricGrid>
            <Copy muted variant="small">
              {run.healthKit
                ? 'Temps issus de Santé ; détail des pauses indisponible.'
                : run.autoPauseEnabled
                  ? `${run.autoPauseCount ?? 0} pause(s) automatique(s).`
                  : 'Pause automatique désactivée pour cette sortie.'}
            </Copy>
            <Divider />
            <MetricGrid>
              <Metric label="Plus rapide fiable" value={pace(analysis.fastestReliablePace)} unit="/km" />
              <Metric label="Plus lente fiable" value={pace(analysis.slowestReliablePace)} unit="/km" />
            </MetricGrid>
            <Metric
              label="Vitesse moyenne active"
              value={speed === null ? '—' : speed.toLocaleString('fr-FR', { maximumFractionDigits: 1 })}
              unit="km/h"
            />
          </Panel>
          <Panel style={{ gap: 15 }}>
            <MetricGrid>
              <Metric
                label="Dénivelé positif"
                value={analysis.ascent === null ? '—' : Math.round(analysis.ascent).toString()}
                unit="m"
              />
              <Metric
                label="Dénivelé négatif"
                value={analysis.descent === null ? '—' : Math.round(analysis.descent).toString()}
                unit="m"
              />
            </MetricGrid>
          </Panel>
          <Panel style={{ gap: spacing.lg }}>
            <View
              style={{
                flexDirection: largeText ? 'column' : 'row',
                alignItems: largeText ? 'stretch' : 'center',
                gap: spacing.xl,
              }}
            >
              {largeText ? (
                <Metric
                  label="Temps dans la cible"
                  value={percentage === null ? '—' : `${Math.round(percentage)} %`}
                />
              ) : (
                <TargetRing percentage={percentage} />
              )}
              <View style={{ flex: largeText ? undefined : 1, minWidth: 0, gap: spacing.sm }}>
                <Label style={{ color: colors.accentText }}>Le rythme juste</Label>
                <Copy variant="section">Du temps dans votre cible</Copy>
                <Copy muted variant="caption">
                  {run.targetUnavailable
                    ? 'Objectif d’allure non disponible dans cet import Santé'
                    : run.workout
                      ? 'Selon la cible de chaque segment'
                      : run.target.kilometerTargets
                        ? 'Selon la cible de chaque kilomètre'
                        : `${targetLabel(run.target)} /km`}
                </Copy>
              </View>
            </View>
          </Panel>
          {run.workoutError && <Copy style={{ color: colors.warning.text }}>{run.workoutError}</Copy>}
          {run.workout && <WorkoutResult workout={run.workout} />}
          {onCompare && (
            <Button title="Comparer cette sortie" secondary icon="git-compare-outline" onPress={onCompare} />
          )}
          {onRecords && (
            <Button title="Tous mes records personnels" secondary icon="trophy-outline" onPress={onRecords} />
          )}
          <HealthSyncPanel run={run} onOpen={onApple} />
          <ActivitySharing run={run} />
          <ActivityJournal run={run} />
          <Button title="Supprimer cette sortie" secondary danger icon="trash-outline" onPress={remove} />
        </>
      )}
      {section === 'paces' && (
        <>
          {!run.targetUnavailable && !analysis.track.hasDistanceGaps && <PacingProgressPanel run={run} />}
          <AnalysisDeviations analysis={analysis} />
          <ActivitySegments analysis={analysis} />
          <View style={{ gap: 15 }}>
            <SectionHeading title="Votre allure au fil des pas" />
            <Panel>
              <PaceChart run={run} analysis={analysis} onSelect={select} />
            </Panel>
          </View>
          {analysis.speedSeries.some((s) => s.length >= 2) && (
            <View style={{ gap: 15 }}>
              <SectionHeading title="Évolution de la vitesse" />
              <Panel>
                <SeriesChart
                  series={analysis.speedSeries}
                  seconds={run.activeSeconds}
                  kind="speed"
                  onSelect={select}
                />
              </Panel>
            </View>
          )}
          {analysis.altitudeSeries.some((s) => s.length >= 2) && (
            <View style={{ gap: 15 }}>
              <SectionHeading title="Profil d’altitude" />
              <Panel style={{ gap: 12 }}>
                <SeriesChart
                  series={analysis.altitudeSeries}
                  seconds={run.activeSeconds}
                  kind="altitude"
                  onSelect={select}
                />
                <Copy muted variant="caption">
                  Altitude fiable de {analysis.minimumAltitude?.toFixed(0)} à{' '}
                  {analysis.maximumAltitude?.toFixed(0)} m.
                </Copy>
              </Panel>
            </View>
          )}
          {selected && (
            <Button
              title="Voir le repère sur la carte"
              icon="map-outline"
              variant="secondary"
              onPress={() => setSection('map')}
            />
          )}
        </>
      )}
      {section === 'kilometers' && (
        <>
          <View style={{ gap: 14 }}>
            <SectionHeading title="Kilomètre par kilomètre" />
            {!splits.length ? (
              <Copy muted>Aucune distance suffisante pour un temps intermédiaire.</Copy>
            ) : (
              <Panel style={{ gap: 0 }}>
                {!largeText && (
                  <View style={[styles.row, { paddingBottom: 13 }]}>
                    <Label style={{ flex: 1 }}>KM</Label>
                    <Label style={{ width: 62, textAlign: 'right', letterSpacing: 1 }}>Actif</Label>
                    <Label style={{ width: 62, textAlign: 'right', letterSpacing: 1 }}>Total</Label>
                    <Label style={{ width: 78, textAlign: 'right', letterSpacing: 1 }}>Allure</Label>
                  </View>
                )}
                {splits.map((split) => (
                  <View
                    key={split.kilometer}
                    style={{
                      flexDirection: largeText ? 'column' : 'row',
                      gap: largeText ? 16 : 0,
                      alignItems: largeText ? 'stretch' : 'center',
                      borderTopWidth: 1,
                      borderTopColor: colors.line,
                      paddingVertical: 16,
                    }}
                  >
                    <View style={largeText ? undefined : { flex: 1 }}>
                      <Copy variant="emphasis">
                        {String(split.kilometer).padStart(2, '0')}
                        {largeText ? ' · kilomètre' : ''}
                      </Copy>
                      {split.partial && (
                        <Copy muted variant="small">
                          {km(split.meters)} km · partiel
                        </Copy>
                      )}
                      {!split.reliable && (
                        <Copy variant="small" style={{ color: colors.warning.text }}>
                          {split.source === 'counter' ? 'Compteur archivé' : 'GPS incomplet'}
                        </Copy>
                      )}
                    </View>
                    {largeText ? (
                      <MetricGrid>
                        <Metric
                          label="Actif"
                          value={split.activeSeconds === null ? '—' : duration(split.activeSeconds)}
                        />
                        <Metric
                          label="Total"
                          value={split.totalSeconds === null ? '—' : duration(split.totalSeconds)}
                        />
                        <Metric label="Allure" value={pace(split.reliable ? split.pace : null)} unit="/km" />
                      </MetricGrid>
                    ) : (
                      <>
                        <Copy
                          variant="caption"
                          style={{ width: 62, textAlign: 'right', fontVariant: ['tabular-nums'] }}
                        >
                          {split.activeSeconds === null ? '—' : duration(split.activeSeconds)}
                        </Copy>
                        <Copy
                          variant="caption"
                          style={{ width: 62, textAlign: 'right', fontVariant: ['tabular-nums'] }}
                        >
                          {split.totalSeconds === null ? '—' : duration(split.totalSeconds)}
                        </Copy>
                        <Copy
                          variant="caption"
                          style={{ width: 78, textAlign: 'right', fontVariant: ['tabular-nums'] }}
                        >
                          {pace(split.reliable ? split.pace : null)}
                        </Copy>
                      </>
                    )}
                  </View>
                ))}
                <Copy muted variant="small">
                  Total inclut les pauses. Les temps manquants restent indisponibles ; les intermédiaires GPS
                  incomplets ne qualifient pas un record.
                </Copy>
              </Panel>
            )}
          </View>
        </>
      )}
      <SettingsDisclosure title="À propos de ces mesures" icon="information-circle-outline">
        {analysis.warnings.map((warning) => (
          <Copy key={warning} style={{ color: colors.warning.text }}>
            {warning}
          </Copy>
        ))}
        {run.totalEstimated && (
          <Copy muted variant="caption">
            Le temps total inclut une estimation de l’interruption après récupération. Le temps actif est
            séparé.
          </Copy>
        )}
        <Copy muted variant="caption">
          Les allures extrêmes proviennent des mesures lissées fiables. Le meilleur segment est présenté
          séparément.
        </Copy>
        <Copy muted variant="caption">
          {analysis.elevationSeconds > 0
            ? 'Dénivelé estimé sur ' +
              duration(analysis.elevationSeconds) +
              ' d’altitude fiable (' +
              altitudeCoverage +
              ' % du temps actif).'
            : 'Mesures d’altitude fiables indisponibles pour cette sortie.'}
        </Copy>
        <Copy muted variant="caption">
          {analysis.deviations.reliableSeconds > 0
            ? 'Temps dans la cible calculé sur ' +
              duration(analysis.deviations.reliableSeconds) +
              ' de mesures fiables (' +
              paceCoverage +
              ' % du temps actif).'
            : 'Pas assez de mesures fiables pour calculer le temps dans la cible.'}
        </Copy>
        <Copy muted variant="caption">
          Les graphiques et les records utilisent les mesures fiables. Les pauses et les interruptions de
          localisation sont exclues des portions mesurées.
        </Copy>
      </SettingsDisclosure>
    </Screen>
  );
}
