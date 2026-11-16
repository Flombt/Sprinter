import { useCallback, useState, useSyncExternalStore } from 'react';
import { Pressable, View } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import type { PaceTarget } from '../core/types';
import { duration, estimatedDuration, km, pace, targetLabel, validateTarget } from '../core/format';
import { preparationTarget, type DiscoveryPreparation } from '../discovery/trainingLink';
import { PacingGoalEditor } from '../pacing/GoalEditor';
import { entryState } from '../progression/aggregates';
import { dayLabel } from '../progression/dates';
import { useProgression } from '../progression/hooks';
import { progression } from '../progression/store';
import { CAN_BACKGROUND } from '../services/capabilities';
import { session } from '../services/session';
import type { SessionStructure } from '../services/useSessionSelector';
import { MusicSelection, useMusic } from '../spotify/components';
import { selectedPlaylist } from '../spotify/store';
import { playlistTitle } from '../spotify/presentation';
import { RhythmTools, SelectedRoute, WeatherPanel, useTools } from '../tools/components';
import { Button, Copy, Header, Label, NumericReadout, Panel, Screen } from '../ui/components';
import { ChoiceGroup, Input, Picker, Toggle } from '../ui/controls';
import { PaceStepper } from '../ui/PaceStepper';
import { DetailRow, paceReadout } from '../ui/editorial';
import { Sheet } from '../ui/Sheet';
import { useTheme } from '../ui/theme';
import { editorial, interaction, radii, spacing } from '../ui/tokens';
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
  route: 'Parcours',
  advanced: 'Réglages avancés',
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
  discovery,
  initialTarget,
  onTargetChange,
  onBack,
  onStart,
  starting,
  covered,
  onMusic,
  onWorkouts,
  onTools,
  onMap,
  onSettings,
}: {
  state: SessionStructure;
  discovery?: DiscoveryPreparation;
  initialTarget: PaceTarget;
  onTargetChange: (target: PaceTarget) => void;
  onBack: () => void;
  onStart: (target: PaceTarget) => void;
  starting: boolean;
  covered: boolean;
  onMusic: () => void;
  onWorkouts: () => void;
  onTools: () => void;
  onMap: () => void;
  onSettings: () => void;
}) {
  const { colors } = useTheme();
  const focused = useIsFocused();
  const [draft, setDraft] = useState(() =>
    discovery ? preparationTarget(initialTarget, discovery) : undefined,
  );
  const target = draft ?? initialTarget;
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
  const playlist = selectedPlaylist(useMusic());
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

  const setTarget = discovery ? setDraft : onTargetChange;
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
        <Screen
          gap={spacing.md}
          footer={
            <>
              {preview.status === 'denied' && (
                <Copy variant="caption" muted>
                  Autorisation GPS requise.
                </Copy>
              )}
              <Button
                title={
                  state.busy
                    ? 'Préparation du GPS…'
                    : starting
                      ? 'Départ en cours…'
                      : state.runId
                        ? 'Retrouver ma course'
                        : 'Démarrer'
                }
                endIcon="play"
                onPress={() => onStart(target)}
                disabled={(!state.runId && !!error) || state.busy || starting}
              />
            </>
          }
        >
          <Header title="Préparer" onBack={onBack} editorial />
          {discovery && (
            <Panel variant="setting" style={{ backgroundColor: colors.accentSoft }}>
              <Label>Objectif Découvrir</Label>
              <Copy variant="emphasis">{discovery.name}</Copy>
            </Panel>
          )}
          <View
            style={{
              backgroundColor: editorial.surface,
              borderRadius: radii.card,
              padding: spacing.lg,
              minHeight: 142,
              flexDirection: 'row',
              flexWrap: 'wrap',
              alignItems: 'flex-end',
              justifyContent: 'space-between',
              gap: spacing.md,
            }}
          >
            <View style={{ flexShrink: 1, minWidth: 0, gap: spacing.xs }}>
              <Label style={{ color: editorial.secondary }}>
                {selected ? 'Allures de la séance' : 'Allure cible'}
              </Label>
              <Copy variant={selected ? 'heading' : 'editorialNumber'} style={{ color: editorial.ink }}>
                {selected?.name ?? paceReadout(targetLabel(target))}
                {!selected && (
                  <Copy variant="body" style={{ color: editorial.ink }}>
                    {' '}
                    /km
                  </Copy>
                )}
              </Copy>
              {!selected && (
                <Copy variant="caption" style={{ color: editorial.secondary }}>
                  {target.finishSeconds != null
                    ? 'Objectif de temps'
                    : target.kilometerTargets
                      ? 'Allure par kilomètre'
                      : precise
                        ? 'Allure précise'
                        : 'Plage d’allure'}
                </Copy>
              )}
            </View>
            <Button
              title="Modifier"
              style={{ alignSelf: 'flex-start' }}
              onDark
              size="compact"
              secondary
              onPress={() => setPane(selected ? 'workout' : 'pace')}
            />
          </View>
          <View>
            <DetailRow
              title="Distance"
              detail={
                selected
                  ? 'Définie par la séance'
                  : target.distanceMeters === null
                    ? 'Libre'
                    : km(target.distanceMeters, 2).replace(/,00$/, '') + ' km'
              }
              icon="flag-outline"
              onPress={() => setPane('distance')}
            />
            <DetailRow
              title="Séance"
              detail={selected?.name ?? 'Course libre'}
              icon="layers-outline"
              onPress={() => setPane('workout')}
            />
            <DetailRow
              title="Musique"
              detail={playlist ? playlistTitle(playlist) : 'Aucune playlist'}
              icon="musical-notes-outline"
              onPress={() => setPane('music')}
            />
            <DetailRow
              title="Parcours"
              detail={referenceRoute?.name ?? 'Sans itinéraire'}
              icon="map-outline"
              onPress={() => setPane('route')}
              rule={false}
            />
          </View>
          <View
            style={{
              borderWidth: 1,
              borderColor: colors.line,
              borderRadius: radii.control,
              paddingHorizontal: spacing.sm,
            }}
          >
            <DetailRow
              title="Réglages avancés"
              detail={shoe ? 'Coach, GPS · ' + shoe.name : 'Coach, chaussures et GPS'}
              icon="options-outline"
              onPress={() => setPane('advanced')}
              rule={false}
            />
          </View>
          {error && (
            <Copy accessibilityRole="alert" style={{ color: colors.danger }}>
              {error}
            </Copy>
          )}
        </Screen>
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
          {pane === 'route' && (
            <>
              <SelectedRoute
                onChoose={() => {
                  close();
                  onTools();
                }}
                running={!!state.runId}
              />
              <DetailRow
                title="Voir la carte"
                detail={gpsLabel}
                icon="map-outline"
                onPress={() => {
                  close();
                  onMap();
                }}
                rule={false}
              />
            </>
          )}
          {pane === 'advanced' && (
            <>
              {progress.ready && (
                <DetailRow
                  title="Chaussures"
                  detail={shoe?.name ?? 'Non attribuées'}
                  icon="footsteps-outline"
                  onPress={() => setPane('shoes')}
                />
              )}
              {progress.message && (
                <Copy muted variant="caption">
                  {progress.message}
                </Copy>
              )}
              <DetailRow
                title="Réglages du coach"
                icon="options-outline"
                onPress={() => {
                  close();
                  onSettings();
                }}
              />
              <View style={{ gap: spacing.xs }}>
                <Copy variant="caption" muted accessibilityLiveRegion="polite">
                  {gpsLabel}
                </Copy>
                <Button
                  title="Actualiser la position"
                  icon="locate-outline"
                  variant="quiet"
                  disabled={preview.status === 'locating' || starting || !!state.runId}
                  onPress={() => void preview.locate(true)}
                />
              </View>
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
            </>
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
