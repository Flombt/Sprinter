import { useCallback, useState, useSyncExternalStore } from 'react';
import { Pressable, View } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { PaceTarget } from '../core/types';
import { duration, estimatedDuration, km, pace, targetLabel, validateTarget } from '../core/format';
import { PacingGoalEditor } from '../pacing/GoalEditor';
import { entryState } from '../progression/aggregates';
import { dayLabel } from '../progression/dates';
import { useProgression } from '../progression/hooks';
import { progression } from '../progression/store';
import { CAN_BACKGROUND } from '../services/capabilities';
import { session } from '../services/session';
import type { SessionStructure } from '../services/useSessionSelector';
import { MusicSelection } from '../spotify/components';
import { RhythmTools, SelectedRoute, WeatherPanel, useTools } from '../tools/components';
import {
  Button,
  Copy,
  Header,
  Label,
  ListRow,
  NumericReadout,
  Panel,
  Screen,
  styles,
} from '../ui/components';
import { ChoiceGroup, Input, Picker, Toggle } from '../ui/controls';
import { PaceStepper } from '../ui/PaceStepper';
import { SettingsDisclosure } from '../ui/settings';
import { Sheet } from '../ui/Sheet';
import { useTheme } from '../ui/theme';
import { interaction, spacing } from '../ui/tokens';
import { useMapPosition } from '../ui/useMapPosition';
import { validateWorkout } from '../workouts/definition';
import { workouts } from '../workouts/store';
import { WorkoutSummary } from './Workouts';

const distances = [
  ['free', 'Libre'],
  [5000, '5 km'],
  [10000, '10 km'],
  [21097.5, 'Semi'],
  ['custom', 'Autre'],
] as const;
const paneTitles = {
  pace: 'Allure',
  distance: 'Distance',
  workout: 'Séance',
  music: 'Musique',
  shoes: 'Chaussures',
};
type Pane = keyof typeof paneTitles;

function PaceControl({
  label,
  value,
  onChange,
  onEdit,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  onEdit: () => void;
}) {
  return (
    <View style={{ gap: spacing.sm }}>
      <Label>{label}</Label>
      <PaceStepper value={value} onChange={onChange}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={label + ', ' + pace(value) + ' par kilomètre'}
          accessibilityHint="Modifier les minutes et secondes."
          onPress={onEdit}
          style={({ pressed }) => ({
            minHeight: 60,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: pressed ? interaction.pressedOpacity : 1,
          })}
        >
          <NumericReadout variant="display" value={pace(value)} />
        </Pressable>
      </PaceStepper>
    </View>
  );
}

export default function Preparation({
  state,
  initialTarget,
  onTargetChange,
  onBack,
  onStart,
  starting,
  covered,
  onMusic,
  onWorkouts,
  onTools,
}: {
  state: SessionStructure;
  initialTarget: PaceTarget;
  onTargetChange: (target: PaceTarget) => void;
  onBack: () => void;
  onStart: (target: PaceTarget) => void;
  starting: boolean;
  covered: boolean;
  onMusic: () => void;
  onWorkouts: () => void;
  onTools: () => void;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const focused = useIsFocused();
  const [footerHeight, setFooterHeight] = useState(110);
  const target = initialTarget;
  const [precise, setPrecise] = useState(target.fast === target.slow);
  const [custom, setCustom] = useState(
    !distances.some(([value]) => value === (target.distanceMeters ?? 'free')),
  );
  const [distance, setDistance] = useState(target.distanceMeters ? String(target.distanceMeters / 1000) : '');
  const [pane, setPane] = useState<Pane | null>(null);
  const [editing, setEditing] = useState<'fast' | 'slow' | null>(null);
  const [editValue, setEditValue] = useState(310);
  const close = useCallback(() => {
    setEditing(null);
    setPane(null);
  }, []);

  const library = useSyncExternalStore(workouts.subscribe, workouts.getSnapshot, workouts.getSnapshot);
  const tools = useTools();
  const referenceRoute = tools.routes.find((route) => route.id === tools.preferences.selectedRouteId);
  const progress = useProgression();
  const entryId = progress.data.selectedEntryId;
  const entry = progress.data.entries.find((item) => item.id === entryId);
  const plannedEntry =
    entry &&
    entry.kind === 'run' &&
    entry.status !== 'skipped' &&
    !['completed', 'partial', 'orphaned'].includes(entryState(entry, state.history, progress.data).state)
      ? entry
      : null;
  const selected = plannedEntry ? plannedEntry.workout : library.preferences.selected;
  const shoes = progress.data.shoes.filter((shoe) => !shoe.archived);
  const shoe = shoes.find((item) => item.id === progress.data.defaultShoeId);
  const error =
    entryId && !plannedEntry
      ? 'La date sélectionnée est indisponible ou déjà associée. Retirez ce choix de calendrier.'
      : selected
        ? (validateWorkout(selected)[0] ?? null)
        : validateTarget(target, state.settings.config.maximumSpeed);
  const estimate = estimatedDuration(target);
  const preview = useMapPosition(focused && !covered && !state.runId && !state.busy && !starting);
  const gpsLabel =
    preview.status === 'locating'
      ? 'Localisation en cours'
      : preview.status === 'denied'
        ? 'Localisation à autoriser'
        : preview.status === 'unavailable'
          ? 'Position GPS indisponible'
          : preview.status === 'cached'
            ? 'Dernière position connue'
            : preview.position
              ? 'Position GPS disponible'
              : 'GPS en attente';

  const setTarget = onTargetChange;
  const openEditor = (key: 'fast' | 'slow') => {
    setEditValue(target[key]);
    setEditing(key);
  };
  const chooseWorkout = () => {
    if (!entryId) {
      close();
      onWorkouts();
      return;
    }
    void progression.selectEntry(null).then((ok) => {
      if (!ok) return;
      close();
      onWorkouts();
    });
  };
  const clearWorkout = async () => {
    if (!entryId || (await progression.selectEntry(null))) await workouts.select(null);
  };
  const heading = editing ? 'Ajuster l’allure' : pane ? paneTitles[pane] : '';

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View
        style={{ flex: 1 }}
        pointerEvents={pane ? 'none' : 'auto'}
        aria-hidden={pane !== null}
        accessibilityElementsHidden={pane !== null}
        importantForAccessibility={pane ? 'no-hide-descendants' : 'auto'}
      >
        <Screen bottom={Math.max(spacing.xxl, footerHeight - insets.bottom + spacing.lg)}>
          <Header title="Prêt à partir" onBack={onBack} />
          {!state.runId && (
            <View style={{ gap: spacing.sm }}>
              <Copy variant="caption" muted accessibilityLiveRegion="polite">
                {gpsLabel}
              </Copy>
              {preview.status !== 'ready' && (
                <Button
                  title="Actualiser la position"
                  icon="locate-outline"
                  variant="quiet"
                  disabled={preview.status === 'locating' || starting}
                  onPress={() => void preview.locate(true)}
                />
              )}
            </View>
          )}
          <View style={[styles.row, { flexWrap: 'wrap', gap: spacing.sm }]}>
            <Button
              title="Allure"
              icon="speedometer-outline"
              variant="secondary"
              onPress={() => setPane('pace')}
            />
            <Button
              title="Distance"
              icon="flag-outline"
              variant="secondary"
              onPress={() => setPane('distance')}
            />
            <Button
              title="Séance"
              icon="fitness-outline"
              variant="secondary"
              onPress={() => setPane('workout')}
            />
            <Button
              title="Musique"
              icon="musical-notes-outline"
              variant="secondary"
              onPress={() => setPane('music')}
            />
          </View>
          <Copy muted variant="caption">
            {selected?.name ?? targetLabel(target) + ' /km'}
            {target.distanceMeters !== null && !selected ? ' · ' + km(target.distanceMeters, 1) + ' km' : ''}
          </Copy>
          {error && (
            <Copy accessibilityRole="alert" style={{ color: colors.danger }}>
              {error}
            </Copy>
          )}
          <SettingsDisclosure title="Plus d’options" icon="options-outline">
            {progress.ready && (
              <ListRow
                title="Chaussures"
                icon="footsteps-outline"
                subtitle={
                  <Copy muted variant="caption">
                    {shoe?.name ?? 'Non attribuées'}
                  </Copy>
                }
                onPress={() => setPane('shoes')}
              />
            )}
            {progress.message && (
              <Copy muted variant="caption">
                {progress.message}
              </Copy>
            )}
            <SelectedRoute onChoose={onTools} running={!!state.runId} />
            <RhythmTools compact />
            <WeatherPanel route={referenceRoute} />
            <Toggle
              title="Signaux audio"
              body="Deux sons pour reconnaître l’écart."
              value={state.settings.audioEnabled}
              onChange={(audioEnabled) => void session.updateSettings({ audioEnabled })}
            />
            <Toggle
              title="Pause automatique aux arrêts"
              body="Le GPS reste actif pour détecter la reprise."
              value={state.settings.autoPauseEnabled === true}
              disabled={!!state.runId}
              onChange={(autoPauseEnabled) => void session.updateSettings({ autoPauseEnabled })}
            />
            <Copy muted variant="caption">
              {CAN_BACKGROUND && state.settings.backgroundEnabled
                ? 'Suivi écran verrouillé activé. Les alertes en arrière-plan utilisent les signaux audio.'
                : 'Gardez Sprinter à l’écran pendant la course. Le suivi écran verrouillé exige une version installée.'}
            </Copy>
          </SettingsDisclosure>
          <Copy muted variant="small">
            {selected
              ? 'Une fin de séance ou un défi perdu ne termine pas votre course.'
              : 'Les alertes respectent le lissage, la confirmation et l’espacement configurés.'}
          </Copy>
        </Screen>
        <View
          onLayout={(event) => setFooterHeight(event.nativeEvent.layout.height)}
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: colors.background,
            padding: spacing.lg,
            paddingBottom: Math.max(spacing.lg, insets.bottom),
            borderTopWidth: 1,
            borderTopColor: colors.line,
          }}
        >
          <Button
            title={
              state.busy
                ? 'Préparation du GPS…'
                : starting
                  ? 'Départ en cours…'
                  : state.runId
                    ? 'Retrouver ma course'
                    : 'Démarrer ma course'
            }
            icon="arrow-forward"
            onPress={() => onStart(target)}
            disabled={(!state.runId && !!error) || state.busy || starting}
          />
        </View>
      </View>
      {pane && (
        <Sheet title={heading} onClose={close}>
          {pane === 'pace' &&
            (selected ? (
              <Copy>La séance choisie définit les allures de cette sortie.</Copy>
            ) : editing ? (
              <>
                <Label>Minutes par kilomètre</Label>
                <Picker
                  accessibilityLabel="Minutes par kilomètre"
                  selectedValue={Math.floor(editValue / 60)}
                  onValueChange={(minutes) =>
                    setEditValue(Math.min(1200, Number(minutes) * 60 + (editValue % 60)))
                  }
                >
                  {Array.from({ length: 19 }, (_, index) => (
                    <Picker.Item key={index} label={String(index + 2)} value={index + 2} />
                  ))}
                </Picker>
                <Label>Secondes par kilomètre</Label>
                <Picker
                  accessibilityLabel="Secondes par kilomètre"
                  selectedValue={editValue % 60}
                  onValueChange={(seconds) =>
                    setEditValue(Math.min(1200, Math.floor(editValue / 60) * 60 + Number(seconds)))
                  }
                >
                  {Array.from({ length: 60 }, (_, index) => (
                    <Picker.Item key={index} label={String(index).padStart(2, '0')} value={index} />
                  ))}
                </Picker>
                <Button
                  title={'Choisir ' + pace(editValue) + ' /km'}
                  onPress={() => {
                    setTarget(
                      precise
                        ? { ...target, fast: editValue, slow: editValue }
                        : { ...target, [editing]: editValue },
                    );
                    setEditing(null);
                  }}
                />
                <Button title="Revenir aux allures" variant="quiet" onPress={() => setEditing(null)} />
              </>
            ) : (
              <>
                <PacingGoalEditor target={target} onChange={setTarget} onPaceModeChange={setPrecise} />
                {precise && target.finishSeconds == null && target.kilometerTargets === undefined && (
                  <Panel>
                    <PaceControl
                      label="Allure exacte"
                      value={target.fast}
                      onEdit={() => openEditor('fast')}
                      onChange={(value) => setTarget({ ...target, fast: value, slow: value })}
                    />
                  </Panel>
                )}
                {!precise && target.finishSeconds == null && target.kilometerTargets === undefined && (
                  <Panel>
                    <PaceControl
                      label="Allure la plus rapide"
                      value={target.fast}
                      onEdit={() => openEditor('fast')}
                      onChange={(fast) => setTarget({ ...target, fast })}
                    />
                    <PaceControl
                      label="Allure la plus lente"
                      value={target.slow}
                      onEdit={() => openEditor('slow')}
                      onChange={(slow) => setTarget({ ...target, slow })}
                    />
                  </Panel>
                )}
              </>
            ))}
          {pane === 'distance' &&
            (selected ? (
              <Copy>La séance choisie définit ses propres objectifs de distance.</Copy>
            ) : (
              <>
                <ChoiceGroup<string | number>
                  label="Distance de la course"
                  value={custom ? 'custom' : (target.distanceMeters ?? 'free')}
                  choices={distances}
                  onChange={(value) => {
                    setCustom(value === 'custom');
                    const meters =
                      value === 'custom'
                        ? Number(distance.replace(',', '.')) * 1000
                        : value === 'free'
                          ? null
                          : Number(value);
                    setTarget({ ...target, distanceMeters: meters });
                  }}
                />
                {custom && (
                  <Input
                    accessibilityLabel="Distance personnalisée en kilomètres"
                    placeholder="Distance en kilomètres"
                    keyboardType="decimal-pad"
                    value={distance}
                    onChangeText={(value) => {
                      setDistance(value);
                      setTarget({ ...target, distanceMeters: Number(value.replace(',', '.')) * 1000 });
                    }}
                  />
                )}
                {estimate && !error && (
                  <Copy variant="caption">
                    Temps prévu · {duration(estimate[0])} – {duration(estimate[1])}
                    {target.finishSeconds != null &&
                      ' · Objectif ' +
                        duration(target.finishSeconds) +
                        (target.timeBasis === 'total' ? ' en temps total' : ' en temps actif')}
                  </Copy>
                )}
              </>
            ))}
          {pane === 'workout' && (
            <>
              <Copy variant="section">{selected?.name ?? 'Course libre'}</Copy>
              {plannedEntry && (
                <Copy variant="caption" muted>
                  Calendrier · {plannedEntry.title}, prévu le {dayLabel(plannedEntry.day)}
                </Copy>
              )}
              {entryId && (
                <Button
                  title="Retirer le choix du calendrier"
                  variant="secondary"
                  disabled={progress.busy}
                  onPress={() => void progression.selectEntry(null)}
                />
              )}
              {selected && <WorkoutSummary definition={selected} />}
              <Button
                title={selected ? 'Changer de séance' : 'Choisir une séance ou un défi'}
                onPress={chooseWorkout}
              />
              {selected && (
                <Button
                  title="Courir sans séance"
                  variant="secondary"
                  disabled={library.busy || progress.busy}
                  onPress={() => void clearWorkout()}
                />
              )}
            </>
          )}
          {pane === 'music' && (
            <MusicSelection
              onChoose={() => {
                close();
                onMusic();
              }}
            />
          )}
          {pane === 'shoes' && (
            <>
              <ChoiceGroup
                label="Chaussures de cette sortie"
                value={shoe?.id ?? ''}
                choices={[['', 'Non attribuées'], ...shoes.map((item) => [item.id, item.name] as const)]}
                disabled={progress.busy || !!state.runId}
                onChange={(id) => void progression.selectShoe(id || null)}
              />
              <Copy muted variant="caption">
                Choix mémorisé pour les prochains départs. Modifiez une ancienne attribution dans son journal.
              </Copy>
            </>
          )}
        </Sheet>
      )}
    </View>
  );
}
