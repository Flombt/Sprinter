import { ChoiceGroup, Input, Toggle, Picker } from '../ui/controls';
import { useState, useSyncExternalStore } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DEFAULT_EXACT_TARGET, PaceTarget } from '../core/types';
import { duration, estimatedDuration, pace, validateTarget } from '../core/format';
import { session, SessionState } from '../services/session';
import { CAN_BACKGROUND } from '../services/capabilities';
import { Button, Copy, Header, Icon, IconButton, Label, NumericReadout, Panel, Screen, styles } from '../ui/components';
import { RunnerGlyph } from '../ui/brand';
import { useAdaptiveLayout, useTheme } from '../ui/theme';
import { interaction, radii, spacing } from '../ui/tokens';
import { MusicSelection } from '../spotify/components';
import { music } from '../spotify/device';
import { workouts } from '../workouts/store';
import { validateWorkout } from '../workouts/definition';
import { startPreparedRun } from '../services/runPreparation';
import { WorkoutSummary } from './Workouts';
import { PacingGoalEditor } from '../pacing/GoalEditor';
import { useProgression } from '../progression/hooks';
import { progression } from '../progression/store';
import { entryState } from '../progression/aggregates';
import { dayLabel } from '../progression/dates';
import { RhythmTools, SelectedRoute, WeatherPanel, useTools } from '../tools/components';

function PaceControl({ label, value, onChange, onEdit }: { label: string; value: number; onChange: (value: number) => void; onEdit: () => void }) {
  const { largeText, compact } = useAdaptiveLayout(); const stacked = largeText || compact;
  const decrement = <IconButton icon="remove" feedback="select" label={`Réduire ${label} de cinq secondes`} onPress={() => onChange(Math.max(120, value - 5))} />;
  const increment = <IconButton icon="add" feedback="select" label={`Augmenter ${label} de cinq secondes`} onPress={() => onChange(Math.min(1200, value + 5))} />;
  const edit = <Pressable onPress={onEdit} accessibilityRole="button" accessibilityLabel={`${label}, ${pace(value)} par kilomètre. Modifier les minutes et secondes.`}
    style={({ pressed }) => ({ minHeight: 60, minWidth: 0, justifyContent: 'center', flex: stacked ? undefined : 1, alignItems: 'center', opacity: pressed ? interaction.pressedOpacity : 1 })}>
    <NumericReadout variant="display" value={pace(value)} />
  </Pressable>;
  return <View style={{ gap: spacing.md }}><Label>{label}</Label>
    {stacked ? <>{edit}<View style={[styles.row, { justifyContent: 'center', gap: spacing.xxl }]}>{decrement}{increment}</View></>
      : <View style={[styles.row, { justifyContent: 'space-between', gap: spacing.md }]}>{decrement}{edit}{increment}</View>}
    <Copy muted variant="caption" style={{ textAlign: 'center' }}>min/km · touchez l’allure pour affiner</Copy>
  </View>;
}
export default function Preparation({ state, initialTarget, onTargetChange, onBack, onStarted, onMusic, onWorkouts, onTools }: { state: SessionState; initialTarget?: PaceTarget; onTargetChange?: (target: PaceTarget) => void; onBack: () => void; onStarted: () => void; onMusic: () => void; onWorkouts: () => void; onTools: () => void }) {
  const { colors, reduceMotion } = useTheme(); const insets = useSafeAreaInsets();
  const [footerHeight, setFooterHeight] = useState(115);
  const [target, setLocalTarget] = useState<PaceTarget>({ ...(initialTarget ?? DEFAULT_EXACT_TARGET) });
  const [precise, setPrecise] = useState(() => target.fast === target.slow);
  const setTarget = (value: PaceTarget) => { setLocalTarget(value); onTargetChange?.(value); };
  const standard = [null, 5000, 10000, 21097.5].includes(target.distanceMeters);
  const [custom, setCustom] = useState(!standard); const [distance, setDistance] = useState(target.distanceMeters ? String(target.distanceMeters / 1000) : '');
  const [editing, setEditing] = useState<'fast' | 'slow' | null>(null); const [editValue, setEditValue] = useState(310);
  const library = useSyncExternalStore(workouts.subscribe, workouts.getSnapshot, workouts.getSnapshot);
  const tools = useTools(), referenceRoute = tools.routes.find(r => r.id === tools.preferences.selectedRouteId);
  const progress = useProgression(), entryId = progress.data.selectedEntryId;
  const entry = progress.data.entries.find(e => e.id === entryId);
  const plannedEntry = entry && entry.kind === 'run' && entry.status !== 'skipped' && !['completed', 'partial', 'orphaned'].includes(entryState(entry, state.history, progress.data).state) ? entry : null;
  const selected = plannedEntry ? plannedEntry.workout : library.preferences.selected;
  const shoe = progress.data.shoes.find(s => s.id === progress.data.defaultShoeId && !s.archived);
  const error = entryId && !plannedEntry ? 'La date sélectionnée est indisponible ou déjà associée. Retirez ce choix de calendrier pour démarrer librement.' : selected ? validateWorkout(selected)[0] ?? null : validateTarget(target, state.settings.config.maximumSpeed), estimate = estimatedDuration(target);
  const open = (key: 'fast' | 'slow') => { setEditValue(target[key]); setEditing(key); };
  const start = async () => {
    if (await startPreparedRun(target)) { onStarted(); void music.onRunStarted(); }
  };
  return <View style={{ flex: 1, backgroundColor: colors.background }}><Screen bottom={Math.max(spacing.xxl, footerHeight - insets.bottom + spacing.lg)}>
    <Header title="Votre prochaine sortie" onBack={onBack} />
    <View style={[styles.row, { alignSelf: 'flex-start', gap: 9, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: colors.raised, borderRadius: 30 }]}><RunnerGlyph size={18} color={colors.text} /><Copy style={{ fontSize: 13, fontWeight: '600' }}>Course à pied</Copy></View>
    <View style={{ gap: spacing.sm }}><Copy accessibilityRole="header" variant="title">Fixez le rythme.{"\n"}On garde le tempo.</Copy>
      <Copy muted>{selected ? 'Votre séance guidera les changements d’allure, les efforts et les récupérations.' : 'Choisissez l’allure à suivre. Le coach vous indique quand accélérer ou ralentir.'}</Copy></View>
    <Panel style={{ gap: 12 }}><Label>Séance de cette sortie</Label><Copy variant="section">{selected?.name ?? 'Course libre'}</Copy>
      {plannedEntry && <Copy muted variant="caption">Calendrier : {plannedEntry.title} · prévu le {dayLabel(plannedEntry.day)}. La course sera associée à cette date après son enregistrement.</Copy>}
      {entryId && <Button title="Retirer le choix du calendrier" secondary disabled={progress.busy} onPress={() => void progression.selectEntry(null)} />}
      {selected && <WorkoutSummary definition={selected} />}<Button title={selected ? 'Changer ou configurer la séance' : 'Choisir une séance ou un défi'} secondary icon="fitness-outline" onPress={() => { if (entryId) void progression.selectEntry(null).then(ok => { if (ok) onWorkouts(); }); else onWorkouts(); }} />
      {selected && <Button title="Courir sans séance" secondary disabled={library.busy || progress.busy} onPress={() => { void (async () => { if (!entryId || await progression.selectEntry(null)) await workouts.select(null); })(); }} />}</Panel>
    {progress.ready && <Panel style={{ gap: 9 }}><Label>Chaussures de cette sortie</Label><Picker accessibilityLabel="Chaussures de cette sortie" selectedValue={shoe?.id ?? ''} onValueChange={id => { void progression.selectShoe(String(id) || null); }} enabled={!progress.busy && !state.run} itemStyle={{ color: colors.text }}>
      <Picker.Item label="Non attribuées" value="" />{progress.data.shoes.filter(s => !s.archived).map(s => <Picker.Item key={s.id} label={s.name} value={s.id} />)}</Picker><Copy muted variant="small">Choix mémorisé pour les prochains départs. L’attribution d’une ancienne sortie reste modifiable dans son journal.</Copy></Panel>}
    {progress.message && <Copy muted variant="caption">{progress.message}</Copy>}
    {!selected && <><PacingGoalEditor target={target} onChange={setTarget} onPaceModeChange={setPrecise} />
    {!precise && target.finishSeconds == null && target.kilometerTargets === undefined && <Panel style={{ gap: 22 }}><PaceControl label="Allure la plus rapide" value={target.fast} onEdit={() => open('fast')} onChange={fast => setTarget({ ...target, fast })} />
      <View style={{ height: 1, backgroundColor: colors.line }} /><PaceControl label="Allure la plus lente" value={target.slow} onEdit={() => open('slow')} onChange={slow => setTarget({ ...target, slow })} />
    </Panel>}
    <View style={{ gap: spacing.md }}><View style={[styles.row, { justifyContent: 'space-between', flexWrap: 'wrap', gap: spacing.sm }]}><Copy variant="section">Une distance en tête ?</Copy><Label>Optionnel</Label></View>
      <ChoiceGroup<string | number> label="Distance de la course" value={custom ? 'custom' : target.distanceMeters ?? 'free'}
        choices={[["free", "Libre"], [5000, "5 km"], [10000, "10 km"], [21097.5, "Semi"], ["custom", "Autre"]]}
        onChange={value => { setCustom(value === 'custom'); setTarget({ ...target, distanceMeters: value === 'custom' ? Number(distance.replace(',', '.')) * 1000 : value === 'free' ? null : Number(value) }); }} />
      {custom && <Input accessibilityLabel="Distance personnalisée en kilomètres" placeholder="Distance en kilomètres" placeholderTextColor={colors.muted} keyboardType="decimal-pad" value={distance}
        onChangeText={value => { setDistance(value); setTarget({ ...target, distanceMeters: Number(value.replace(',', '.')) * 1000 }); }} />}
      {estimate && !error && <Panel style={[styles.row, { justifyContent: 'space-between' }]}><View style={{ flex: 1 }}><Label>Temps prévu selon les plages</Label><Copy style={{ fontWeight: '600', fontSize: 21, marginTop: 5 }}>{duration(estimate[0])} – {duration(estimate[1])}</Copy>{target.finishSeconds != null && <Copy muted variant="caption">Objectif : {duration(target.finishSeconds)} de temps {target.timeBasis === 'total' ? 'total' : 'actif'}.</Copy>}</View><Icon name="flag-outline" color={colors.secondary} /></Panel>}
    </View></>}
    {error && <Copy accessibilityRole="alert" style={{ color: colors.danger }}>{error}</Copy>}
    <MusicSelection onChoose={onMusic} />
    <SelectedRoute onChoose={onTools} running={!!state.run} />
    <RhythmTools compact />
    <WeatherPanel route={referenceRoute} />
    <Panel variant="setting" style={{ gap: spacing.lg }}>
      <Toggle title="Signaux audio" body="Deux sons pour reconnaître l’écart." value={state.settings.audioEnabled} onChange={audioEnabled => void session.updateSettings({ audioEnabled })} />
      <Toggle title="Pause automatique aux arrêts" body="Le GPS reste actif pour détecter la reprise. Réglage appliqué au départ." value={state.settings.autoPauseEnabled === true} disabled={!!state.run} onChange={autoPauseEnabled => void session.updateSettings({ autoPauseEnabled })} />
      <View style={[styles.row, { gap: 10, alignItems: 'flex-start' }]}><Icon name={CAN_BACKGROUND && state.settings.backgroundEnabled ? 'lock-closed-outline' : 'phone-portrait-outline'} size={17} color={colors.secondary} />
        <Copy muted style={{ flex: 1, fontSize: 12, lineHeight: 18 }}>{CAN_BACKGROUND && state.settings.backgroundEnabled ? 'Suivi écran verrouillé activé. Les sons sont le moyen prévu pour les alertes en arrière-plan.' : 'Gardez Sprinter à l’écran pendant la course. Le suivi écran verrouillé nécessite une version installée avec cette fonction activée.'}</Copy></View>
    </Panel>
    <Copy muted style={{ fontSize: 12, textAlign: 'center' }}>{selected ? 'Une fin de séance ou un défi perdu ne termine pas votre course.' : 'Les alertes respectent le lissage, la confirmation et l’espacement configurés.'}</Copy>
  </Screen>
  <View onLayout={event => setFooterHeight(event.nativeEvent.layout.height)} style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: colors.background, padding: spacing.lg, paddingBottom: Math.max(spacing.lg, insets.bottom), borderTopWidth: 1, borderTopColor: colors.line }}>
    <Button title={state.busy ? 'Préparation du GPS…' : state.run ? 'Retrouver ma course' : 'Démarrer ma course'} icon="arrow-forward" onPress={() => { if (state.run) onStarted(); else void start(); }} disabled={(!state.run && !!error) || state.busy} />
  </View>
  <Modal visible={editing !== null} animationType={reduceMotion ? 'none' : 'slide'} transparent onRequestClose={() => setEditing(null)}>
    <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: colors.scrim }}><ScrollView accessibilityViewIsModal style={{ flexGrow: 0, maxHeight: '92%', backgroundColor: colors.surface, borderTopLeftRadius: radii.hero, borderTopRightRadius: radii.hero }} contentContainerStyle={{ padding: spacing.xxl, paddingBottom: Math.max(spacing.xxl, insets.bottom) }}>
      <Header title="Ajuster l’allure" right={<IconButton icon="close" label="Annuler" onPress={() => setEditing(null)} />} />
      <View style={[styles.row, { marginVertical: spacing.lg }]}><View style={{ flex: 1 }}><Label style={{ textAlign: 'center' }}>Minutes</Label><Picker accessibilityLabel="Minutes par kilomètre" selectedValue={Math.floor(editValue / 60)} onValueChange={minutes => setEditValue(Math.min(1200, Number(minutes) * 60 + editValue % 60))} itemStyle={{ color: colors.text }}>
        {Array.from({ length: 19 }, (_, index) => <Picker.Item key={index} label={String(index + 2)} value={index + 2} />)}</Picker></View>
        <View style={{ flex: 1 }}><Label style={{ textAlign: 'center' }}>Secondes</Label><Picker accessibilityLabel="Secondes par kilomètre" selectedValue={editValue % 60} onValueChange={seconds => setEditValue(Math.min(1200, Math.floor(editValue / 60) * 60 + Number(seconds)))} itemStyle={{ color: colors.text }}>
          {Array.from({ length: 60 }, (_, index) => <Picker.Item key={index} label={String(index).padStart(2, '0')} value={index} />)}</Picker></View></View>
      <Button title={`Choisir ${pace(editValue)} /km`} onPress={() => { if (editing) setTarget({ ...target, [editing]: editValue }); setEditing(null); }} />
    </ScrollView></View>
  </Modal></View>;
}
