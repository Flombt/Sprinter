import { useEffect, useRef, useState } from 'react';
import { Animated, BackHandler, Easing, Platform, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { averagePace, duration, km, pace, targetLabel } from '../core/format';
import { QUALITY_LABELS, STATE_LABELS, type PaceTarget } from '../core/types';
import { session, type SessionState } from '../services/session';
import { selectedPlaylist } from '../spotify/store';
import { useMusic } from '../spotify/components';
import { playlistTitle } from '../spotify/presentation';
import { useTools } from '../tools/components';
import { Icon } from '../ui/components';
import { ActionButton, ActionIcon, BodyText, Brand, DisplayText, Kicker, useDesign } from '../ui/design';
import { useBottomBarInset } from '../ui/layout';
import RouteMap from '../ui/RouteMap';
import { EMPTY_TRACK, type MapCommand } from '../ui/routeMapData';
import { useTheme } from '../ui/theme';
import { useMapPosition } from '../ui/useMapPosition';
import { useRunSetup } from '../ui/useRunSetup';

export { RunRow } from '../ui/RunRow';

function RunMetric({ value, label, unit }: { value: string; label: string; unit?: string }) {
  return <View accessible accessibilityLabel={[label, value, unit].filter(Boolean).join(' ')} style={styles.metric}>
    <DisplayText numeric adjustsFontSizeToFit numberOfLines={1} style={styles.metricValue}>{value}</DisplayText>
    <Kicker style={styles.metricLabel}>{label}{unit ? ' · ' + unit : ''}</Kicker>
  </View>;
}

export default function Home({ state, target, starting, onStart, onPrepare, onRecovery, onHistory, onStats, onMusic, onSettings, onFinish }: {
  state: SessionState; target: PaceTarget; starting: boolean; onStart: () => void; onHistory: () => void;
  onPrepare: () => void; onRecovery: () => void; onStats: () => void; onMusic: () => void; onSettings: () => void; onFinish: () => void;
}) {
  const design = useDesign();
  const { colors, reduceMotion } = useTheme();
  const { top, bottom } = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  const barHeight = useBottomBarInset();
  const setup = useRunSetup(target, state);
  const playlist = selectedPlaylist(useMusic());
  const tools = useTools();
  const run = state.run;
  const runId = run?.id;
  const points = run?.points ?? EMPTY_TRACK;
  const reference = run ? tools.routes.find(route => route.id === run.routeId) : setup.route;
  const lastFix = points.at(-1)?.fix;
  const freshFix = lastFix && (state.quality === 'good' || state.quality === 'stationary') && Date.now() - lastFix.timestamp < 8000
    ? lastFix : undefined;
  const preview = useMapPosition(!runId && !state.busy && !starting);
  const position = run ? freshFix : preview.position;
  const hasRoute = points.length > 0 || !!reference;
  const isWeb = Platform.OS === 'web';
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
      duration: 320,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: false,
    });
    transition.start();
    return () => transition.stop();
  }, [expanded, expansion, reduceMotion]);

  useEffect(() => {
    if (!expanded || Platform.OS !== 'android') return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => { setExpanded(false); return true; });
    return () => subscription.remove();
  }, [expanded]);

  useEffect(() => {
    if (runId) { setFollow(true); setCommand(undefined); }
  }, [runId]);

  const recenter = () => {
    setFollow(true);
    setCommand({ kind: 'position', revision: ++revision.current });
    if (!run) void preview.locate(true);
  };
  const frameRoute = () => {
    setFollow(false);
    setCommand({ kind: 'route', revision: ++revision.current });
  };
  const startOrPause = () => {
    if (state.recoveryBlocked) onRecovery();
    else if (run) {
      if (state.running || state.autoPaused) void session.pause();
      else void session.resume();
    } else if (setup.error) onPrepare();
    else onStart();
  };

  const distance = km(run?.distanceMeters ?? 0);
  const activeTime = run ? duration(run.activeSeconds) : '00:00';
  const average = run ? pace(averagePace(run)) : '00:00';
  const descent = !run ? '0' : run.elevationReliableSeconds ? Math.round(run.descentMeters ?? 0).toString() : '—';
  const gpsLabel = run ? QUALITY_LABELS[state.quality]
    : preview.status === 'locating' ? 'Localisation…'
      : preview.position ? 'Position trouvée' : preview.status === 'denied' ? 'GPS non autorisé' : 'GPS en attente';
  const mapHint = run ? 'En attente d’un point GPS fiable'
    : preview.status === 'denied' ? 'Autorisez la localisation dans les réglages.'
      : preview.status === 'unavailable' ? 'Position indisponible. Réessayez à l’extérieur.'
        : 'Centrez la carte sur votre position.';
  const mapEmpty = !hasRoute && !position;
  const actionTitle = state.busy || starting ? 'Préparation GPS…' : state.recoveryBlocked ? 'Récupérer la course'
    : run ? state.running || state.autoPaused ? 'Mettre en pause' : 'Reprendre'
      : setup.error ? 'Vérifier les options' : 'Démarrer une course';
  const heroHeight = Math.max(108, 84 * Math.min(fontScale, 1.6) + 24);
  const compactHeight = expansion.interpolate({ inputRange: [0, 1], outputRange: [heroHeight, 0] });
  const heroOpacity = expansion.interpolate({ inputRange: [0, .75], outputRange: [1, 0], extrapolate: 'clamp' });
  const paceHint = run ? STATE_LABELS[state.paceState] : setup.definition?.name ?? ('Cible ' + targetLabel(setup.target) + ' /km');

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
    <View style={[styles.readouts, { borderBottomColor: design.line }]}>
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
    </View>

    <View style={[styles.map, { backgroundColor: colors.field }]}>
      <RouteMap points={points} reference={reference?.segments} current={position} initialPosition={preview.position}
        height="fill" live interactive={expanded} follow={follow} satellite={satellite} command={command} onPan={() => setFollow(false)} />
      {!expanded && <Pressable accessibilityRole="button" accessibilityLabel="Agrandir la carte du parcours"
        accessibilityHint="Ouvre les commandes de la carte sur cet écran" onPress={() => setExpanded(true)} style={StyleSheet.absoluteFill} />}
      <View pointerEvents="none" style={[styles.mapStatus, { backgroundColor: colors.surface, borderColor: design.line }]}>
        <Icon name="navigate-circle-outline" size={16} color={state.quality === 'good' || (!run && preview.position) ? design.accent : design.secondary} />
        <BodyText style={styles.mapStatusText}>{gpsLabel}</BodyText>
      </View>
      {expanded && <View style={styles.mapTools}>
        <ActionIcon icon="locate-outline" label="Centrer sur ma position" onPress={recenter} disabled={!!run && !lastFix} />
        <ActionIcon icon="git-commit-outline" label="Voir le tracé entier" onPress={frameRoute} disabled={!hasRoute || isWeb} />
        {!isWeb && <ActionIcon icon="layers-outline" label={satellite ? 'Afficher la carte standard' : 'Afficher la carte satellite'} onPress={() => setSatellite(value => !value)} />}
      </View>}
      {mapEmpty && <View pointerEvents="none" style={[styles.mapNote, { backgroundColor: colors.surface }]}>
        <BodyText style={styles.mapNoteText}>{isWeb ? 'Carte détaillée sur iPhone' : mapHint}</BodyText>
        {isWeb && <BodyText style={[styles.mapNoteText, { color: design.secondary }]}>Le tracé GPS apparaît ici pendant la course.</BodyText>}
      </View>}
      {reference && <View pointerEvents="none" style={[styles.routeLegend, { backgroundColor: colors.surface }]}>
        <View style={[styles.legendStroke, { backgroundColor: colors.routeReference }]} />
        <BodyText numberOfLines={1} style={styles.mapStatusText}>{reference.name}</BodyText>
      </View>}
    </View>

    <View style={[styles.controls, { borderTopColor: design.line }]}>
      {state.recoveryBlocked && <BodyText accessibilityRole="alert" style={[styles.note, { color: design.danger }]}>Une sauvegarde interrompue doit être récupérée avant le départ.</BodyText>}
      {!run && !state.recoveryBlocked && setup.error && <BodyText accessibilityRole="alert" style={[styles.note, { color: design.danger }]}>{setup.error}</BodyText>}
      <View style={styles.context}>
        <Pressable accessibilityRole="button" accessibilityLabel={run ? 'Voir les statistiques de la course' : 'Préparer ma course'} onPress={run ? onStats : onPrepare}
          style={styles.contextLink}>
          <Icon name={run ? 'stats-chart-outline' : 'speedometer-outline'} size={15} color={design.accent} />
          <BodyText numberOfLines={1} style={[styles.contextText, { color: design.secondary }]}>{paceHint}</BodyText>
          <Icon name="chevron-forward" size={13} color={design.secondary} />
        </Pressable>
        {!expanded && !run && <Pressable accessibilityRole="button" accessibilityLabel="Centrer sur ma position" onPress={recenter} style={styles.locate}>
          <Icon name="locate-outline" size={18} color={design.secondary} />
        </Pressable>}
        {run && expanded && <BodyText style={[styles.contextText, { color: design.secondary }]}>{activeTime}</BodyText>}
      </View>
      <View style={styles.actionRow}>
        <ActionIcon icon="musical-notes-outline" label={playlist ? 'Playlist Spotify : ' + playlistTitle(playlist) : 'Choisir une playlist Spotify'} onPress={onMusic} />
        <View style={styles.startAction}><ActionButton title={actionTitle} compact disabled={state.busy || starting} icon={run && (state.running || state.autoPaused) ? 'pause' : 'play'} onPress={startOrPause} /></View>
        <ActionIcon icon={run ? 'stop-outline' : 'options-outline'} label={run ? 'Terminer et enregistrer la course' : 'Réglages de course'}
          disabled={!!run && state.busy} onPress={run ? onFinish : onSettings} />
      </View>
    </View>
  </ScrollView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { flexGrow: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingBottom: 6 },
  readouts: { borderBottomWidth: StyleSheet.hairlineWidth },
  heroClip: { overflow: 'hidden' },
  hero: { alignItems: 'center', justifyContent: 'center' },
  heroValue: { fontSize: 78, lineHeight: 82, letterSpacing: -2.4, textAlign: 'center' },
  metricRow: { flexDirection: 'row', alignItems: 'stretch', paddingHorizontal: 8, paddingVertical: 12 },
  metric: { flex: 1, minWidth: 0, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  metricValue: { fontSize: 35, lineHeight: 39, textAlign: 'center' },
  metricLabel: { fontSize: 9, letterSpacing: .8, textAlign: 'center' },
  divider: { width: StyleSheet.hairlineWidth, marginVertical: 6 },
  map: { flex: 1, minHeight: 220, overflow: 'hidden' },
  mapStatus: { position: 'absolute', top: 12, left: 12, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 9, borderWidth: 1, paddingHorizontal: 9, paddingVertical: 5, maxWidth: '75%' },
  mapStatusText: { fontSize: 11, fontWeight: '600', flexShrink: 1 },
  mapTools: { position: 'absolute', top: 12, right: 12, gap: 8 },
  mapNote: { position: 'absolute', bottom: 12, alignSelf: 'center', maxWidth: '84%', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 9 },
  mapNoteText: { fontSize: 11, lineHeight: 16, textAlign: 'center' },
  routeLegend: { position: 'absolute', bottom: 20, right: 12, maxWidth: '60%', flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  legendStroke: { width: 14, height: 3, borderRadius: 2 },
  controls: { paddingHorizontal: 16, paddingBottom: 7, borderTopWidth: StyleSheet.hairlineWidth },
  context: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  contextLink: { minHeight: 44, flex: 1, flexDirection: 'row', alignItems: 'center', gap: 7 },
  contextText: { flexShrink: 1, fontSize: 12, fontWeight: '500' },
  locate: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  startAction: { flex: 1, minWidth: 0 },
  note: { fontSize: 12, marginTop: 6 },
});
