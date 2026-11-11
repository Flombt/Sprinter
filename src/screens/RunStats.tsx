import { Pressable, StyleSheet, View } from 'react-native';
import { averagePace, duration, km, pace } from '../core/format';
import { QUALITY_LABELS, type PaceTarget } from '../core/types';
import { session, type SessionState } from '../services/session';
import { CAN_BACKGROUND } from '../services/capabilities';
import { Icon, type IconName } from '../ui/components';
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
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 53 }}>
    <Icon name={icon} size={19} color={design.secondary} />
    <View style={{ flex: 1, gap: 1 }}><BodyText style={{ fontSize: 13, fontWeight: '500' }}>{title}</BodyText>
      {detail && <BodyText style={{ color: design.secondary, fontSize: 10, lineHeight: 14 }}>{detail}</BodyText>}
    </View>
    <ToggleSwitch label={title} hint={disabled ? 'Modifiable entre deux courses' : detail} value={value} disabled={disabled} onChange={onChange} />
  </View>;
}

export default function RunStats({ state, target, onTargetChange, onPrepare, onSettings, onMusic, onFinish }: {
  state: SessionState;
  target: PaceTarget;
  onTargetChange: (target: PaceTarget) => void;
  onPrepare: () => void;
  onSettings: () => void;
  onMusic: () => void;
  onFinish: () => void;
}) {
  const design = useDesign();
  const s = createStyles(design);
  const setup = useRunSetup(target, state);
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

    <Surface paper contentStyle={{ padding: 20, gap: 10 }}>
      <View style={s.row}><Kicker style={s.paperLabel}>ALLURE ACTUELLE</Kicker>
        <StatusBadge paper active={state.running} label={run ? state.autoPaused ? 'PAUSE AUTO' : state.running ? QUALITY_LABELS[state.quality] : 'EN PAUSE' : 'AVANT LE DÉPART'} />
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 9 }}>
        <DisplayText numeric style={{ fontSize: 77, lineHeight: 83, color: design.ink, letterSpacing: -1.5 }}>{run ? pace(state.pace) : '—'}</DisplayText>
        <BodyText style={{ fontSize: 12, color: '#706C65' }}>min / km</BodyText>
      </View>
      <View style={{ height: 1, backgroundColor: design.paperLine }} />
      <View style={{ flexDirection: 'row', gap: 18, paddingTop: 3 }}>
        <View style={{ flex: 1 }}><Kicker style={s.paperLabel}>TEMPS ACTIF</Kicker><DisplayText numeric style={s.paperNumber}>{duration(run?.activeSeconds ?? 0)}</DisplayText></View>
        <View style={{ width: 1, backgroundColor: design.paperLine }} />
        <View style={{ flex: 1 }}><Kicker style={s.paperLabel}>DISTANCE</Kicker><DisplayText numeric style={s.paperNumber}>{km(run?.distanceMeters ?? 0)}<BodyText style={{ color: '#706C65', fontSize: 12 }}> km</BodyText></DisplayText></View>
      </View>
    </Surface>
    {run?.workout && <WorkoutLivePanel workout={run.workout} qualityGood={state.quality === 'good'} busy={state.busy} />}
    {run?.routeId && <NavigationPanel state={state} />}

    <View style={{ gap: 7 }}>
      <View style={s.row}><BodyText style={s.caption}>Allure moyenne</BodyText><BodyText style={{ fontSize: 13, fontVariant: ['tabular-nums'], fontWeight: '600' }}>{run ? pace(averagePace(run)) : '—'} <BodyText style={s.caption}>/km</BodyText></BodyText></View>
      {run && <View style={s.row}><BodyText style={s.caption}>Dénivelé +</BodyText><BodyText style={{ fontSize: 12 }}>{(run.elevationReliableSeconds ?? 0) > 0 ? Math.round(run.ascentMeters ?? 0) + ' m' : '—'}</BodyText></View>}
      {run && <View style={s.row}><BodyText style={s.caption}>Temps total</BodyText><BodyText style={{ fontSize: 12, fontVariant: ['tabular-nums'] }}>{duration(run.totalSeconds ?? run.activeSeconds)}</BodyText></View>}
    </View>

    <View style={{ gap: 9 }}>
      <View style={s.row}><SectionLabel title={run ? 'CIBLE ACTUELLE' : 'OBJECTIF DE COURSE'} />
        {!run && <Pressable accessibilityRole="button" accessibilityLabel="Options avancées de la course" onPress={onPrepare} style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 }}><BodyText style={{ fontSize: 12, color: design.secondary }}>Options ↗</BodyText></Pressable>}
      </View>
      {!run && setup.definition && <BodyText style={{ fontSize: 12, color: design.secondary }}>{setup.definition.name} · première cible ci-dessous</BodyText>}
      {run ? <Surface contentStyle={{ gap: 7 }}>
        <Kicker>{block?.planned.name ?? (run.target.kilometerTargets ? 'Kilomètre ' + (Math.floor(run.distanceMeters / 1000) + 1) : 'Votre allure de course')}</Kicker>
        <DisplayText numeric style={{ fontSize: 36, lineHeight: 42 }}>{liveTarget ? pace(Math.round((liveTarget.fast + liveTarget.slow) / 2)) : 'Libre'}</DisplayText>
        <BodyText style={{ fontSize: 12, color: design.secondary }}>{liveTarget ? liveTarget.fast === liveTarget.slow ? 'min / km · sans marge' : 'min / km · ' + pace(liveTarget.fast) + ' à ' + pace(liveTarget.slow) : 'Aucune consigne d’allure pour ce bloc.'}</BodyText>
      </Surface> : <Surface contentStyle={{ padding: 13, gap: 12 }}>
        <View style={s.row}>
          <ActionIcon icon="remove" label="Accélérer l’allure cible de 5 secondes par kilomètre" onPress={() => setPace(center - 5)} disabled={!!run || advanced || center <= 120} />
          <Pressable accessibilityRole="button" accessibilityLabel="Choisir précisément mon allure" disabled={advanced} onPress={onPrepare} style={{ minHeight: 44, alignItems: 'center', justifyContent: 'center' }}><DisplayText numeric style={{ fontSize: 36, lineHeight: 39 }}>{pace(center)}</DisplayText>
            <BodyText style={{ fontSize: 10, lineHeight: 15, color: design.secondary }}>{activeTarget.fast === activeTarget.slow ? 'min / km · sans marge' : 'min / km · ± ' + Math.round((activeTarget.slow - activeTarget.fast) / 2) + ' s'}</BodyText>
          </Pressable>
          <ActionIcon icon="add" label="Ralentir l’allure cible de 5 secondes par kilomètre" onPress={() => setPace(center + 5)} disabled={!!run || advanced || center >= 1200} />
        </View>
        <View accessibilityRole="radiogroup" accessibilityLabel="Distance cible" style={{ flexDirection: 'row', gap: 5, flexWrap: 'wrap' }}>
          {([[null, 'Libre'], [5000, '5 km'], [10000, '10 km'], [21097.5, 'Semi']] as const).map(([meters, label]) => <Pressable key={label}
            accessibilityRole="radio" accessibilityLabel={label} accessibilityState={{ checked: activeTarget.distanceMeters === meters, disabled: !!run || advanced }}
            aria-checked={activeTarget.distanceMeters === meters} disabled={!!run || advanced} onPress={() => onTargetChange({ ...target, distanceMeters: meters })}
            style={({ pressed }) => ({ flexGrow: 1, minWidth: 54, minHeight: 42, paddingHorizontal: 9, borderRadius: 8, alignItems: 'center', justifyContent: 'center',
              backgroundColor: activeTarget.distanceMeters === meters ? design.paper : pressed ? '#36363A' : design.raised })}>
            <BodyText style={{ fontSize: 12, fontWeight: '600', color: activeTarget.distanceMeters === meters ? design.ink : design.secondary }}>{label}</BodyText>
          </Pressable>)}
        </View>
      </Surface>}
    </View>

    <View style={{ gap: 9 }}><SectionLabel title="RÉGLAGES DE COURSE" />
      <Surface contentStyle={{ paddingVertical: 2, paddingHorizontal: 15 }}>
        <Setting icon="phone-portrait-outline" title="Vibrations" value={state.settings.hapticsEnabled} onChange={hapticsEnabled => void session.updateSettings({ hapticsEnabled })} />
        <View style={s.separator} />
        <Setting icon="volume-medium-outline" title="Signaux audio" value={state.settings.audioEnabled} onChange={audioEnabled => void session.updateSettings({ audioEnabled })} />
        <View style={s.separator} />
        <Setting icon="pause-circle-outline" title="Pause automatique" detail={run ? 'Modifiable après la course' : undefined} value={state.settings.autoPauseEnabled === true} disabled={!!run} onChange={autoPauseEnabled => void session.updateSettings({ autoPauseEnabled })} />
        {CAN_BACKGROUND && <><View style={s.separator} /><Setting icon="lock-closed-outline" title="Suivi écran verrouillé" value={state.settings.backgroundEnabled} disabled={!!run} onChange={backgroundEnabled => void session.updateSettings({ backgroundEnabled })} /></>}
      </Surface>
    </View>

    {run && <View style={{ gap: 9 }}><ActionButton title={state.running || state.autoPaused ? 'Mettre en pause' : 'Reprendre la course'} icon={state.running || state.autoPaused ? 'pause' : 'play'} disabled={state.busy}
      onPress={() => { if (state.running || state.autoPaused) void session.pause(); else void session.resume(); }} />
      <ActionButton title="Terminer la course" icon="stop-outline" secondary disabled={state.busy} onPress={onFinish} />
      {!state.backgroundActive && <BodyText style={{ fontSize: 11, color: design.secondary, textAlign: 'center' }}>Gardez Sprinter ouvert pendant la course.</BodyText>}
    </View>}
    {run && <RunInsights state={state} onMusic={onMusic} />}
  </AppScreen>;
}

const createStyles = (design: ReturnType<typeof useDesign>) => StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  caption: { fontSize: 12, lineHeight: 18, color: design.secondary },
  paperLabel: { color: '#706C65', fontSize: 9, letterSpacing: 1 },
  paperNumber: { color: design.ink, fontSize: 36, lineHeight: 42 },
  separator: { height: 1, marginLeft: 31, backgroundColor: design.line },
});
