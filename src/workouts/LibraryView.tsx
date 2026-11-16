import { useMemo } from 'react';
import { View } from 'react-native';
import type { RunRecord } from '../core/types';
import { duration, km, runDate } from '../core/format';
import type { SessionStructure } from '../services/useSessionSelector';
import { Button, Copy, Header, Label, ListRow, Panel, Screen, SectionHeading } from '../ui/components';
import { ChoiceGroup, Toggle } from '../ui/controls';
import { DetailRow, PhotoCover, editorialMedia } from '../ui/editorial';
import { useTheme } from '../ui/theme';
import { spacing } from '../ui/tokens';
import { confirm } from '../ui/confirm';
import { newWorkout } from './definition';
import { savedFavoriteKey, templateFavoriteKey } from './favorites';
import { WorkoutCard } from './LibraryCards';
import { CHALLENGE_KINDS, TRAINING_KINDS, workoutPresentation } from './presentation';
import { workouts } from './store';
import { createTemplate, TEMPLATE_INFO } from './templates';
import { CHALLENGE_STATUS, WORKOUT_STATUS, type WorkoutDefinition, type WorkoutKind } from './types';

export type WorkoutLibraryFilter =
  'all' | 'models' | 'endurance' | 'intervals' | 'tempo' | 'saved' | 'challenges' | 'favorites';
type TemplateInfo = (typeof TEMPLATE_INFO)[number];
type FavoriteEntry =
  | { key: string; type: 'template'; template: TemplateInfo }
  | { key: string; type: 'saved'; definition: WorkoutDefinition };
interface LibraryProps {
  library: ReturnType<typeof workouts.getSnapshot>;
  running: SessionStructure;
  error: string | null;
  filter: WorkoutLibraryFilter;
  shown: number;
  onBrowse: (filter: WorkoutLibraryFilter) => void;
  onShowMore: () => void;
  onClose?: () => void;
  onSelected: () => void;
  canPrepare: boolean;
  onDetail?: (run: RunRecord) => void;
  onEdit: (definition: WorkoutDefinition) => void;
  onTemplate: (kind: TemplateInfo['kind']) => void;
  onRecords: () => void;
}
export const WORKOUT_LIBRARY_PAGE_SIZE = 20;
const challengeKinds = new Set<WorkoutKind>(CHALLENGE_KINDS);
const trainingFilters = {
  endurance: ['endurance'],
  intervals: ['intervals', 'intervals1000', 'pyramid'],
  tempo: ['progressive', 'finalSprint'],
} satisfies Record<string, WorkoutKind[]>;
const trainingLabels = { endurance: 'Endurance', intervals: 'Fractionné', tempo: 'Tempo' };

export function WorkoutLibraryView({
  library,
  running,
  error,
  filter,
  shown,
  onBrowse: browse,
  onShowMore,
  onClose,
  onSelected,
  canPrepare,
  onDetail,
  onEdit,
  onTemplate,
  onRecords,
}: LibraryProps) {
  const { colors } = useTheme();
  const disabled = !library.ready || library.busy;
  const favoriteKeys = useMemo(
    () => new Set(library.preferences.favoriteKeys ?? []),
    [library.preferences.favoriteKeys],
  );
  // Preview IDs are never saved. Opening a model creates a fresh editable definition in the parent.
  const previews = useMemo(
    () =>
      new Map<WorkoutKind, WorkoutDefinition>(
        TEMPLATE_INFO.flatMap((info) =>
          info.kind === 'ghost' || info.kind === 'personalBest'
            ? []
            : [[info.kind, createTemplate(info.kind)] as const],
        ),
      ),
    [],
  );
  const templates = TRAINING_KINDS.map((kind) => TEMPLATE_INFO.find((info) => info.kind === kind)!);
  const challenges = CHALLENGE_KINDS.map((kind) => TEMPLATE_INFO.find((info) => info.kind === kind)!);
  const favorites = useMemo(
    () =>
      (library.preferences.favoriteKeys ?? []).flatMap<FavoriteEntry>((key) => {
        const template = TEMPLATE_INFO.find((info) => templateFavoriteKey(info.kind) === key);
        if (template) return [{ key, type: 'template', template }];
        const definition = library.definitions.find((item) => savedFavoriteKey(item.id) === key);
        return definition ? [{ key, type: 'saved', definition }] : [];
      }),
    [library.preferences.favoriteKeys, library.definitions],
  );
  const recent = useMemo(() => {
    const seen = new Set<string>(),
      result: { run: RunRecord; definition: WorkoutDefinition }[] = [];
    const now = Date.now();
    for (const run of [...running.history].sort((a, b) => b.startedAt - a.startedAt)) {
      if (
        !run.workout ||
        run.endedAt === null ||
        !Number.isFinite(run.endedAt) ||
        run.endedAt > now ||
        !run.workout.segments.some((segment) => segment.startedAt !== null) ||
        seen.has(run.workout.definition.id)
      )
        continue;
      seen.add(run.workout.definition.id);
      result.push({ run, definition: run.workout.definition });
      if (result.length === 3) break;
    }
    return result;
  }, [running.history]);
  const selectedDefinition = library.preferences.selected;
  const ownChallenges = useMemo(
    () => library.definitions.filter((definition) => definition.challenge.kind !== 'none'),
    [library.definitions],
  );
  const selectedInfo = useMemo(() => {
    try {
      return selectedDefinition ? workoutPresentation(selectedDefinition) : null;
    } catch {
      return null;
    }
  }, [selectedDefinition]);
  const choose = (definition: WorkoutDefinition) => {
    void workouts.select(definition).then((ok) => {
      if (ok) onSelected();
    });
  };

  const templateCard = (template: TemplateInfo, prefix = '') => {
    const key = templateFavoriteKey(template.kind);
    return (
      <WorkoutCard
        key={`${prefix}${key}`}
        title={template.name}
        description={template.description}
        kind={template.kind}
        definition={previews.get(template.kind)}
        origin={challengeKinds.has(template.kind) ? 'Défi' : 'Modèle'}
        disabled={disabled}
        favorite={favoriteKeys.has(key)}
        onFavorite={() => void workouts.toggleFavorite(key)}
        action={{
          title:
            template.kind === 'ghost'
              ? 'Choisir une course de référence'
              : template.kind === 'personalBest'
                ? 'Choisir un record fiable'
                : 'Personnaliser ce modèle',
          onPress: () => onTemplate(template.kind),
        }}
      />
    );
  };
  const savedCard = (definition: WorkoutDefinition, prefix = '') => {
    const key = savedFavoriteKey(definition.id);
    return (
      <WorkoutCard
        key={`${prefix}${key}`}
        title={definition.name}
        description={definition.description}
        definition={definition}
        kind={definition.kind}
        origin="Ma séance"
        disabled={disabled}
        selected={
          selectedDefinition?.id === definition.id && selectedDefinition.updatedAt === definition.updatedAt
        }
        favorite={favoriteKeys.has(key)}
        onFavorite={() => void workouts.toggleFavorite(key)}
        action={{
          title: running.runId ? 'Choisir pour la prochaine course' : 'Choisir cette séance',
          onPress: () => choose(definition),
        }}
        management={{
          edit: () => onEdit(definition),
          duplicate: () => {
            void workouts.duplicate(definition);
          },
          remove: () =>
            confirm(
              'Supprimer cette séance ?',
              'Les sorties déjà enregistrées conserveront leurs blocs et leurs résultats.',
              'Supprimer',
              () => {
                void workouts.remove(definition.id);
              },
              true,
            ),
        }}
      />
    );
  };
  const showAll = filter === 'all';
  const intervals = previews.get('intervals');
  const recovery = intervals?.blocks
    .find((block) => block.kind === 'repeat')
    ?.blocks.find((block) => block.kind === 'segment' && block.effort === 'recovery');
  const featured = (showAll || filter === 'intervals') && !disabled ? intervals : undefined;
  const trainingFilter =
    filter === 'endurance' || filter === 'intervals' || filter === 'tempo' ? filter : undefined;
  const topics = trainingFilter ? new Set<WorkoutKind>(trainingFilters[trainingFilter]) : undefined;
  return (
    <Screen bottom={onClose ? 45 : spacing.xxl} gap={spacing.xl}>
      <Header editorial title="Séances" onBack={onClose} />
      <ChoiceGroup<WorkoutLibraryFilter>
        pills
        label="Types de séance"
        value={filter}
        choices={[
          ['all', 'Tout'],
          ['endurance', 'Endurance'],
          ['intervals', 'Fractionné'],
          ['tempo', 'Tempo'],
          ['challenges', 'Défis'],
        ]}
        onChange={browse}
      />
      {featured && (
        <PhotoCover
          height={204}
          title={workoutPresentation(featured).structure}
          eyebrow="Fractionné"
          detail={
            recovery?.kind === 'segment' && recovery.end.kind === 'duration'
              ? `${recovery.end.value} s de récupération`
              : undefined
          }
          position={{ left: '50%', top: '70%' }}
          source={editorialMedia.workout}
          onPress={() => onTemplate('intervals')}
        />
      )}
      {(library.message || error) && (
        <Panel style={{ gap: spacing.md }}>
          <Copy accessibilityRole="alert" style={{ color: colors.danger }}>
            {library.message ?? error}
          </Copy>
          {!library.ready && (
            <Button
              title="Réessayer la bibliothèque"
              variant="secondary"
              onPress={() => void workouts.initialize()}
            />
          )}
        </Panel>
      )}
      {library.unreadable > 0 && (
        <Copy variant="caption" muted>
          {library.unreadable}{' '}
          {library.unreadable === 1
            ? 'élément de bibliothèque indisponible, conservé'
            : 'éléments de bibliothèque indisponibles, conservés'}{' '}
          localement.
        </Copy>
      )}
      {selectedDefinition && (
        <Panel variant="list" style={{ gap: spacing.md }}>
          <Label>Pour la prochaine sortie</Label>
          <Copy variant="section">{selectedDefinition.name}</Copy>
          {selectedInfo && (
            <Copy variant="caption" muted>
              {selectedInfo.volume} · {selectedInfo.structure}
            </Copy>
          )}
          {canPrepare && (
            <Button
              title={running.runId ? 'Choix conservé pour la prochaine course' : 'Préparer cette séance'}
              disabled={!!running.runId}
              onPress={onSelected}
            />
          )}
          <Button
            title="Revenir à la course libre"
            variant="quiet"
            disabled={disabled}
            onPress={() => void workouts.select(null)}
          />
        </Panel>
      )}
      {(showAll || filter === 'models' || topics) && (
        <View style={{ gap: spacing.md }}>
          <SectionHeading
            editorial
            title={
              trainingFilter ? trainingLabels[trainingFilter] : showAll ? 'Bibliothèque' : 'Tous les modèles'
            }
          />
          {showAll ? (
            <View>
              {templates
                .filter((template) => !featured || template.kind !== 'intervals')
                .slice(0, 4)
                .map((template) => (
                  <DetailRow
                    key={template.kind}
                    title={template.name}
                    detail={template.description}
                    icon="stopwatch-outline"
                    disabled={disabled}
                    onPress={() => onTemplate(template.kind)}
                  />
                ))}
              <DetailRow
                title="Tous les modèles"
                detail={`${templates.length} séances personnalisables`}
                icon="albums-outline"
                onPress={() => browse('models')}
              />
              <DetailRow
                title="Mes séances"
                detail="Séances personnalisées"
                icon="list-outline"
                onPress={() => browse('saved')}
              />
              <DetailRow
                title="Favoris"
                detail="Modèles et séances enregistrés"
                icon="star-outline"
                onPress={() => browse('favorites')}
                rule={false}
              />
            </View>
          ) : (
            templates
              .filter(
                (template) =>
                  (!topics || topics.has(template.kind)) && (!featured || template.kind !== 'intervals'),
              )
              .map((template) => templateCard(template))
          )}
        </View>
      )}
      {(showAll || filter === 'saved') && (
        <DetailRow
          title="Créer ma séance"
          detail="Distances, allures, répétitions et récupérations"
          icon="add"
          disabled={disabled}
          onPress={() => onEdit(newWorkout())}
        />
      )}

      {(filter === 'favorites' || (showAll && favorites.length > 0)) && (
        <View style={{ gap: spacing.md }}>
          <SectionHeading title={`Favoris · ${favorites.length}`} />
          {!favorites.length && (
            <Panel variant="list">
              <Copy variant="caption" muted>
                Touchez l’étoile d’un modèle ou d’une séance enregistrée pour le retrouver ici.
              </Copy>
            </Panel>
          )}
          {favorites
            .slice(0, showAll ? 3 : shown)
            .map((item) =>
              item.type === 'template'
                ? templateCard(item.template, 'favorite:')
                : savedCard(item.definition, 'favorite:'),
            )}
          {showAll && favorites.length > 3 && (
            <Button title="Voir tous mes favoris" variant="quiet" onPress={() => browse('favorites')} />
          )}
          {filter === 'favorites' && favorites.length > shown && (
            <Button title="Afficher plus de favoris" variant="secondary" onPress={onShowMore} />
          )}
        </View>
      )}

      {showAll && (
        <View style={{ gap: spacing.md }}>
          <SectionHeading title="Dernières séances" />
          {!recent.length && (
            <Copy variant="caption" muted>
              Vos séances réalisées apparaîtront ici après l’enregistrement d’une course.
            </Copy>
          )}
          {recent.map(({ run, definition }) => (
            <WorkoutCard
              key={run.id}
              title={definition.name}
              definition={definition}
              kind={definition.kind}
              origin="Dernière séance"
              disabled={disabled}
              note={`${runDate(run.startedAt)} · ${WORKOUT_STATUS[run.workout!.status]} · ${CHALLENGE_STATUS[run.workout!.challengeStatus]}\nCourse : ${km(run.distanceMeters)} km · ${duration(run.activeSeconds)} actifs`}
              action={{ title: 'Refaire cette séance', onPress: () => choose(definition) }}
              onDetail={onDetail ? () => onDetail(run) : undefined}
            />
          ))}
        </View>
      )}

      {(showAll || filter === 'challenges') && (
        <View style={{ gap: spacing.md }}>
          <SectionHeading title="Défis" />
          <Copy variant="caption" muted>
            Un objectif et des conditions de réussite. Le GPS continue même si le défi est perdu.
          </Copy>
          {(showAll ? challenges.slice(0, 3) : challenges).map((template) => templateCard(template))}
          {showAll && (
            <Button
              title={`Explorer les ${challenges.length} défis`}
              variant="quiet"
              onPress={() => browse('challenges')}
            />
          )}
        </View>
      )}

      {filter === 'challenges' && ownChallenges.length > 0 && (
        <View style={{ gap: spacing.md }}>
          <SectionHeading title="Mes défis enregistrés" />
          {ownChallenges.slice(0, shown).map((definition) => savedCard(definition, 'challenge:'))}
          {ownChallenges.length > shown && (
            <Button title="Afficher plus de défis enregistrés" variant="secondary" onPress={onShowMore} />
          )}
        </View>
      )}

      {(showAll || filter === 'saved') && (
        <View style={{ gap: spacing.md }}>
          <SectionHeading title={`Mes séances · ${library.definitions.length}`} />
          {!library.definitions.length && (
            <Panel variant="list">
              <Copy variant="caption" muted>
                Enregistrez votre création ou un modèle personnalisé pour le retrouver ici. Le menu « … »
                permet ensuite de modifier, dupliquer ou supprimer une séance.
              </Copy>
            </Panel>
          )}
          {library.definitions.slice(0, showAll ? 3 : shown).map((definition) => savedCard(definition))}
          {showAll && library.definitions.length > 3 && (
            <Button title="Ouvrir toutes mes séances" variant="quiet" onPress={() => browse('saved')} />
          )}
          {filter === 'saved' && library.definitions.length > shown && (
            <Button title="Afficher plus de séances" variant="secondary" onPress={onShowMore} />
          )}
        </View>
      )}

      <ListRow
        icon="trophy-outline"
        title="Records de séances"
        onPress={onRecords}
        subtitle={
          <Copy variant="caption" muted>
            Vos résultats sur des séances identiques et validées.
          </Copy>
        }
      />
      <Panel variant="setting" style={{ gap: spacing.md }}>
        <Toggle
          title="Annonces vocales du coach"
          disabled={disabled}
          value={library.preferences.voiceEnabled}
          onChange={(enabled) => void workouts.setVoice(enabled)}
        />
        <Copy variant="caption" muted>
          Les annonces nécessitent les signaux audio activés et Sprinter à l’écran. Sur iPhone, désactivez le
          mode silencieux pour la voix. Les vibrations dépendent des réglages et de l’appareil.
        </Copy>
      </Panel>
    </Screen>
  );
}
