import { contrastAccent, spacing, typography } from '../ui/tokens';
import { Brand } from '../ui/brand';
import { Button, Copy, Icon, IconButton, Label } from '../ui/components';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated, BackHandler, Easing, Platform, Pressable, ScrollView, StyleSheet, View, useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { km, targetLabel } from '../core/format';
import { QUALITY_LABELS, type PaceTarget } from '../core/types';
import { session, type SessionState } from '../services/session';
import { selectedPlaylist } from '../spotify/store';
import { useMusic } from '../spotify/components';
import { playlistTitle } from '../spotify/presentation';
import { useTools } from '../tools/components';
import { useBottomBarInset } from '../ui/layout';
import RouteMap from '../ui/RouteMap';
import { EMPTY_TRACK, type MapCommand } from '../ui/routeMapData';
import { useTheme } from '../ui/theme';
import { useMapPosition } from '../ui/useMapPosition';
import { useRunSetup } from '../ui/useRunSetup';
import { LiveRunMetrics } from './LiveRunMetrics';
import { HoldToFinish } from '../ui/HoldToFinish';
import { RunPauseButton } from '../ui/RunPauseButton';

export { RunRow } from '../ui/RunRow';

function RunMetric({ value, label, unit }: { value: string; label: string; unit?: string }) {
  return <View accessible accessibilityLabel={[label, value, unit].filter(Boolean).join(' ')} style={styles.metric}>
    <Copy variant="condensedMetric" adjustsFontSizeToFit numberOfLines={1} style={styles.metricValue}>{value}</Copy>
    <Label style={styles.metricLabel}>{label}{unit ? ' · ' + unit : ''}</Label>
  </View>;
}

export default function Home({
  active, state, target, starting, onStart, onPrepare, onRecovery, onHistory, onStats, onMusic, onSettings, onFinish,
  onConfirmFinish,
}: {
  active: boolean;
  state: SessionState;
  target: PaceTarget;
  starting: boolean;
  onStart: () => void;
  onHistory: () => void;
  onPrepare: () => void;
  onRecovery: () => void;
  onStats: () => void;
  onMusic: () => void;
  onSettings: () => void;
  onFinish: () => void;
  onConfirmFinish: () => void;
}) {
  const { colors, reduceMotion } = useTheme();
  const accent = contrastAccent(colors);
  const { top, bottom } = useSafeAreaInsets();
  const { fontScale, height } = useWindowDimensions();
  const scroll = fontScale > 1 || height < 700;
  const barHeight = useBottomBarInset();
  const setup = useRunSetup(target, state);
  const playlist = selectedPlaylist(useMusic());
  const tools = useTools();
  const run = state.run;
  const runId = run?.id;
  const points = run?.points ?? EMPTY_TRACK;
  const reference = run ? tools.routes.find(route => route.id === run.routeId) : setup.route;
  const lastFix = points.at(-1)?.fix;
  const preview = useMapPosition(active && !runId && !state.busy && !starting);
  const position = run ? state.mapFix : preview.position;
  const hasRoute = points.length > 0 || !!reference;
  const isWeb = Platform.OS === 'web';
  const [expanded, setExpanded] = useState(false);
  const [satellite, setSatellite] = useState(false);
  const [follow, setFollow] = useState(true);
  const stopFollowing = useCallback(() => setFollow(false), []);
  const [command, setCommand] = useState<MapCommand>();
  const revision = useRef(0);
  const readoutOpacity = useRef(new Animated.Value(1)).current;
  const previousExpansion = useRef(expanded);

  useEffect(() => {
    const changed = previousExpansion.current !== expanded;
    previousExpansion.current = expanded;
    if (reduceMotion || !changed) {
      readoutOpacity.setValue(1);
      return;
    }
    readoutOpacity.setValue(.3);
    const transition = Animated.timing(readoutOpacity, {
      toValue: 1,
      duration: 150,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: Platform.OS !== 'web',
    });
    transition.start();
    return () => transition.stop();
  }, [expanded, readoutOpacity, reduceMotion]);

  useEffect(() => {
    if (!active || !expanded || Platform.OS !== 'android') return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      setExpanded(false);
      return true;
    });
    return () => subscription.remove();
  }, [active, expanded]);

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
  const start = () => {
    if (state.recoveryBlocked) onRecovery();
    else if (setup.error) onPrepare();
    else onStart();
  };
  const pauseOrResume = () => {
    if (state.running || state.autoPaused) void session.pause();
    else void session.resume();
  };

  const distance = km(run?.distanceMeters ?? 0);
  const gpsLabel = run ? QUALITY_LABELS[state.quality]
    : preview.status === 'locating' ? 'Localisation…'
      : preview.status === 'unavailable' ? 'GPS indisponible'
        : preview.position ? 'Position trouvée' : preview.status === 'denied' ? 'GPS non autorisé' : 'GPS en attente';
  const mapHint = run ? 'En attente d’un point GPS fiable'
    : preview.status === 'denied' ? 'Autorisez la localisation dans les réglages.'
      : preview.status === 'unavailable' ? 'Position indisponible. Réessayez à l’extérieur.'
        : 'Centrez la carte sur votre position.';
  const mapEmpty = !hasRoute && !position;
  const actionTitle = state.busy || starting ? 'Préparation GPS…' : state.recoveryBlocked ? 'Récupérer la course'
    : setup.error ? 'Vérifier les options' : 'Démarrer une course';
  const heroHeight = Math.max(108, 84 * Math.min(fontScale, 1.6) + 24);
  const paceHint = setup.definition?.name ?? ('Cible ' + targetLabel(setup.target) + ' /km');

  const insets = {
    paddingTop: top + spacing.xs,
    paddingBottom: Math.max(barHeight + spacing.xs, bottom + spacing.sm),
  };
  const content = <>
    <View style={styles.header}>
      <IconButton square icon={expanded ? 'arrow-back' : 'time-outline'} label={expanded ? 'Revenir aux statistiques de course' : 'Historique des courses'}
        onPress={expanded ? () => setExpanded(false) : onHistory} />
      <Brand />
      <IconButton square icon={expanded ? 'contract-outline' : 'expand-outline'} label={expanded ? 'Réduire la carte' : 'Agrandir la carte'}
        onPress={() => setExpanded(value => !value)} />
    </View>
    <Animated.View style={[styles.readouts, { borderBottomColor: colors.line, opacity: readoutOpacity }]}>
      {run ? <LiveRunMetrics run={run} state={state} expanded={expanded} /> : <>
      {!expanded && <View style={[styles.hero, { minHeight: heroHeight }]}>
        <Copy variant="condensedMetric" maxFontSizeMultiplier={1.6} numberOfLines={1} adjustsFontSizeToFit style={styles.heroValue}>
          {distance}
        </Copy>
        <Label style={{ fontSize: typography.caption.fontSize }}>Distance · km</Label>
      </View>}
      <View style={styles.metricRow}>
        {expanded ? <RunMetric label="Distance" unit="km" value={distance} /> : <RunMetric label="Temps actif" value="00:00" />}
        <View style={[styles.divider, { backgroundColor: colors.line }]} />
        <RunMetric label="Dénivelé −" unit="m" value="0" />
        <View style={[styles.divider, { backgroundColor: colors.line }]} />
        <RunMetric label="Allure moy." unit="/km" value="00:00" />
      </View>
      </>}
    </Animated.View>

    <View style={[styles.map, scroll && styles.scrollMap, { backgroundColor: colors.field }]}>
      <RouteMap points={points} reference={reference?.segments} current={position} initialPosition={preview.position}
        height="fill" live interactive={expanded} follow={active && follow} satellite={satellite}
        command={command} onPan={stopFollowing} />
      {!expanded && <Pressable accessibilityRole="button" accessibilityLabel="Agrandir la carte du parcours"
        accessibilityHint="Ouvre les commandes de la carte sur cet écran" onPress={() => setExpanded(true)} style={StyleSheet.absoluteFill} />}
      <View pointerEvents="none" style={[styles.mapStatus, { backgroundColor: colors.surface, borderColor: colors.line }]}>
        <Icon name="navigate-circle-outline" size={16} color={state.quality === 'good' || (!run && preview.position) ? accent : colors.secondary} />
        <Copy variant="bodyCompact" style={styles.mapStatusText}>{gpsLabel}</Copy>
      </View>
      {expanded && <View style={styles.mapTools}>
        <IconButton square icon="locate-outline" label="Centrer sur ma position" onPress={recenter} disabled={!!run && !lastFix} />
        <IconButton square icon="git-commit-outline" label="Voir le tracé entier" onPress={frameRoute} disabled={!hasRoute || isWeb} />
        {!isWeb && <IconButton square icon="layers-outline" label={satellite ? 'Afficher la carte standard' : 'Afficher la carte satellite'} onPress={() => setSatellite(value => !value)} />}
      </View>}
      {mapEmpty && <View pointerEvents="none" style={[styles.mapNote, { backgroundColor: colors.surface }]}>
        <Copy variant="bodyCompact" style={styles.mapNoteText}>{isWeb ? 'Carte détaillée sur iPhone' : mapHint}</Copy>
        {isWeb && <Copy variant="bodyCompact" style={[styles.mapNoteText, { color: colors.secondary }]}>Le tracé GPS apparaît ici pendant la course.</Copy>}
      </View>}
      {reference && <View pointerEvents="none" style={[styles.routeLegend, { backgroundColor: colors.surface }]}>
        <View style={[styles.legendStroke, { backgroundColor: colors.routeReference }]} />
        <Copy variant="bodyCompact" numberOfLines={1} style={styles.mapStatusText}>{reference.name}</Copy>
      </View>}
    </View>

    <View style={[styles.controls, { borderTopColor: colors.line }]}>
      {state.autoPaused && <View style={styles.autoPause}>
        {expanded && <Copy variant="bodyCompact" accessibilityRole="header" style={styles.autoPauseTitle}>Pause automatique</Copy>}
        <Copy variant="bodyCompact">
          Le temps actif est suspendu. Le GPS attend un mouvement confirmé pour reprendre automatiquement.
          {' '}« Pause manuelle » arrête cette détection.
        </Copy>
        <Button highContrast size="large"
          title="Reprendre maintenant"
          feedback="medium"
          icon="play"
          variant="secondary"
          disabled={state.busy}
          onPress={() => void session.resume()}
        />
      </View>}
      {run ? <View style={styles.runControls}>
        <RunPauseButton
          paused={!state.running && !state.autoPaused}
          autoPaused={state.autoPaused}
          disabled={state.busy}
          onPress={pauseOrResume}
        />
        <View style={styles.secondaryActions}>
          <Button title="Musique" icon="musical-notes-outline" variant="quiet" size="toolbar" onPress={onMusic} />
          <Button
            title={expanded ? 'Réduire' : 'Carte'}
            icon={expanded ? 'contract-outline' : 'expand-outline'}
            variant="quiet"
            size="toolbar"
            onPress={() => setExpanded(value => !value)}
          />
          <Button title="Détails" icon="stats-chart-outline" variant="quiet" size="toolbar" onPress={onStats} />
        </View>
        <HoldToFinish key={run.id} disabled={state.busy} onFinish={onFinish} onConfirm={onConfirmFinish} />
      </View> : <>
      {state.recoveryBlocked && <Copy variant="bodyCompact" accessibilityRole="alert" style={[styles.note, { color: colors.danger }]}>Une sauvegarde interrompue doit être récupérée avant le départ.</Copy>}
      {!run && !state.recoveryBlocked && setup.error && <Copy variant="bodyCompact" accessibilityRole="alert" style={[styles.note, { color: colors.danger }]}>{setup.error}</Copy>}
      <View style={styles.context}>
        <Pressable accessibilityRole="button" accessibilityLabel="Préparer ma course" onPress={onPrepare}
          style={styles.contextLink}>
          <Icon name="speedometer-outline" size={15} color={accent} />
          <Copy variant="bodyCompact" numberOfLines={1} style={[styles.contextText, { color: colors.secondary }]}>{paceHint}</Copy>
          <Icon name="chevron-forward" size={13} color={colors.secondary} />
        </Pressable>
        {!expanded && <Pressable accessibilityRole="button" accessibilityLabel="Centrer sur ma position" onPress={recenter} style={styles.locate}>
          <Icon name="locate-outline" size={18} color={colors.secondary} />
        </Pressable>}
      </View>
      <View style={styles.actionRow}>
        <IconButton square icon="musical-notes-outline" label={playlist ? 'Playlist Spotify : ' + playlistTitle(playlist) : 'Choisir une playlist Spotify'} onPress={onMusic} />
        <View style={styles.startAction}>
          <Button highContrast arrow size="compact" title={actionTitle} disabled={state.busy || starting} icon="play" onPress={start} />
        </View>
        <IconButton square icon="options-outline" label="Réglages de course" onPress={onSettings} />
      </View>
      </>}
    </View>
  </>;
  if (scroll) {
    return <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, insets]}
      showsVerticalScrollIndicator={false}
    >
      {content}
    </ScrollView>;
  }
  return <View style={[styles.screen, insets]}>{content}</View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { flexGrow: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingBottom: 6 },
  readouts: { borderBottomWidth: StyleSheet.hairlineWidth },
  hero: { alignItems: 'center', justifyContent: 'center' },
  heroValue: { fontSize: 78, lineHeight: 82, letterSpacing: -2.4, textAlign: 'center' },
  metricRow: { flexDirection: 'row', alignItems: 'stretch', paddingHorizontal: 8, paddingVertical: 12 },
  metric: { flex: 1, minWidth: 0, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  metricValue: { fontSize: 35, lineHeight: 39, textAlign: 'center' },
  metricLabel: { fontSize: typography.caption.fontSize, letterSpacing: .8, textAlign: 'center' },
  divider: { width: StyleSheet.hairlineWidth, marginVertical: 6 },
  map: { flex: 1, minHeight: 0, overflow: 'hidden' },
  scrollMap: { minHeight: 220 },
  mapStatus: { position: 'absolute', top: 12, left: 12, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 9, borderWidth: 1, paddingHorizontal: 9, paddingVertical: 5, maxWidth: '75%' },
  mapStatusText: { fontSize: typography.caption.fontSize, fontWeight: '600', flexShrink: 1 },
  mapTools: { position: 'absolute', top: 12, right: 12, gap: 8 },
  mapNote: { position: 'absolute', bottom: 12, alignSelf: 'center', maxWidth: '84%', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 9 },
  mapNoteText: { ...typography.caption, textAlign: 'center' },
  routeLegend: { position: 'absolute', bottom: 20, right: 12, maxWidth: '60%', flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  legendStroke: { width: 14, height: 3, borderRadius: 2 },
  controls: { paddingHorizontal: 16, paddingBottom: 7, borderTopWidth: StyleSheet.hairlineWidth },
  autoPause: { paddingVertical: 12, gap: 8 },
  autoPauseTitle: { fontWeight: '700' },
  runControls: { gap: spacing.xs, paddingTop: spacing.sm },
  secondaryActions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-around' },
  context: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  contextLink: { minHeight: 44, flex: 1, flexDirection: 'row', alignItems: 'center', gap: 7 },
  contextText: { flexShrink: 1, fontSize: typography.caption.fontSize, fontWeight: '500' },
  locate: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  startAction: { flex: 1, minWidth: 0 },
  note: { fontSize: typography.caption.fontSize, marginTop: 6 },
});
