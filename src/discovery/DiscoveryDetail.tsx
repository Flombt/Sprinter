import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { isDatedKind, parisDay, type DiscoveryItem } from '../../supabase/functions/_shared/discovery-model';
import { Button, Copy, EmptyState, Header, IconButton, Label, Panel, Screen } from '../ui/components';
import { useTheme } from '../ui/theme';
import { radii, spacing } from '../ui/tokens';
import RouteMap from '../ui/RouteMap';
import { confirm } from '../ui/confirm';
import { shareDocument } from '../services/documentShare';
import { session } from '../services/session';
import { geometryGPX } from '../sharing/documents';
import { createRoute } from '../routes/gpx';
import { routeLength } from '../routes/geometry';
import { toolsStore } from '../tools/store';
import { calendarDays } from '../progression/dates';
import { TEMPLATE_INFO } from '../workouts/templates';
import { useDiscovery } from './DiscoveryProvider';
import { MapOverview } from './DiscoveryMap';
import {
  checkedRecently,
  dayLabel,
  kindTitle,
  kmLabel,
  remaining,
  scheduleLabel,
  terrainTitle,
  verifiedPrice,
  verifiedRegistration,
} from './catalog';
import {
  Chip,
  ChipRow,
  DiscoveryArt,
  DiscoverySection,
  photoFor,
  ResultRow,
  statusLabel,
} from './components';
import { calendarDocument } from './calendarExport';
import { directions, openOfficial, shareDiscovery } from './actions';
import type { DiscoveryPreparation, DiscoveryWorkoutSuggestion } from './trainingLink';

const currency = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });

export function DiscoveryDetail({
  id,
  onBack,
  onOpen,
  onPrepare,
  onWorkout,
}: {
  id: string;
  onBack: () => void;
  onOpen: (id: string) => void;
  onPrepare: (selection: DiscoveryPreparation, plan: boolean) => void;
  onWorkout: (suggestion: DiscoveryWorkoutSuggestion, selection: DiscoveryPreparation) => void;
}) {
  const discovery = useDiscovery();
  const saved = discovery.prefs.saves.find((save) => save.item.id === id);
  const current = discovery.items.find((item) => item.id === id);
  const item = current ?? saved?.item;
  const removed = discovery.entries.get(id) === null;
  const { colors } = useTheme();
  const [distance, setDistance] = useState(saved?.goal?.distanceKm ?? item?.distancesKm?.[0]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>();
  const actionInProgress = useRef(false);
  const act = async (action: () => Promise<void | string | undefined>) => {
    if (actionInProgress.current) return;
    actionInProgress.current = true;
    setBusy(true);
    setMessage(undefined);
    try {
      const result = await action();
      if (result) setMessage(result);
    } catch {
      setMessage('Impossible d’effectuer cette action. Réessaie ou ouvre la source officielle.');
    } finally {
      actionInProgress.current = false;
      setBusy(false);
    }
  };

  if (!item || removed)
    return (
      <Screen>
        <Header title={item?.title ?? 'Fiche indisponible'} onBack={onBack} />
        <EmptyState
          icon="information-circle-outline"
          title="Cette fiche est indisponible"
          body={
            removed
              ? 'Cette fiche a été retirée du catalogue local.'
              : 'Reviens dans Découvrir et actualise le catalogue.'
          }
        />
        {item && saved?.favorite && (
          <Button title="Retirer des favoris" secondary onPress={() => void discovery.toggleFavorite(item)} />
        )}
        {item && saved?.goal && (
          <Button title="Retirer de mes objectifs" secondary onPress={() => void discovery.setGoal(item)} />
        )}
      </Screen>
    );

  const now = discovery.now;
  const today = parisDay(now);
  const dated = isDatedKind(item.kind);
  const active = remaining(item, now, today);
  const race = item.kind === 'race';
  const relevant = race || item.kind === 'route' || (active && dated);
  const selectedDistance =
    distance !== undefined && item.distancesKm?.includes(distance) ? distance : item.distancesKm?.[0];
  const routeDistance = item.track ? routeLength(item.track.segments) / 1000 : undefined;
  const date = item.schedule?.day;
  const price = verifiedPrice(item, today);
  const registration = verifiedRegistration(item, now, today);
  const canRegister = registration?.state === 'open' && !!registration.url && !discovery.offline;
  const photo = photoFor(item);
  const state = statusLabel(item, now);
  const lastChecked = item.sources
    .map((source) => source.checkedOn)
    .sort()
    .at(-1)!;
  const checkAgain =
    discovery.offline ||
    discovery.feedError ||
    !current ||
    !checkedRecently(lastChecked, today, dated ? 30 : 90);
  const organizer =
    item.clubId && discovery.items.find((club) => club.id === item.clubId && club.kind === 'club');
  const occurrences =
    item.kind === 'club'
      ? discovery.items
          .filter((other) => other.clubId === item.id && remaining(other, now, today))
          .sort((a, b) => (a.schedule?.day ?? '').localeCompare(b.schedule?.day ?? ''))
      : [];
  const prep: DiscoveryPreparation = {
    name: item.title,
    distanceKm: selectedDistance ?? routeDistance,
    ...(race && active && date ? { event: { id: item.id, day: date } } : {}),
  };
  const suggestion: DiscoveryWorkoutSuggestion =
    race && selectedDistance === 10 ? 'intervals1000' : 'endurance';
  const suggestionLabel =
    TEMPLATE_INFO.find((template) => template.kind === suggestion)?.name ?? 'Séance d’endurance';
  const preparationAvailable =
    relevant && item.state === 'published' && !discovery.blocked && (!dated || active || (race && !date));
  const linkTitle = canRegister
    ? 'S’inscrire'
    : item.kind === 'club'
      ? 'Canal officiel du club'
      : item.kind === 'race'
        ? 'Site officiel'
        : dated
          ? 'Infos de l’organisateur'
          : 'Informations officielles';
  const showDirections = !!(item.point || item.address || item.venue);
  const metrics = [
    {
      label: 'Distance',
      value:
        routeDistance !== undefined
          ? kmLabel(Math.round(routeDistance * 100) / 100)
          : item.distancesKm?.map(kmLabel).join(' / '),
    },
    { label: 'Terrain', value: item.terrain && terrainTitle[item.terrain] },
    {
      label: 'D+ annoncé',
      value: item.elevationGainM === undefined ? undefined : `${item.elevationGainM} m`,
    },
  ].filter(({ value }) => value);

  const saveGoal = () => {
    if (selectedDistance === undefined || !date) return;
    confirm(
      'Ajouter cet objectif ?',
      `${item.title} · ${kmLabel(selectedDistance)} · ${dayLabel(date)}`,
      'Ajouter',
      () => void discovery.setGoal(item, selectedDistance),
    );
  };
  const prepareRoute = async (track: NonNullable<DiscoveryItem['track']>) => {
    if (session.getSnapshot().run) return 'La préparation du parcours est disponible entre deux courses.';
    const route = {
      ...createRoute(item.title, track.segments, 'gpx'),
      id: `discovery:${item.id}:${lastChecked}`,
    };
    await toolsStore.initialize();
    if (session.getSnapshot().run) return 'La préparation du parcours est disponible entre deux courses.';
    if (
      !toolsStore.getSnapshot().routes.some((entry) => entry.id === route.id) &&
      !(await toolsStore.addRoute(route))
    ) {
      return toolsStore.getSnapshot().message ?? 'Enregistrement du tracé impossible.';
    }
    if (!(await toolsStore.update({ selectedRouteId: route.id })))
      return toolsStore.getSnapshot().message ?? 'Sélection du tracé impossible.';
    onPrepare(prep, false);
  };

  return (
    <Screen gap={spacing.xl}>
      <View style={[styles.row, { justifyContent: 'space-between' }]}>
        <IconButton icon="chevron-back" label="Retour à Découvrir" onPress={onBack} quiet />
        <Label style={{ flexShrink: 1 }}>
          {kindTitle[item.kind]} · {item.city}
        </Label>
        <IconButton
          icon={saved?.favorite ? 'heart' : 'heart-outline'}
          label={saved?.favorite ? 'Retirer des favoris' : 'Enregistrer en favori'}
          feedback="none"
          disabled={!discovery.canSave}
          onPress={() => void discovery.toggleFavorite(item)}
        />
      </View>
      <DiscoveryArt item={item} style={{ height: photo ? 236 : 130 }} />
      <View style={{ gap: spacing.sm }}>
        <Copy accessibilityRole="header" variant="hero">
          {item.title}
        </Copy>
        {dated && (
          <Copy variant="emphasis" style={{ color: colors.accentText }}>
            {scheduleLabel(item)}
          </Copy>
        )}
        {item.venue && <Copy muted>{item.venue}</Copy>}
        {!!state && (
          <Label style={{ color: item.state === 'cancelled' ? colors.danger : colors.warning.text }}>
            {state}
          </Label>
        )}
        {date && !active && item.state === 'published' && date < today && <Label>Rendez-vous passé</Label>}
        {!!(dated && !item.schedule?.startAt && item.schedule) && (
          <Copy muted variant="caption">
            Horaire à confirmer sur la source officielle.
          </Copy>
        )}
      </View>
      {!!metrics.length && (
        <View style={styles.wrap}>
          {metrics.map(({ label, value }) => (
            <View
              key={label}
              style={{
                flexGrow: 1,
                minWidth: 84,
                maxWidth: '100%',
                padding: spacing.md,
                borderRadius: radii.card,
                backgroundColor: colors.surface,
              }}
            >
              <Copy variant="metric">{value}</Copy>
              <Copy variant="caption" muted>
                {label}
              </Copy>
            </View>
          ))}
        </View>
      )}
      <View style={styles.stack}>
        <Button
          title={linkTitle}
          icon="open-outline"
          disabled={busy || discovery.offline}
          onPress={() => void act(() => openOfficial(canRegister ? registration.url! : item.officialUrl))}
        />
        <View style={styles.wrap}>
          {showDirections && (
            <Chip
              title={item.kind === 'route' ? 'Ouvrir le départ' : 'Itinéraire'}
              icon="navigate-outline"
              disabled={busy}
              onPress={() => void act(() => directions(item))}
            />
          )}
          <Chip
            title="Partager"
            icon="share-outline"
            disabled={busy}
            onPress={() => void act(() => shareDiscovery(item))}
          />
          {active && (
            <Chip
              title="Exporter au calendrier"
              icon="calendar-outline"
              disabled={busy}
              onPress={() => void act(() => shareDocument(calendarDocument(item)))}
            />
          )}
        </View>
        {active && (
          <Copy variant="caption" muted>
            Le fichier .ics s’ouvre dans une application de calendrier.
          </Copy>
        )}
        {!!message && (
          <Copy variant="caption" accessibilityRole="alert">
            {message}
          </Copy>
        )}
        {!!discovery.storageError && (
          <Copy variant="caption" accessibilityRole="alert">
            {discovery.storageError}
          </Copy>
        )}
      </View>
      <DiscoverySection title={dated ? 'Le rendez-vous' : item.kind === 'club' ? 'Le club' : 'Sur place'}>
        <Copy>{item.summary}</Copy>
        {item.organizer && <Copy muted>Organisé par {item.organizer}</Copy>}
        {item.address && <Copy muted>{item.address}</Copy>}
        {item.point && !item.track && (
          <MapOverview location={item.point} onPress={() => void act(() => directions(item))} />
        )}
        {typeof price === 'number' ? (
          <Copy muted>
            {price === 0 ? 'Gratuit' : currency.format(price / 100)} · vérifié le{' '}
            {dayLabel(item.price!.checkedOn)}
          </Copy>
        ) : race && active ? (
          <Copy muted>Voir les tarifs et modalités sur le site officiel.</Copy>
        ) : null}
        {item.beginner && <Copy muted>Ouvert aux débutants.</Copy>}
        {item.facts?.map((fact) => (
          <View key={fact.label} style={{ gap: spacing.xs }}>
            <Copy variant="emphasis">{fact.label}</Copy>
            <Copy muted>{fact.text}</Copy>
          </View>
        ))}
        {organizer && <ResultRow item={organizer} onPress={() => onOpen(organizer.id)} />}
      </DiscoverySection>
      {item.kind === 'club' && (
        <DiscoverySection title="Prochaines sorties">
          {occurrences.length ? (
            occurrences.map((other) => (
              <ResultRow key={other.id} item={other} onPress={() => onOpen(other.id)} />
            ))
          ) : (
            <Copy muted>
              Pour connaître la prochaine date et le point de rencontre, consulte le canal officiel du club.
            </Copy>
          )}
        </DiscoverySection>
      )}
      {item.track && (
        <DiscoverySection title="Le tracé">
          <RouteMap
            points={[]}
            reference={item.track.segments}
            height={220}
            interactive={!discovery.offline}
          />
          <Copy muted variant="caption">
            Distance calculée à partir du tracé. {item.track.credit} · {item.track.license}
          </Copy>
          <Button
            title="Source du tracé"
            variant="quiet"
            disabled={busy || discovery.offline}
            onPress={() => void act(() => openOfficial(item.track!.sourceUrl))}
          />
          <Button
            title="Exporter le GPX"
            secondary
            disabled={busy}
            onPress={() =>
              void act(() => shareDocument(geometryGPX(item.track!.segments, item.title, `${item.id}.gpx`)))
            }
          />
        </DiscoverySection>
      )}
      {(preparationAvailable || saved?.goal) && (
        <Panel style={styles.stack}>
          <Copy variant="heading" accessibilityRole="header">
            {race ? 'Préparer cette course' : 'Préparer la sortie'}
          </Copy>
          {preparationAvailable && (
            <>
              {item.distancesKm && item.distancesKm.length > 1 && (
                <ChipRow label="Distance à préparer">
                  {item.distancesKm.map((km) => (
                    <Chip
                      title={kmLabel(km)}
                      key={km}
                      selected={selectedDistance === km}
                      onPress={() => setDistance(km)}
                    />
                  ))}
                </ChipRow>
              )}
              {race && active && selectedDistance !== undefined && (
                <Button
                  title={saved?.goal ? 'Mettre à jour mon objectif' : 'Ajouter à mes objectifs'}
                  variant="secondary"
                  icon="flag-outline"
                  disabled={!discovery.canSave}
                  onPress={saveGoal}
                />
              )}
              <Button
                title={
                  item.track ? 'Courir ce parcours' : race ? 'Ouvrir la préparation' : 'Préparer une séance'
                }
                icon="flash-outline"
                disabled={busy}
                onPress={() => {
                  if (item.track) void act(() => prepareRoute(item.track!));
                  else onPrepare(prep, race);
                }}
              />
              {race && (
                <Button
                  title={suggestionLabel}
                  variant="quiet"
                  icon="stopwatch-outline"
                  onPress={() => onWorkout(suggestion, prep)}
                />
              )}
            </>
          )}
          {saved?.goal && (
            <>
              <Copy muted>
                {kmLabel(saved.goal.distanceKm)}
                {active && date ? ` · ${Math.max(0, calendarDays(today, date))} j avant la course` : ''}
              </Copy>
              <Button
                title="Retirer de mes objectifs"
                variant="quiet"
                onPress={() => void discovery.setGoal(item)}
              />
            </>
          )}
        </Panel>
      )}
      <DiscoverySection title="Sources">
        {!!checkAgain && (
          <Copy muted variant="caption">
            Informations à revérifier auprès de la source avant de partir.
          </Copy>
        )}
        {item.sources.map((source) => (
          <View key={source.url} style={{ gap: spacing.xs }}>
            <Button
              title={source.name}
              icon="open-outline"
              variant="secondary"
              disabled={discovery.offline || busy}
              onPress={() => void act(() => openOfficial(source.url))}
            />
            <Copy variant="caption" muted>
              Vérifié le {dayLabel(source.checkedOn)}
              {source.license ? ` · ${source.license}` : ''}
            </Copy>
          </View>
        ))}
        {photo && (
          <View style={{ gap: spacing.xs }}>
            <Copy muted variant="caption">
              {photo.caption} · {photo.author} / Wikimedia Commons · {photo.license}. Image redimensionnée et
              recadrée à l’affichage.
            </Copy>
            <View style={styles.wrap}>
              <Chip
                title="Photo originale"
                onPress={() => void act(() => openOfficial(photo.source))}
                disabled={discovery.offline || busy}
              />
              <Chip
                title={photo.license}
                onPress={() => void act(() => openOfficial(photo.licenseUrl))}
                disabled={discovery.offline || busy}
              />
            </View>
          </View>
        )}
      </DiscoverySection>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.sm },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
