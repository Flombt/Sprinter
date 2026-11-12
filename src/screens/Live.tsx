import { View } from 'react-native';
import { useKeepAwake } from 'expo-keep-awake';
import { averagePace, duration, km, pace, targetLabel } from '../core/format';
import { QUALITY_LABELS, STATE_LABELS, RunRecord } from '../core/types';
import { session, SessionState } from '../services/session';
import { Button, Copy, Divider, Header, Icon, Label, Metric, MetricGrid, NumericReadout, Panel, Screen, styles } from '../ui/components';
import { confirm } from '../ui/confirm';
import { useAdaptiveLayout, useTheme } from '../ui/theme';
import { radii, spacing, fontSizes, fontWeights, iconSizes } from '../ui/tokens';
import RouteMap from '../ui/RouteMap';
import { MiniPlayer } from '../spotify/components';
import { liveWorkoutTarget, WorkoutLivePanel } from '../workouts/components';
import { PaceHistory, PacingProgressPanel } from '../pacing/components';
import { paceTargetAt } from '../pacing/goals';
import { RhythmTools, useTools } from '../tools/components';
import { NavigationPanel } from '../tools/activityComponents';
function KeepScreenAwake() { useKeepAwake('sprinter-active-screen'); return null; }

export default function Live({ state, onClose, onFinished, onMusic }: { state: SessionState; onClose: () => void; onFinished: (run: RunRecord) => void; onMusic: () => void }) {
  const { colors } = useTheme(); const { largeText } = useAdaptiveLayout(); const run = state.run;
  const tools = useTools(), reference = tools.routes.find(r => r.id === run?.routeId);
  if (!run) return null;
  const target = paceTargetAt(run.target, run.distanceMeters);
  const color = state.paceState === 'tooFast' ? colors.orange : state.paceState === 'tooSlow' ? colors.blue :
    state.quality === 'good' ? colors.accentText : colors.secondary;
  const status = state.quality === 'good' || !state.running ? STATE_LABELS[state.paceState] : QUALITY_LABELS[state.quality];
  const finish = () => confirm('Terminer votre course ?', 'Votre parcours et vos statistiques seront enregistrés sur cet iPhone.', 'Terminer', () => {
    void session.finish().then(result => { if (result) onFinished(result); });
  });
  return <Screen bottom={35}>{!state.backgroundActive && (state.running || state.autoPaused) && <KeepScreenAwake />}<Header title={state.autoPaused ? 'Pause automatique.' : state.running ? 'À vous de courir.' : 'Soufflez un instant.'} onBack={onClose} />
    <View style={[styles.row, { justifyContent: 'space-between', flexWrap: 'wrap', gap: spacing.md }]}><View style={[styles.row, { flexShrink: 1, gap: spacing.sm }]}>
      <View style={{ width: 6, height: 6, borderRadius: radii.xs, backgroundColor: state.quality === 'good' ? color : colors.secondary }} /><Label style={{ flexShrink: 1 }}>{QUALITY_LABELS[state.quality]}</Label></View>
      {!largeText && <Label>Course à pied</Label>}</View>
    <View style={{ alignItems: 'center', paddingVertical: spacing.lg, gap: spacing.md }}>
      <Label>Allure actuelle</Label><NumericReadout variant="pace" value={pace(state.pace)} label={`Allure actuelle ${pace(state.pace)} par kilomètre`} style={{ color, textAlign: 'center' }} />
      <Copy muted style={{ marginTop: -10 }}>min / km</Copy>
      <View accessibilityLiveRegion="polite" style={[styles.row, { maxWidth: '100%', marginTop: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderRadius: radii.control, backgroundColor: colors.surface, gap: spacing.sm }]}>
        <Icon name={state.paceState === 'onTarget' && state.quality === 'good' ? 'checkmark-circle' : state.paceState === 'tooFast' ? 'arrow-down' : state.paceState === 'tooSlow' ? 'arrow-up' : 'pulse'} size={iconSizes.small} color={color} />
        <Copy variant="emphasis" style={{ flexShrink: 1, color }}>{status}</Copy></View>
    </View>
    <Panel variant="metric" style={{ gap: spacing.xl }}><MetricGrid><Metric label="Temps actif" value={duration(run.activeSeconds)} large />
      <Metric label="Distance" value={km(run.distanceMeters)} unit="km" large /></MetricGrid>
      <Divider /><MetricGrid><Metric label="Temps total" value={duration(run.totalSeconds ?? run.activeSeconds)} /><Metric label="Pauses" value={duration(Math.max(0, (run.totalSeconds ?? run.activeSeconds) - run.activeSeconds))} /></MetricGrid>
      {run.totalEstimated && <Copy muted variant="small">Temps total estimé après récupération. Le temps actif n’inclut pas l’interruption.</Copy>}
      <Divider /><View style={[styles.row, { justifyContent: 'space-between', flexWrap: 'wrap', gap: spacing.md }]}>
        <View><Label>{!run.workout && run.target.kilometerTargets && target ? `Cible · kilomètre ${Math.floor((run.distanceMeters + 1e-7) / 1000) + 1}` : 'Votre cible'}</Label><Copy style={{ fontSize: fontSizes.body, fontWeight: fontWeights.semibold, marginTop: spacing.xs }}>{run.workout ? liveWorkoutTarget(run.workout) : target ? `${targetLabel(target)} /km` : 'Allure libre'}</Copy></View>
        <View><Label>Allure moyenne</Label><Copy style={{ fontSize: fontSizes.body, fontWeight: fontWeights.semibold, marginTop: spacing.xs }}>{pace(averagePace(run))} <Copy muted variant="small">/km</Copy></Copy></View>
      </View>
      {run.target.distanceMeters !== null && <View style={{ gap: spacing.sm }}><View style={[styles.row, { justifyContent: 'space-between', flexWrap: 'wrap', gap: spacing.sm }]}><Copy muted variant="caption">Objectif {km(run.target.distanceMeters, 1)} km</Copy><Copy variant="caption">{Math.min(100, run.distanceMeters / run.target.distanceMeters * 100).toFixed(0)} %</Copy></View>
        <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.min(100, run.distanceMeters / run.target.distanceMeters * 100) }} style={{ height: 5, backgroundColor: colors.line, borderRadius: radii.xs }}>
          <View style={{ width: `${Math.min(100, run.distanceMeters / run.target.distanceMeters * 100)}%`, height: 5, borderRadius: radii.xs, backgroundColor: colors.accentText }} /></View></View>}
    </Panel>
    <PacingProgressPanel run={run} running={state.running} quality={state.quality} />
    <NavigationPanel state={state} />
    <View style={{ flexDirection: largeText ? 'column' : 'row', gap: spacing.md }}><Button title={state.busy ? 'Patientez…' : state.autoPaused ? 'Pause manuelle' : state.running ? 'Pause' : 'Reprendre'} icon={state.running || state.autoPaused ? 'pause' : 'play'} onPress={() => { if (state.running || state.autoPaused) void session.pause(); else void session.resume(); }} disabled={state.busy} style={largeText ? undefined : { flex: 1 }} />
      <Button title="Terminer" icon="stop" secondary onPress={finish} disabled={state.busy} style={largeText ? undefined : { flex: 1 }} /></View>
    {state.autoPaused && <Panel style={{ gap: spacing.md }}><Copy>Le temps actif est suspendu. Le GPS attend un mouvement confirmé pour reprendre automatiquement. « Pause manuelle » arrête cette détection.</Copy><Button title="Reprendre maintenant" secondary disabled={state.busy} onPress={() => void session.resume()} /></Panel>}
    <Panel style={{ gap: spacing.md }}><MetricGrid><Metric label="Altitude fiable" value={state.altitude === null ? '—' : state.altitude.toFixed(0)} unit="m" /><Metric label="Dénivelé + / −" value={(run.elevationReliableSeconds ?? 0) > 0 ? `${Math.round(run.ascentMeters ?? 0)} / ${Math.round(run.descentMeters ?? 0)}` : '—'} unit="m" /></MetricGrid><Copy muted variant="small">Altitude GPS filtrée, dénivelé estimé uniquement avec une précision verticale suffisante.</Copy></Panel>
    {run.workout && <WorkoutLivePanel workout={run.workout} qualityGood={state.quality === 'good'} busy={state.busy} />}
    <PaceHistory run={run} live />
    {!state.backgroundActive && <Copy muted style={{ textAlign: 'center', fontSize: fontSizes.small, lineHeight: 18 }}>Gardez cet écran ouvert. L’écran reste allumé ; la course se met en pause si vous quittez l’application.</Copy>}
    {state.backgroundActive && !state.settings.audioEnabled && <Copy style={{ textAlign: 'center', fontSize: fontSizes.small, color: colors.orange }}>Sans signaux audio, aucune alerte n’est prévue écran verrouillé.</Copy>}
    <MiniPlayer onExpand={onMusic} foregroundOnlyRun={(state.running || state.autoPaused) && !state.backgroundActive} />
    <RhythmTools compact />
    <RouteMap points={run.points} reference={reference?.segments} current={['good', 'stationary'].includes(state.quality) && Date.now() - (run.points.at(-1)?.fix.timestamp ?? 0) < 8000 ? run.points.at(-1)?.fix : undefined} height={185} />
  </Screen>;
}
