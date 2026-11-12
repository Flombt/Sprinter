import { memo, useEffect, useRef, useState } from 'react';
import { Animated, BackHandler, Platform, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { averagePace, duration, km, pace, targetLabel } from '../core/format';
import { QUALITY_LABELS, STATE_LABELS, type PaceTarget } from '../core/types';
import { session, type SessionState } from '../services/session';
import { shallowEqual, useSessionSelector, useSessionStructure } from '../services/useSessionSelector';
import { useSelectedPlaylist } from '../spotify/components';
import { playlistTitle } from '../spotify/presentation';
import { Icon } from '../ui/components';
import { FeedbackPressable } from '../ui/FeedbackPressable';
import { HoldToFinish } from '../ui/HoldToFinish';
import { FloatingMaterial } from '../ui/FloatingMaterial';
import { PaceGauge, paceGaugeTarget } from '../ui/PaceGauge';
import { ActionButton, ActionIcon, BodyText, Brand, DisplayText, Kicker, useDesign } from '../ui/design';
import { useBottomBarInset } from '../ui/layout';
import RouteMap from '../ui/RouteMap';
import type { SavedRoute } from '../routes/types';
import { EMPTY_TRACK, type MapCommand } from '../ui/routeMapData';
import { useTheme } from '../ui/theme';
import { useMapPosition } from '../ui/useMapPosition';
import { useRunSetup, useSavedRoutes } from '../ui/useRunSetup';
import { motion, spacing, fontSizes, radii, fontWeights, iconSizes } from '../ui/tokens';

export { RunRow } from '../ui/RunRow';

function RunMetric({ value, label, unit }: { value: string; label: string; unit?: string }) {
  return <View accessible accessibilityLabel={[label, value, unit].filter(Boolean).join(' ')} style={styles.metric}>
    <DisplayText numeric adjustsFontSizeToFit numberOfLines={1} style={styles.metricValue}>{value}</DisplayText>
    <Kicker style={styles.metricLabel}>{label}{unit ? ' · ' + unit : ''}</Kicker>
  </View>;
}

export default function Home({ active, target, starting, onStart, onPrepare, onRecovery, onHistory, onStats, onMusic, onSettings, onFinish }: {
  active: boolean; target: PaceTarget; starting: boolean; onStart: () => void; onHistory: () => void;
  onPrepare: () => void; onRecovery: () => void; onStats: () => void; onMusic: () => void; onSettings: () => void; onFinish: (held?: boolean) => void;
}) {
  const design = useDesign();
  const state = useSessionStructure(active);
  const { reduceMotion } = useTheme();
  const { top, bottom } = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  const barHeight = useBottomBarInset();
  const setup = useRunSetup(target, state, active);
  const playlist = useSelectedPlaylist(active);
  const routes = useSavedRoutes(active);
  const { runId } = state;
  const reference = runId ? routes.find(route => route.id === state.routeId) : setup.route;
  const preview = useMapPosition(active && !runId && !state.busy && !starting);
  const [expanded, setExpanded] = useState(false);
  const [satellite, setSatellite] = useState(false);
  const [follow, setFollow] = useState(true);
  const [command, setCommand] = useState<MapCommand>();
  const revision = useRef(0);
  const expansion = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduceMotion) { expansion.setValue(expanded ? 1 : 0); return; }
    const transition = Animated.timing(expansion, {
      toValue: expanded ? 1 : 0,
      duration: motion.duration.slow,
      easing: expanded ? motion.enter : motion.exit,
      useNativeDriver: false,
    });
    transition.start();
    return () => transition.stop();
  }, [expanded, expansion, reduceMotion]);

  useEffect(() => {
    if (!active || !expanded || Platform.OS !== 'android') return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => { setExpanded(false); return true; });
    return () => subscription.remove();
  }, [active, expanded]);

  useEffect(() => {
    if (runId) { setFollow(true); setCommand(undefined); }
  }, [runId]);

  const recenter = () => {
    setFollow(true);
    setCommand({ kind: 'position', revision: ++revision.current });
    if (!runId) void preview.locate(true);
  };
  const frameRoute = () => {
    setFollow(false);
    setCommand({ kind: 'route', revision: ++revision.current });
  };
  const startOrPause = () => {
    if (state.recoveryBlocked) onRecovery();
    else if (runId) {
      if (state.running || state.autoPaused) void session.pause();
      else void session.resume();
    } else if (setup.error) onPrepare();
    else onStart();
  };

  const actionTitle = state.busy || starting ? 'Préparation GPS…' : state.recoveryBlocked ? 'Récupérer la course'
    : runId ? state.running || state.autoPaused ? 'Mettre en pause' : 'Reprendre'
      : setup.error ? 'Vérifier les options' : 'Démarrer une course';
  const heroHeight = Math.max(108, 84 * Math.min(fontScale, 1.6) + 24);

  return <ScrollView style={styles.screen} contentContainerStyle={[styles.content, {
    paddingTop: top + 6, paddingBottom: Math.max(barHeight + 4, bottom + 85),
  }]} showsVerticalScrollIndicator={false}>
    <View style={styles.header}>
      <ActionIcon icon={expanded ? 'arrow-back' : 'time-outline'} label={expanded ? 'Revenir aux statistiques de course' : 'Historique des courses'}
        onPress={expanded ? () => setExpanded(false) : onHistory} />
      <Brand />
      <ActionIcon icon={expanded ? 'contract-outline' : 'expand-outline'} label={expanded ? 'Réduire la carte' : 'Agrandir la carte'}
        onPress={() => setExpanded(value => !value)} />
    </View>
    <HomeReadouts active={active} expanded={expanded} expansion={expansion} heroHeight={heroHeight} />
    <HomeMap active={active} running={!!runId} preview={preview} reference={reference} expanded={expanded}
      follow={follow} satellite={satellite} command={command} onPan={() => setFollow(false)} onExpand={() => setExpanded(true)}
      onRecenter={recenter} onFrame={frameRoute} onSatellite={() => setSatellite(value => !value)} />

    <View style={[styles.controls, { borderTopColor: design.line }]}>
      {state.recoveryBlocked && <BodyText accessibilityRole="alert" style={[styles.note, { color: design.danger }]}>Une sauvegarde interrompue doit être récupérée avant le départ.</BodyText>}
      {!runId && !state.recoveryBlocked && setup.error && <BodyText accessibilityRole="alert" style={[styles.note, { color: design.danger }]}>{setup.error}</BodyText>}
      {runId && !expanded && <View style={styles.livePace}><HomePace active={active} /></View>}
      <View style={styles.context}>
        <FeedbackPressable accessibilityRole="button" accessibilityLabel={runId ? 'Voir les statistiques de la course' : 'Préparer ma course'} onPress={runId ? onStats : onPrepare}
          style={styles.contextLink}>
          <Icon name={runId ? 'stats-chart-outline' : 'speedometer-outline'} size={iconSizes.small} color={design.accent} />
          <BodyText numberOfLines={1} style={[styles.contextText, { color: design.secondary }]}>{runId ? expanded ? <CurrentPaceHint active={active} /> : "Statistiques de course" : setup.definition?.name ?? ("Cible " + targetLabel(setup.target) + " /km")}</BodyText>
          <Icon name="chevron-forward" size={iconSizes.small} color={design.secondary} />
        </FeedbackPressable>
        {!expanded && !runId && <FeedbackPressable accessibilityRole="button" accessibilityLabel="Centrer sur ma position" onPress={recenter} style={styles.locate}>
          <Icon name="locate-outline" size={iconSizes.standard} color={design.secondary} />
        </FeedbackPressable>}
        {runId && expanded && <BodyText style={[styles.contextText, { color: design.secondary }]}><ActiveTime active={active} /></BodyText>}
      </View>
      <View style={styles.actionRow}>
        <ActionIcon icon="musical-notes-outline" label={playlist ? 'Playlist Spotify : ' + playlistTitle(playlist) : 'Choisir une playlist Spotify'} onPress={onMusic} />
        <View style={styles.startAction}><ActionButton title={actionTitle} compact disabled={state.busy || starting} icon={runId && (state.running || state.autoPaused) ? 'pause' : 'play'} onPress={startOrPause} /></View>
        {!runId && <ActionIcon icon="options-outline" label="Réglages de course" onPress={onSettings} />}
      </View>
      {runId && <View style={styles.finish}><HoldToFinish key={runId} disabled={state.busy} onFinish={onFinish} /></View>}
    </View>
  </ScrollView>;
}

const selectReadouts = ({ run }: SessionState) => ({ distance: run?.distanceMeters ?? 0, active: run?.activeSeconds ?? 0,
  average: run ? averagePace(run) : null, descent: run?.elevationReliableSeconds ? Math.round(run.descentMeters ?? 0) : run ? null : 0, hasRun: !!run });
const selectActiveTime = (state: SessionState) => state.run?.activeSeconds ?? 0;
const selectPaceState = (state: SessionState) => state.paceState;
const selectMap = ({ run, quality }: SessionState) => ({ points: run?.points ?? EMPTY_TRACK,
  lastFix: run?.points.at(-1)?.fix, pointCount: run?.points.length ?? 0, quality });
const selectPace = ({ run, pace, paceState }: SessionState) => {
  const target = run && paceGaugeTarget(run);
  return { pace, paceState, fast: target?.fast, slow: target?.slow, tolerance: run?.config.toleranceSeconds ?? 0 };
};

function HomePace({ active }: { active: boolean }) {
  const { pace, paceState, fast, slow, tolerance } = useSessionSelector(selectPace, active, shallowEqual);
  return <PaceGauge target={fast === undefined || slow === undefined ? null : { fast, slow }} tolerance={tolerance} value={pace} status={paceState} compact />;
}

function CurrentPaceHint({ active }: { active: boolean }) { return STATE_LABELS[useSessionSelector(selectPaceState, active)]; }
function ActiveTime({ active }: { active: boolean }) { return duration(useSessionSelector(selectActiveTime, active)); }

const HomeReadouts = memo(function HomeReadouts({ active, expanded, expansion, heroHeight }: {
  active: boolean; expanded: boolean; expansion: Animated.Value; heroHeight: number;
}) {
  const design = useDesign();
  const readings = useSessionSelector(selectReadouts, active, shallowEqual);
  const distance = km(readings.distance), activeTime = readings.hasRun ? duration(readings.active) : '00:00';
  const average = readings.hasRun ? pace(readings.average) : '00:00', descent = readings.descent?.toString() ?? '—';
  const compactHeight = expansion.interpolate({ inputRange: [0, 1], outputRange: [heroHeight, 0] });
  const heroOpacity = expansion.interpolate({ inputRange: [0, .75], outputRange: [1, 0], extrapolate: 'clamp' });
  return <View style={[styles.readouts, { borderBottomColor: design.line }]}>
      <Animated.View style={[styles.heroClip, { height: compactHeight, opacity: heroOpacity }]} pointerEvents="none"
        accessibilityElementsHidden={expanded} importantForAccessibility={expanded ? 'no-hide-descendants' : 'auto'} aria-hidden={expanded}>
        <View style={[styles.hero, { height: heroHeight }]}>
          <DisplayText numeric maxFontSizeMultiplier={1.6} numberOfLines={1} adjustsFontSizeToFit style={styles.heroValue}>{distance}</DisplayText>
          <Kicker>Distance · km</Kicker>
        </View>
      </Animated.View>
      <View style={styles.metricRow}>
        {expanded ? <RunMetric label="Distance" unit="km" value={distance} /> : <RunMetric label="Temps actif" value={activeTime} />}
        <View style={[styles.divider, { backgroundColor: design.line }]} />
        <RunMetric label="Dénivelé −" unit="m" value={descent} />
        <View style={[styles.divider, { backgroundColor: design.line }]} />
        <RunMetric label="Allure moy." unit="/km" value={average} />
      </View>
    </View>;
});

function HomeMap({ active, running, preview, reference, expanded, follow, satellite, command, onPan, onExpand, onRecenter, onFrame, onSatellite }: {
  active: boolean; running: boolean; preview: ReturnType<typeof useMapPosition>; reference?: SavedRoute | null; expanded: boolean;
  follow: boolean; satellite: boolean; command?: MapCommand; onPan: () => void; onExpand: () => void;
  onRecenter: () => void; onFrame: () => void; onSatellite: () => void;
}) {
  const design = useDesign(), { colors } = useTheme();
  const { points, quality, lastFix } = useSessionSelector(selectMap, active, shallowEqual);
  const freshFix = lastFix && (quality === 'good' || quality === 'stationary') && Date.now() - lastFix.timestamp < 8000 ? lastFix : undefined;
  const position = running ? freshFix : preview.position;
  const hasRoute = points.length > 0 || !!reference, isWeb = Platform.OS === 'web';
  const gpsLabel = running ? QUALITY_LABELS[quality]
    : preview.status === 'locating' ? 'Localisation…'
      : preview.position ? 'Position trouvée' : preview.status === 'denied' ? 'GPS non autorisé' : 'GPS en attente';
  const mapHint = running ? 'En attente d’un point GPS fiable'
    : preview.status === 'denied' ? 'Autorisez la localisation dans les réglages.'
      : preview.status === 'unavailable' ? 'Position indisponible. Réessayez à l’extérieur.'
        : 'Centrez la carte sur votre position.';
  const mapEmpty = !hasRoute && !position;
  return <View style={[styles.map, { backgroundColor: colors.field }]}>
      <RouteMap points={points} reference={reference?.segments} current={position} initialPosition={preview.position}
        height="fill" live interactive={expanded} follow={follow} satellite={satellite} command={command} onPan={onPan} />
      {!expanded && <Pressable accessibilityRole="button" accessibilityLabel="Agrandir la carte du parcours"
        accessibilityHint="Ouvre les commandes de la carte sur cet écran" onPress={onExpand}
        style={({ pressed }) => [StyleSheet.absoluteFill, pressed && { backgroundColor: colors.scrim, opacity: .35 }]} />}
      <View pointerEvents="none" style={[styles.mapStatus, { backgroundColor: colors.surface, borderColor: design.line }]}>
        <Icon name="navigate-circle-outline" size={iconSizes.small} color={quality === 'good' || (!running && preview.position) ? design.accent : design.secondary} />
        <BodyText style={styles.mapStatusText}>{gpsLabel}</BodyText>
      </View>
      {expanded && <View style={[styles.mapTools, { borderColor: design.line }]}>
        <FloatingMaterial />
        <ActionIcon floating icon="locate-outline" label="Centrer sur ma position" onPress={onRecenter} disabled={running && !lastFix} />
        <ActionIcon floating icon="git-commit-outline" label="Voir le tracé entier" onPress={onFrame} disabled={!hasRoute || isWeb} />
        {!isWeb && <ActionIcon floating icon="layers-outline" label={satellite ? 'Afficher la carte standard' : 'Afficher la carte satellite'} onPress={onSatellite} />}
      </View>}
      {mapEmpty && <View pointerEvents="none" style={[styles.mapNote, { backgroundColor: colors.surface }]}>
        <BodyText style={styles.mapNoteText}>{isWeb ? 'Carte détaillée sur iPhone' : mapHint}</BodyText>
        {isWeb && <BodyText style={[styles.mapNoteText, { color: design.secondary }]}>Le tracé GPS apparaît ici pendant la course.</BodyText>}
      </View>}
      {reference && <View pointerEvents="none" style={[styles.routeLegend, { backgroundColor: colors.surface }]}>
        <View style={[styles.legendStroke, { backgroundColor: colors.routeReference }]} />
        <BodyText numberOfLines={1} style={styles.mapStatusText}>{reference.name}</BodyText>
      </View>}
    </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { flexGrow: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.xs },
  readouts: { borderBottomWidth: StyleSheet.hairlineWidth },
  heroClip: { overflow: 'hidden' },
  hero: { alignItems: 'center', justifyContent: 'center' },
  heroValue: { fontSize: fontSizes.pace, lineHeight: 82, letterSpacing: -2.4, textAlign: 'center' },
  metricRow: { flexDirection: 'row', alignItems: 'stretch', paddingHorizontal: spacing.sm, paddingVertical: spacing.md },
  metric: { flex: 1, minWidth: 0, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xs },
  metricValue: { fontSize: fontSizes.heading, lineHeight: 39, textAlign: 'center' },
  metricLabel: { fontSize: fontSizes.micro, letterSpacing: .8, textAlign: 'center' },
  divider: { width: StyleSheet.hairlineWidth, marginVertical: spacing.xs },
  map: { flex: 1, minHeight: 220, overflow: 'hidden' },
  mapStatus: { position: 'absolute', top: 12, left: 12, flexDirection: 'row', alignItems: 'center', gap: spacing.xs, borderRadius: radii.control, borderWidth: 1, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, maxWidth: '75%' },
  mapStatusText: { fontSize: fontSizes.small, fontWeight: fontWeights.semibold, flexShrink: 1 },
  mapTools: { position: 'absolute', top: 12, right: 12, padding: spacing.xs, borderRadius: radii.card, borderWidth: 1, overflow: 'hidden' },
  mapNote: { position: 'absolute', bottom: 12, alignSelf: 'center', maxWidth: '84%', paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radii.control },
  mapNoteText: { fontSize: fontSizes.small, lineHeight: 16, textAlign: 'center' },
  routeLegend: { position: 'absolute', bottom: 20, right: 12, maxWidth: '60%', flexDirection: 'row', alignItems: 'center', gap: spacing.xs, borderRadius: radii.sm, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  legendStroke: { width: 14, height: 3, borderRadius: radii.xs },
  controls: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth },
  livePace: { paddingTop: spacing.xs },
  finish: { marginTop: spacing.sm },
  context: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  contextLink: { minHeight: 44, flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  contextText: { flexShrink: 1, fontSize: fontSizes.small, fontWeight: fontWeights.medium },
  locate: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  startAction: { flex: 1, minWidth: 0 },
  note: { fontSize: fontSizes.small, marginTop: spacing.xs },
});
