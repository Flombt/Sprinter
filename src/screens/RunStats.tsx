import { spacing, fontSizes, fontWeights, radii, iconSizes } from '../ui/tokens';
import { Pressable, StyleSheet, View } from 'react-native';
import { FeedbackPressable } from '../ui/FeedbackPressable';
import { averagePace, duration, km, pace } from '../core/format';
import { QUALITY_LABELS, type PaceTarget } from '../core/types';
import { session, type SessionState } from '../services/session';
import { CAN_BACKGROUND } from '../services/capabilities';
import { Icon, type IconName } from '../ui/components';
import { HoldToFinish } from '../ui/HoldToFinish';
import { PaceGauge, paceGaugeTarget } from '../ui/PaceGauge';
import { useAnimatedVisibility } from '../ui/layoutAnimation';
import { ActionButton, ActionIcon, AppScreen, BodyText, useDesign, DisplayText, Kicker, SectionLabel, StatusBadge, Surface, ToggleSwitch } from '../ui/design';
import { useRunSetup } from '../ui/useRunSetup';
import { WorkoutLivePanel } from '../workouts/components';
import { NavigationPanel } from '../tools/activityComponents';
import { RunInsights } from './RunInsights';
import { paceTargetAt } from '../pacing/goals';
import { effectiveTarget } from '../workouts/definition';

function Setting({ icon, title, detail, value, onChange, disabled = false }: {
  icon: IconName; title: string; detail?: string; value: boolean; onChange: (value: boolean) => void; disabled?: boolean;
}) {
  const design = useDesign();
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 53 }}>
    <Icon name={icon} size={iconSizes.standard} color={design.secondary} />
    <View style={{ flex: 1, gap: 1 }}><BodyText style={{ fontSize: fontSizes.caption, fontWeight: fontWeights.medium }}>{title}</BodyText>
      {detail && <BodyText style={{ color: design.secondary, fontSize: fontSizes.micro, lineHeight: 14 }}>{detail}</BodyText>}
    </View>
    <ToggleSwitch label={title} hint={disabled ? 'Modifiable entre deux courses' : detail} value={value} disabled={disabled} onChange={onChange} />
  </View>;
}

export default function RunStats({ state, target, onTargetChange, onPrepare, onSettings, onFinish }: {
  state: SessionState; target: PaceTarget; onTargetChange: (target: PaceTarget) => void; onPrepare: () => void; onSettings: () => void; onFinish: (held?: boolean) => void;
}) {
  const design = useDesign();
  const s = createStyles(design);
  const setup = useRunSetup(target, state);
  const showAutoPause = useAnimatedVisibility(state.autoPaused);
  const run = state.run, activeTarget = run?.target ?? setup.target;
  const block = run?.workout?.segments[run.workout.currentIndex];
  const liveTarget = run?.workout ? block ? effectiveTarget(block.planned) : null : run ? paceTargetAt(run.target, run.distanceMeters) : null;
  const advanced = !!setup.definition || target.finishSeconds != null || target.kilometerTargets !== undefined;
  const center = Math.round((activeTarget.fast + activeTarget.slow) / 2);
  const setPace = (seconds: number) => {
    const next = Math.min(1200, Math.max(120, seconds));
    onTargetChange({ ...target, fast: next, slow: next });
  };
  return <AppScreen gap={17}>
    <View style={s.row}>
      <View><Kicker>VOTRE COURSE</Kicker><DisplayText accessibilityRole="header">STATS.</DisplayText></View>
      <ActionIcon icon="options-outline" label="Tous les réglages" onPress={onSettings} />
    </View>

    <Surface paper contentStyle={{ padding: spacing.xl, gap: spacing.sm }}>
      <View style={s.row}><Kicker style={s.paperLabel}>ALLURE ACTUELLE</Kicker>
        {run && showAutoPause ? <StatusBadge key="auto-pause" paper label="PAUSE AUTO" />
          : <StatusBadge key="status" paper active={state.running} label={run ? state.running ? QUALITY_LABELS[state.quality] : 'EN PAUSE' : 'AVANT LE DÉPART'} />}
      </View>
      {run ? <PaceGauge target={paceGaugeTarget(run)} tolerance={run.config.toleranceSeconds ?? 0} value={state.pace} status={state.paceState} paper /> : <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm }}>
        <DisplayText numeric style={{ fontSize: fontSizes.pace, lineHeight: 83, color: design.ink, letterSpacing: -1.5 }}>—</DisplayText>
        <BodyText style={{ fontSize: fontSizes.small, color: '#706C65' }}>min / km</BodyText>
      </View>}
      <View style={{ height: 1, backgroundColor: design.paperLine }} />
      <View style={{ flexDirection: 'row', gap: spacing.lg, paddingTop: 3 }}>
        <View style={{ flex: 1 }}><Kicker style={s.paperLabel}>TEMPS ACTIF</Kicker><DisplayText numeric style={s.paperNumber}>{duration(run?.activeSeconds ?? 0)}</DisplayText></View>
        <View style={{ width: 1, backgroundColor: design.paperLine }} />
        <View style={{ flex: 1 }}><Kicker style={s.paperLabel}>DISTANCE</Kicker><DisplayText numeric style={s.paperNumber}>{km(run?.distanceMeters ?? 0)}<BodyText style={{ color: '#706C65', fontSize: fontSizes.small }}> km</BodyText></DisplayText></View>
      </View>
    </Surface>
    {run?.workout && <WorkoutLivePanel workout={run.workout} qualityGood={state.quality === 'good'} busy={state.busy} />}
    {run?.routeId && <NavigationPanel state={state} />}

    <View style={{ gap: spacing.sm }}>
      <View style={s.row}><BodyText style={s.caption}>Allure moyenne</BodyText><BodyText style={{ fontSize: fontSizes.caption, fontVariant: ['tabular-nums'], fontWeight: fontWeights.semibold }}>{run ? pace(averagePace(run)) : '—'} <BodyText style={s.caption}>/km</BodyText></BodyText></View>
      {run && <View style={s.row}><BodyText style={s.caption}>Dénivelé +</BodyText><BodyText style={{ fontSize: fontSizes.small }}>{(run.elevationReliableSeconds ?? 0) > 0 ? Math.round(run.ascentMeters ?? 0) + ' m' : '—'}</BodyText></View>}
      {run && <View style={s.row}><BodyText style={s.caption}>Temps total</BodyText><BodyText style={{ fontSize: fontSizes.small, fontVariant: ['tabular-nums'] }}>{duration(run.totalSeconds ?? run.activeSeconds)}</BodyText></View>}
    </View>

    <View style={{ gap: spacing.sm }}>
      <View style={s.row}><SectionLabel title={run ? 'CIBLE ACTUELLE' : 'OBJECTIF DE COURSE'} />
        {!run && <FeedbackPressable accessibilityRole="button" accessibilityLabel="Options avancées de la course" onPress={onPrepare} style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.xs }}><BodyText style={{ fontSize: fontSizes.small, color: design.secondary }}>Options ↗</BodyText></FeedbackPressable>}
      </View>
      {!run && setup.definition && <BodyText style={{ fontSize: fontSizes.small, color: design.secondary }}>{setup.definition.name} · première cible ci-dessous</BodyText>}
      {run ? <Surface contentStyle={{ gap: spacing.sm }}>
        <Kicker>{block?.planned.name ?? (run.target.kilometerTargets ? 'Kilomètre ' + (Math.floor(run.distanceMeters / 1000) + 1) : 'Votre allure de course')}</Kicker>
        <DisplayText numeric style={{ fontSize: fontSizes.heading, lineHeight: 42 }}>{liveTarget ? pace(Math.round((liveTarget.fast + liveTarget.slow) / 2)) : 'Libre'}</DisplayText>
        <BodyText style={{ fontSize: fontSizes.small, color: design.secondary }}>{liveTarget ? liveTarget.fast === liveTarget.slow ? 'min / km · sans marge' : 'min / km · ' + pace(liveTarget.fast) + ' à ' + pace(liveTarget.slow) : 'Aucune consigne d’allure pour ce bloc.'}</BodyText>
      </Surface> : <Surface contentStyle={{ padding: spacing.md, gap: spacing.md }}>
        <View style={s.row}>
          <ActionIcon icon="remove" label="Accélérer l’allure cible de 5 secondes par kilomètre" onPress={() => setPace(center - 5)} disabled={!!run || advanced || center <= 120} />
          <FeedbackPressable accessibilityRole="button" accessibilityLabel="Choisir précisément mon allure" disabled={advanced} onPress={onPrepare} style={{ minHeight: 44, alignItems: 'center', justifyContent: 'center' }}><DisplayText numeric style={{ fontSize: fontSizes.heading, lineHeight: 39 }}>{pace(center)}</DisplayText>
            <BodyText style={{ fontSize: fontSizes.micro, lineHeight: 15, color: design.secondary }}>{activeTarget.fast === activeTarget.slow ? 'min / km · sans marge' : 'min / km · ± ' + Math.round((activeTarget.slow - activeTarget.fast) / 2) + ' s'}</BodyText>
          </FeedbackPressable>
          <ActionIcon icon="add" label="Ralentir l’allure cible de 5 secondes par kilomètre" onPress={() => setPace(center + 5)} disabled={!!run || advanced || center >= 1200} />
        </View>
        <View accessibilityRole="radiogroup" accessibilityLabel="Distance cible" style={{ flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap' }}>
          {([[null, 'Libre'], [5000, '5 km'], [10000, '10 km'], [21097.5, 'Semi']] as const).map(([meters, label]) => <Pressable key={label}
            accessibilityRole="radio" accessibilityLabel={label} accessibilityState={{ checked: activeTarget.distanceMeters === meters, disabled: !!run || advanced }}
            aria-checked={activeTarget.distanceMeters === meters} disabled={!!run || advanced} onPress={() => onTargetChange({ ...target, distanceMeters: meters })}
            style={({ pressed }) => ({ flexGrow: 1, minWidth: 54, minHeight: 42, paddingHorizontal: spacing.sm, borderRadius: radii.sm, alignItems: 'center', justifyContent: 'center',
              backgroundColor: activeTarget.distanceMeters === meters ? design.paper : pressed ? '#36363A' : design.raised })}>
            <BodyText style={{ fontSize: fontSizes.small, fontWeight: fontWeights.semibold, color: activeTarget.distanceMeters === meters ? design.ink : design.secondary }}>{label}</BodyText>
          </Pressable>)}
        </View>
      </Surface>}
    </View>

    <View style={{ gap: spacing.sm }}><SectionLabel title="RÉGLAGES DE COURSE" />
      <Surface contentStyle={{ paddingVertical: 2, paddingHorizontal: spacing.lg }}>
        <Setting icon="phone-portrait-outline" title="Vibrations" value={state.settings.hapticsEnabled} onChange={hapticsEnabled => void session.updateSettings({ hapticsEnabled })} />
        <View style={s.separator} />
        <Setting icon="volume-medium-outline" title="Signaux audio" value={state.settings.audioEnabled} onChange={audioEnabled => void session.updateSettings({ audioEnabled })} />
        <View style={s.separator} />
        <Setting icon="pause-circle-outline" title="Pause automatique" detail={run ? 'Modifiable après la course' : undefined} value={state.settings.autoPauseEnabled === true} disabled={!!run} onChange={autoPauseEnabled => void session.updateSettings({ autoPauseEnabled })} />
        {CAN_BACKGROUND && <><View style={s.separator} /><Setting icon="lock-closed-outline" title="Suivi écran verrouillé" value={state.settings.backgroundEnabled} disabled={!!run} onChange={backgroundEnabled => void session.updateSettings({ backgroundEnabled })} /></>}
      </Surface>
    </View>

    {run && <View style={{ gap: spacing.sm }}><ActionButton title={state.running || state.autoPaused ? 'Mettre en pause' : 'Reprendre la course'} icon={state.running || state.autoPaused ? 'pause' : 'play'} disabled={state.busy}
      onPress={() => { if (state.running || state.autoPaused) void session.pause(); else void session.resume(); }} />
      <HoldToFinish key={run.id} disabled={state.busy} onFinish={onFinish} />
      {!state.backgroundActive && <BodyText style={{ fontSize: fontSizes.small, color: design.secondary, textAlign: 'center' }}>Gardez Sprinter ouvert pendant la course.</BodyText>}
    </View>}
    {run && <RunInsights state={state} />}
  </AppScreen>;
}

const createStyles = (design: ReturnType<typeof useDesign>) => StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  caption: { fontSize: fontSizes.small, lineHeight: 18, color: design.secondary },
  paperLabel: { color: '#706C65', fontSize: fontSizes.micro, letterSpacing: 1 },
  paperNumber: { color: design.ink, fontSize: fontSizes.heading, lineHeight: 42 },
  separator: { height: 1, marginLeft: spacing.xxxl, backgroundColor: design.line },
});
