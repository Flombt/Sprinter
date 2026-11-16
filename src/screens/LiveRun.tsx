import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useIsFocused } from '@react-navigation/native';
import { QUALITY_LABELS, type RunRecord } from '../core/types';
import { session } from '../services/session';
import { useLiveSession } from '../services/useSessionSelector';
import { useTools } from '../tools/components';
import { Button, Copy, Header, Icon, IconButton, Screen } from '../ui/components';
import { DetailRow } from '../ui/editorial';
import { HoldToFinish } from '../ui/HoldToFinish';
import { RouteTrace } from '../ui/RouteTrace';
import { RunPauseButton } from '../ui/RunPauseButton';
import RouteMap from '../ui/RouteMap';
import { EMPTY_TRACK, type MapCommand } from '../ui/routeMapData';
import { Sheet } from '../ui/Sheet';
import { InstrumentTheme, useAdaptiveLayout, useTheme } from '../ui/theme';
import { radii, spacing } from '../ui/tokens';
import { useMapPosition } from '../ui/useMapPosition';
import type { RouteCoordinate } from '../routes/types';
import { LiveRunMetrics } from './LiveRunMetrics';

function CourseMap({
  run,
  current,
  gps,
  active,
  expanded,
  onExpand,
  onLocate,
  visible = true,
  onToggle,
}: {
  run?: RunRecord;
  current?: RouteCoordinate;
  gps: string;
  active: boolean;
  expanded: boolean;
  onExpand?: () => void;
  onLocate?: () => void;
  visible?: boolean;
  onToggle?: () => void;
}) {
  const { colors } = useTheme();
  const { compact, largeText } = useAdaptiveLayout();
  const tools = useTools();
  const routeId = run ? run.routeId : tools.preferences.selectedRouteId;
  const reference = tools.routes.find((route) => route.id === routeId);
  const points = run?.points ?? EMPTY_TRACK;
  const [satellite, setSatellite] = useState(false);
  const [follow, setFollow] = useState(true);
  const [command, setCommand] = useState<MapCommand>();
  const revision = useRef(0);
  const onPan = useCallback(() => setFollow(false), []);
  const recenter = () => {
    setFollow(true);
    setCommand({ kind: 'position', revision: ++revision.current });
    onLocate?.();
  };

  return (
    <View style={[styles.mapPanel, { backgroundColor: colors.surface }]}>
      <View style={styles.mapStatus}>
        <Icon name="navigate-circle-outline" size={17} color={colors.secondary} />
        <Copy muted variant="caption" style={{ flex: 1 }}>
          {gps}
        </Copy>
        {onToggle &&
          (compact || largeText ? (
            <IconButton
              icon={visible ? 'eye-off-outline' : 'eye-outline'}
              quiet
              label={visible ? 'Masquer le tracé' : 'Voir le tracé'}
              onPress={onToggle}
            />
          ) : (
            <Button
              title={visible ? 'Masquer le tracé' : 'Voir le tracé'}
              variant="quiet"
              feedback="none"
              onPress={onToggle}
            />
          ))}
        {visible && onExpand && (
          <IconButton
            icon={expanded ? 'contract-outline' : 'expand-outline'}
            quiet
            label={expanded ? 'Réduire la carte' : 'Agrandir la carte'}
            onPress={onExpand}
          />
        )}
      </View>
      {visible && (
        <View style={{ gap: spacing.sm }}>
          {expanded ? (
            <RouteMap
              points={points}
              reference={reference?.segments}
              current={current}
              height={278}
              live={!!run}
              interactive={expanded}
              follow={active && follow}
              satellite={satellite}
              command={command}
              onPan={onPan}
            />
          ) : (
            <RouteTrace points={points} height={152} emptyLabel="En attente du tracé GPS" />
          )}
          {expanded && !current && !points.length && !reference && (
            <Copy variant="caption" muted style={styles.mapNote}>
              {run ? 'En attente d’un point GPS fiable.' : 'Centrez la carte pour afficher votre position.'}
            </Copy>
          )}
          {reference && (
            <Copy variant="caption" muted style={styles.mapNote}>
              {reference.name} · Parcours de référence
            </Copy>
          )}
          {expanded && (
            <View style={styles.mapTools}>
              <IconButton
                square
                icon="locate-outline"
                label="Centrer sur ma position"
                onPress={recenter}
                disabled={!!run && !current}
              />
              {Platform.OS !== 'web' && (
                <>
                  <IconButton
                    square
                    icon="git-commit-outline"
                    label="Voir le tracé entier"
                    disabled={!points.length && !reference}
                    onPress={() => {
                      setFollow(false);
                      setCommand({ kind: 'route', revision: ++revision.current });
                    }}
                  />
                  <IconButton
                    square
                    icon="layers-outline"
                    label={satellite ? 'Afficher la carte standard' : 'Afficher la carte satellite'}
                    onPress={() => setSatellite((value) => !value)}
                  />
                </>
              )}
            </View>
          )}
        </View>
      )}
    </View>
  );
}

export function RoutePreview({ onBack }: { onBack: () => void }) {
  const focused = useIsFocused();
  const preview = useMapPosition(focused);
  const gps =
    preview.status === 'locating'
      ? 'Localisation…'
      : preview.status === 'unavailable'
        ? 'GPS indisponible'
        : preview.status === 'denied'
          ? 'GPS non autorisé'
          : preview.status === 'cached'
            ? 'Dernière position connue'
            : preview.position
              ? 'Position disponible'
              : 'GPS en attente';
  return (
    <Screen>
      <Header editorial title="Carte" onBack={onBack} />
      <CourseMap
        current={preview.position}
        gps={gps}
        active={focused}
        expanded
        onLocate={() => void preview.locate(true)}
      />
    </Screen>
  );
}

type LiveRunProps = {
  active: boolean;
  onBrowse: () => void;
  onMusic: () => void;
  onStats: () => void;
  onFinish: () => void;
  onConfirmFinish: () => void;
};

export default function LiveRun(props: LiveRunProps) {
  const state = useLiveSession(props.active);
  if (!state.run) return null;
  return (
    <InstrumentTheme>
      <RunConsole {...props} key={state.run.id} state={state} run={state.run} />
    </InstrumentTheme>
  );
}

function RunConsole({
  active,
  onBrowse,
  onMusic,
  onStats,
  onFinish,
  onConfirmFinish,
  state,
  run,
}: LiveRunProps & { state: ReturnType<typeof useLiveSession>; run: RunRecord }) {
  const { colors } = useTheme();
  const [tools, setTools] = useState(false);
  const [map, setMap] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const paused = !state.running && !state.autoPaused;
  const { mapFix } = state;
  const closeTools = () => setTools(false);
  useEffect(() => {
    if (!active) setTools(false);
  }, [active]);

  const commands = (
    <>
      <RunPauseButton
        paused={paused}
        autoPaused={state.autoPaused}
        disabled={state.busy}
        onPress={() => {
          if (state.running || state.autoPaused) void session.pause();
          else void session.resume();
        }}
      />
      <HoldToFinish disabled={state.busy} onFinish={onFinish} onConfirm={onConfirmFinish} />
    </>
  );
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {active && <StatusBar style="light" />}
      <View
        style={{ flex: 1 }}
        pointerEvents={tools ? 'none' : 'auto'}
        accessibilityElementsHidden={tools}
        aria-hidden={tools}
        importantForAccessibility={tools ? 'no-hide-descendants' : 'auto'}
      >
        <Screen footer={commands} bottom={spacing.md} gap={spacing.md}>
          <View style={styles.header}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={styles.status}>
                <View
                  style={[
                    styles.dot,
                    { backgroundColor: state.running ? colors.zone.on.color : colors.warning.text },
                  ]}
                />
                <Copy variant="caption" muted accessibilityLiveRegion="polite">
                  {state.autoPaused ? 'Pause automatique' : paused ? 'En pause' : 'Course en cours'}
                </Copy>
              </View>
              <Copy variant="title" accessibilityRole="header">
                {run.workout?.definition.name ?? 'Course libre'}
              </Copy>
            </View>
            <IconButton
              square
              icon="ellipsis-horizontal"
              label="Outils de la course"
              onPress={() => setTools(true)}
            />
          </View>
          <LiveRunMetrics run={run} state={state} expanded={expanded} />
          <CourseMap
            run={run}
            current={mapFix}
            gps={QUALITY_LABELS[state.quality]}
            active={active}
            expanded={expanded}
            visible={map}
            onToggle={() => {
              setMap(!map);
              if (map) setExpanded(false);
            }}
            onExpand={() => setExpanded((value) => !value)}
          />
          {state.autoPaused && (
            <>
              <Copy muted variant="caption">
                Le temps actif est suspendu. Le GPS attend un mouvement confirmé.
              </Copy>
              <Button
                title="Reprendre maintenant"
                secondary
                icon="play"
                onPress={() => void session.resume()}
                disabled={state.busy}
              />
            </>
          )}
        </Screen>
      </View>
      {tools && (
        <Sheet title="Outils de course" onClose={closeTools}>
          {paused && (
            <DetailRow
              title="Ouvrir l’accueil"
              detail="Votre activité reste en pause"
              icon="home-outline"
              onPress={() => {
                closeTools();
                onBrowse();
              }}
            />
          )}
          <DetailRow
            title="Détails et réglages de course"
            icon="options-outline"
            onPress={() => {
              closeTools();
              onStats();
            }}
          />
          <DetailRow
            title="Musique"
            icon="musical-notes-outline"
            onPress={() => {
              closeTools();
              onMusic();
            }}
            rule={false}
          />
        </Sheet>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  status: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  dot: { width: 7, height: 7, borderRadius: 4 },
  mapPanel: { borderRadius: radii.card, overflow: 'hidden' },
  mapStatus: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.md },
  mapNote: { paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  mapTools: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
});
