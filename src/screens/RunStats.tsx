import { useTheme } from '../ui/theme';
import { Switch } from '../ui/controls';
import { contrastAccent, controlColors, paperColors, spacing, typography, type ThemeColors } from '../ui/tokens';
import {
  Button,
  Card,
  Copy,
  Icon,
  IconButton,
  Label,
  Screen,
  SectionLabel,
  StatusBadge,
  type IconName,
} from '../ui/components';
import { Pressable, StyleSheet, View } from 'react-native';
import { averagePace, duration, km, pace } from '../core/format';
import { QUALITY_LABELS, type PaceTarget } from '../core/types';
import { session, type SessionState } from '../services/session';
import { CAN_BACKGROUND } from '../services/capabilities';
import { haptic } from '../ui/haptics';
import { useRunSetup } from '../ui/useRunSetup';
import { WorkoutLivePanel } from '../workouts/components';
import { NavigationPanel } from '../tools/activityComponents';
import { RunInsights } from './RunInsights';
import { paceTargetAt } from '../pacing/goals';
import { effectiveTarget } from '../workouts/definition';
import { HoldToFinish } from '../ui/HoldToFinish';
import { PaceStepper } from '../ui/PaceStepper';

function Setting({
  icon,
  title,
  detail,
  value,
  onChange,
  disabled = false,
}: {
  icon: IconName;
  title: string;
  detail?: string;
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  const { colors } = useTheme();
  const accent = contrastAccent(colors);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 53 }}>
      <Icon name={icon} size={19} color={colors.secondary} />
      <View style={{ flex: 1, gap: 1 }}>
        <Copy variant="bodyCompact" style={{ fontSize: 13, fontWeight: '500' }}>
          {title}
        </Copy>
        {detail && (
          <Copy
            variant="bodyCompact"
            style={{
              color: colors.secondary,
              fontSize: typography.small.fontSize,
              lineHeight: typography.small.lineHeight,
            }}
          >
            {detail}
          </Copy>
        )}
      </View>
      <Switch
        accessibilityRole="switch"
        trackColor={{ false: controlColors.switchTrackOff, true: accent }}
        accessibilityLabel={title}
        accessibilityHint={disabled ? 'Modifiable entre deux courses' : detail}
        value={value}
        disabled={disabled}
        onValueChange={onChange}
      />
    </View>
  );
}

export default function RunStats({
  active,
  state,
  target,
  onTargetChange,
  onPrepare,
  onSettings,
  onMusic,
  onFinish,
  onConfirmFinish,
}: {
  active: boolean;
  state: SessionState;
  target: PaceTarget;
  onTargetChange: (target: PaceTarget) => void;
  onPrepare: () => void;
  onSettings: () => void;
  onMusic: () => void;
  onFinish: () => void;
  onConfirmFinish: () => void;
}) {
  const { colors } = useTheme();
  const s = createStyles(colors);
  const setup = useRunSetup(target, state);
  const run = state.run,
    activeTarget = run?.target ?? setup.target;
  const block = run?.workout?.segments[run.workout.currentIndex];
  const liveTarget = run?.workout
    ? block
      ? effectiveTarget(block.planned)
      : null
    : run
      ? paceTargetAt(run.target, run.distanceMeters)
      : null;
  const advanced =
    !!setup.definition || target.finishSeconds != null || target.kilometerTargets !== undefined;
  const center = Math.round((activeTarget.fast + activeTarget.slow) / 2);
  const setPace = (seconds: number) => {
    onTargetChange({ ...target, fast: seconds, slow: seconds });
  };
  return (
    <Screen gap={spacing.lg}>
      <View style={s.row}>
        <View>
          <Label>VOTRE COURSE</Label>
          <Copy variant="condensedTitle" accessibilityRole="header">
            STATS.
          </Copy>
        </View>
        <IconButton square icon="options-outline" label="Tous les réglages" onPress={onSettings} />
      </View>

      <Card variant="paper" contentStyle={{ padding: 20, gap: 10 }}>
        <View style={s.row}>
          <Label style={s.paperLabel}>ALLURE ACTUELLE</Label>
          <StatusBadge
            paper
            active={state.running}
            label={
              run
                ? state.autoPaused
                  ? 'PAUSE AUTO'
                  : state.running
                    ? QUALITY_LABELS[state.quality]
                    : 'EN PAUSE'
                : 'AVANT LE DÉPART'
            }
          />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 9 }}>
          <Copy
            variant="condensedMetric"
            style={{ fontSize: 77, lineHeight: 83, color: colors.heroText, letterSpacing: -1.5 }}
          >
            {run ? pace(state.pace) : '—'}
          </Copy>
          <Copy variant="bodyCompact" style={{ fontSize: 12, color: paperColors.label }}>
            min / km
          </Copy>
        </View>
        <View style={{ height: 1, backgroundColor: paperColors.line }} />
        <View style={{ flexDirection: 'row', gap: 18, paddingTop: 3 }}>
          <View style={{ flex: 1 }}>
            <Label style={s.paperLabel}>TEMPS ACTIF</Label>
            <Copy variant="condensedMetric" style={s.paperNumber}>
              {duration(run?.activeSeconds ?? 0)}
            </Copy>
          </View>
          <View style={{ width: 1, backgroundColor: paperColors.line }} />
          <View style={{ flex: 1 }}>
            <Label style={s.paperLabel}>DISTANCE</Label>
            <Copy variant="condensedMetric" style={s.paperNumber}>
              {km(run?.distanceMeters ?? 0)}
              <Copy variant="bodyCompact" style={{ color: paperColors.label, fontSize: 12 }}>
                {' '}
                km
              </Copy>
            </Copy>
          </View>
        </View>
      </Card>
      {run?.workout && (
        <WorkoutLivePanel workout={run.workout} qualityGood={state.quality === 'good'} busy={state.busy} />
      )}
      {run?.routeId && <NavigationPanel state={state} />}

      <View style={{ gap: 7 }}>
        <View style={s.row}>
          <Copy variant="bodyCompact" style={s.caption}>
            Allure moyenne
          </Copy>
          <Copy
            variant="bodyCompact"
            style={{ fontSize: 13, fontVariant: ['tabular-nums'], fontWeight: '600' }}
          >
            {run ? pace(averagePace(run)) : '—'}{' '}
            <Copy variant="bodyCompact" style={s.caption}>
              /km
            </Copy>
          </Copy>
        </View>
        {run && (
          <View style={s.row}>
            <Copy variant="bodyCompact" style={s.caption}>
              Dénivelé +
            </Copy>
            <Copy variant="bodyCompact" style={{ fontSize: 12 }}>
              {(run.elevationReliableSeconds ?? 0) > 0 ? Math.round(run.ascentMeters ?? 0) + ' m' : '—'}
            </Copy>
          </View>
        )}
        {run && (
          <View style={s.row}>
            <Copy variant="bodyCompact" style={s.caption}>
              Dénivelé −
            </Copy>
            <Copy variant="bodyCompact" style={s.caption}>
              {(run.elevationReliableSeconds ?? 0) > 0 ? Math.round(run.descentMeters ?? 0) + ' m' : '—'}
            </Copy>
          </View>
        )}
        {run && (
          <View style={s.row}>
            <Copy variant="bodyCompact" style={s.caption}>
              Temps total
            </Copy>
            <Copy variant="bodyCompact" style={{ fontSize: 12, fontVariant: ['tabular-nums'] }}>
              {duration(run.totalSeconds ?? run.activeSeconds)}
            </Copy>
          </View>
        )}
      </View>

      <View style={{ gap: 9 }}>
        <View style={s.row}>
          <SectionLabel title={run ? 'CIBLE ACTUELLE' : 'OBJECTIF DE COURSE'} />
          {!run && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Options avancées de la course"
              onPress={onPrepare}
              style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 }}
            >
              <Copy variant="bodyCompact" style={{ fontSize: 12, color: colors.secondary }}>
                Options ↗
              </Copy>
            </Pressable>
          )}
        </View>
        {!run && setup.definition && (
          <Copy variant="bodyCompact" style={{ fontSize: 12, color: colors.secondary }}>
            {setup.definition.name} · première cible ci-dessous
          </Copy>
        )}
        {run ? (
          <Card contentStyle={{ gap: 7 }}>
            <Label>
              {block?.planned.name ??
                (run.target.kilometerTargets
                  ? 'Kilomètre ' + (Math.floor(run.distanceMeters / 1000) + 1)
                  : 'Votre allure de course')}
            </Label>
            <Copy variant="condensedMetric" style={{ fontSize: 36, lineHeight: 42 }}>
              {liveTarget ? pace(Math.round((liveTarget.fast + liveTarget.slow) / 2)) : 'Libre'}
            </Copy>
            <Copy variant="bodyCompact" style={{ fontSize: 12, color: colors.secondary }}>
              {liveTarget
                ? liveTarget.fast === liveTarget.slow
                  ? 'min / km · sans marge'
                  : 'min / km · ' + pace(liveTarget.fast) + ' à ' + pace(liveTarget.slow)
                : 'Aucune consigne d’allure pour ce bloc.'}
            </Copy>
          </Card>
        ) : (
          <Card contentStyle={{ padding: 13, gap: 12 }}>
            <PaceStepper value={center} onChange={setPace} disabled={!active || advanced}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Choisir précisément mon allure"
                disabled={advanced}
                onPress={onPrepare}
                style={{ minHeight: 44, alignItems: 'center', justifyContent: 'center' }}
              >
                <Copy variant="condensedMetric" style={{ fontSize: 36, lineHeight: 39 }}>
                  {pace(center)}
                </Copy>
                <Copy
                  variant="bodyCompact"
                  style={{
                    fontSize: typography.small.fontSize,
                    lineHeight: typography.small.lineHeight,
                    color: colors.secondary,
                  }}
                >
                  {activeTarget.fast === activeTarget.slow
                    ? 'min / km · sans marge'
                    : 'min / km · ± ' + Math.round((activeTarget.slow - activeTarget.fast) / 2) + ' s'}
                </Copy>
              </Pressable>
            </PaceStepper>
            <View
              accessibilityRole="radiogroup"
              accessibilityLabel="Distance cible"
              style={{ flexDirection: 'row', gap: 5, flexWrap: 'wrap' }}
            >
              {(
                [
                  [null, 'Libre'],
                  [5000, '5 km'],
                  [10000, '10 km'],
                  [21097.5, 'Semi'],
                ] as const
              ).map(([meters, label]) => (
                <Pressable
                  key={label}
                  accessibilityRole="radio"
                  accessibilityLabel={label}
                  accessibilityState={{
                    checked: activeTarget.distanceMeters === meters,
                    disabled: !!run || advanced,
                  }}
                  aria-checked={activeTarget.distanceMeters === meters}
                  disabled={!!run || advanced}
                  onPress={() => {
                    if (activeTarget.distanceMeters !== meters) haptic.select();
                    onTargetChange({ ...target, distanceMeters: meters });
                  }}
                  style={({ pressed }) => ({
                    flexGrow: 1,
                    minWidth: 54,
                    minHeight: 42,
                    paddingHorizontal: 9,
                    borderRadius: 8,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor:
                      activeTarget.distanceMeters === meters
                        ? colors.heroStart
                        : pressed
                          ? controlColors.choicePressed
                          : colors.raised,
                  })}
                >
                  <Copy
                    variant="bodyCompact"
                    style={{
                      fontSize: 12,
                      fontWeight: '600',
                      color: activeTarget.distanceMeters === meters ? colors.heroText : colors.secondary,
                    }}
                  >
                    {label}
                  </Copy>
                </Pressable>
              ))}
            </View>
          </Card>
        )}
      </View>

      <View style={{ gap: 9 }}>
        <SectionLabel title="RÉGLAGES DE COURSE" />
        <Card contentStyle={{ paddingVertical: 2, paddingHorizontal: 15 }}>
          <Setting
            icon="phone-portrait-outline"
            title="Vibrations"
            detail="Retours tactiles et repères du coach."
            value={state.settings.hapticsEnabled}
            onChange={(hapticsEnabled) => void session.updateSettings({ hapticsEnabled })}
          />
          <View style={s.separator} />
          <Setting
            icon="volume-medium-outline"
            title="Signaux audio"
            value={state.settings.audioEnabled}
            onChange={(audioEnabled) => void session.updateSettings({ audioEnabled })}
          />
          <View style={s.separator} />
          <Setting
            icon="pause-circle-outline"
            title="Pause automatique"
            detail={run ? 'Modifiable après la course' : undefined}
            value={state.settings.autoPauseEnabled === true}
            disabled={!!run}
            onChange={(autoPauseEnabled) => void session.updateSettings({ autoPauseEnabled })}
          />
          {CAN_BACKGROUND && (
            <>
              <View style={s.separator} />
              <Setting
                icon="lock-closed-outline"
                title="Suivi écran verrouillé"
                value={state.settings.backgroundEnabled}
                disabled={!!run}
                onChange={(backgroundEnabled) => void session.updateSettings({ backgroundEnabled })}
              />
            </>
          )}
        </Card>
      </View>

      {run && (
        <View style={{ gap: 9 }}>
          <Button
            highContrast
            size="large"
            feedback="medium"
            title={
              state.autoPaused ? 'Pause manuelle' : state.running ? 'Mettre en pause' : 'Reprendre la course'
            }
            icon={state.running || state.autoPaused ? 'pause' : 'play'}
            disabled={state.busy}
            onPress={() => {
              if (state.running || state.autoPaused) void session.pause();
              else void session.resume();
            }}
          />
          <HoldToFinish key={run.id} disabled={state.busy} onFinish={onFinish} onConfirm={onConfirmFinish} />
          {!state.backgroundActive && (
            <Copy
              variant="bodyCompact"
              style={{ fontSize: typography.small.fontSize, color: colors.secondary, textAlign: 'center' }}
            >
              Gardez Sprinter ouvert pendant la course.
            </Copy>
          )}
        </View>
      )}
      {run && <RunInsights active={active} state={state} onMusic={onMusic} />}
    </Screen>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
    caption: { fontSize: 12, lineHeight: 18, color: colors.secondary },
    paperLabel: { color: paperColors.label, fontSize: typography.label.fontSize, letterSpacing: 1 },
    paperNumber: { color: colors.heroText, fontSize: 36, lineHeight: 42 },
    separator: { height: 1, marginLeft: 31, backgroundColor: colors.line },
  });
