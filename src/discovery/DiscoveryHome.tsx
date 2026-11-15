import { useCallback, useMemo, useRef, useState, type PropsWithChildren } from 'react';
import { Modal, ScrollView, StyleSheet, View } from 'react-native';
import {
  isDatedKind,
  parisDay,
  terrains,
  type DiscoveryItem,
  type DiscoveryPoint,
} from '../../supabase/functions/_shared/discovery-model';
import { Button, Copy, EmptyState, IconButton, Label, Screen } from '../ui/components';
import { Input, TextField } from '../ui/controls';
import { Sheet } from '../ui/Sheet';
import { useAdaptiveLayout, useTheme } from '../ui/theme';
import { spacing } from '../ui/tokens';
import { useDiscovery } from './DiscoveryProvider';
import {
  categories,
  defaultFilters,
  dayLabel,
  dateWindow,
  filterCatalogue,
  getSector,
  isGroup,
  isSpot,
  kmLabel,
  market,
  parseDateWindow,
  raceDistances,
  radiuses,
  remaining,
  sectors,
  terrainTitle,
  type DateWindow,
  type Period,
} from './catalog';
import {
  CatalogueNotice,
  CatalogueSkeleton,
  Chip,
  ChipRow,
  DiscoverySection,
  Feature,
  RaceTile,
  ResultRow,
} from './components';
import { DiscoveryMap, MapOverview } from './DiscoveryMap';
import { discoveryPosition } from './actions';
import type { DiscoveryPreferences } from './preferences';

const pages = [
  ['explore', 'Explorer'],
  ['agenda', 'Agenda'],
  ['map', 'Carte'],
  ['clubs', 'Clubs'],
  ['routes', 'Parcours'],
] as const;
type Page = (typeof pages)[number][0] | 'favorites';
type AgendaKind = 'all' | 'race' | 'group';
const periods: [Period, string][] = [
  ['all', 'À venir'],
  ['today', 'Aujourd’hui'],
  ['weekend', 'Week-end'],
  ['week', '7 jours'],
  ['month', '30 jours'],
  ['custom', 'Dates…'],
];
type ToggleFilter = 'free' | 'beginner' | 'accessible' | 'registrationOpen' | 'proximity';
const facets: [ToggleFilter, string][] = [
  ['free', 'Gratuit'],
  ['beginner', 'Débutant'],
  ['accessible', 'Accès PMR indiqué'],
  ['registrationOpen', 'Inscriptions ouvertes'],
  ['proximity', 'Par proximité'],
];

function Dialog({ title, onClose, children }: PropsWithChildren<{ title: string; onClose: () => void }>) {
  const { reduceMotion } = useTheme();
  return (
    <Modal transparent animationType={reduceMotion ? 'none' : 'fade'} onRequestClose={onClose}>
      <Sheet title={title} onClose={onClose}>
        {children}
      </Sheet>
    </Modal>
  );
}

function DatePicker({ initial, onApply }: { initial: DateWindow; onApply: (dates: DateWindow) => void }) {
  const [from, setFrom] = useState(initial.from);
  const [through, setThrough] = useState(initial.through);
  const [error, setError] = useState(false);
  return (
    <View style={{ gap: spacing.md }}>
      <TextField label="Du (AAAA-MM-JJ)" value={from} onChangeText={setFrom} autoCorrect={false} />
      <TextField label="Au (AAAA-MM-JJ)" value={through} onChangeText={setThrough} autoCorrect={false} />
      {error && (
        <Copy accessibilityRole="alert">
          Saisis deux dates valides, avec une fin égale ou postérieure au début.
        </Copy>
      )}
      <Button
        title="Afficher cette période"
        onPress={() => {
          const parsed = parseDateWindow(from.trim(), through.trim());
          if (parsed) onApply(parsed);
          else setError(true);
        }}
      />
    </View>
  );
}

export function DiscoveryHome({ onOpen }: { onOpen: (id: string) => void }) {
  const discovery = useDiscovery();
  const { prefs, now, items, entries } = discovery;
  const { colors } = useTheme();
  const { largeText, width } = useAdaptiveLayout();
  const [page, setPage] = useState<Page>('explore');
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState('');
  const [localBrowse, setLocalBrowse] =
    useState<Pick<DiscoveryPreferences, 'sector' | 'radius' | 'filters'>>();
  const [agendaKind, setAgendaKind] = useState<AgendaKind>('all');
  const [period, setPeriod] = useState<Period>('all');
  const [custom, setCustom] = useState<DateWindow>();
  const [dialog, setDialog] = useState<'filters' | 'dates' | undefined>();
  const [position, setPosition] = useState<DiscoveryPoint>();
  const positionRequest = useRef(0);
  const [positionBusy, setPositionBusy] = useState(false);
  const [positionError, setPositionError] = useState<string>();
  const [limit, setLimit] = useState(12);
  const close = useCallback(() => setDialog(undefined), []);
  const { sector, radius, filters } = localBrowse ?? prefs;
  const today = parisDay(now);
  const where = getSector(sector);
  const term = searching ? query.trim() : '';
  const scoped = useMemo(
    () => filterCatalogue(items, { filters, query: term, sector, radius, position, now }),
    [filters, items, now, position, radius, sector, term],
  );
  const saved = useMemo(
    () => new Set(prefs.saves.filter((save) => save.favorite).map((save) => save.item.id)),
    [prefs.saves],
  );
  const point = useMemo(
    () =>
      position
        ? {
            latitude: Math.round(position.latitude * 100) / 100,
            longitude: Math.round(position.longitude * 100) / 100,
          }
        : where,
    [position, where],
  );

  const choosePage = (next: Page, kind: AgendaKind = 'all', dates: Period = 'all') => {
    setPage(next);
    setSearching(false);
    setQuery('');
    setLimit(12);
    if (next === 'agenda') {
      setAgendaKind(kind);
      setPeriod(dates);
    }
  };
  const updateBrowse = (patch: Partial<Pick<DiscoveryPreferences, 'sector' | 'radius' | 'filters'>>) => {
    const next = { sector, radius, filters, ...patch };
    setLocalBrowse(next);
    void discovery.persist((previous) => ({ ...previous, ...next }));
    setLimit(12);
  };
  const applyFilter = (key: ToggleFilter) => updateBrowse({ filters: { ...filters, [key]: !filters[key] } });
  const selectSector = (next: DiscoveryPreferences['sector']) => {
    positionRequest.current++;
    setPosition(undefined);
    setPositionBusy(false);
    setPositionError(undefined);
    updateBrowse({ sector: next });
  };
  const locate = async () => {
    if (positionBusy || discovery.blocked) return;
    const request = ++positionRequest.current;
    setPositionBusy(true);
    setPositionError(undefined);
    try {
      const next = await discoveryPosition();
      if (positionRequest.current === request) setPosition(next);
    } catch (error) {
      if (positionRequest.current === request)
        setPositionError(
          error instanceof Error ? error.message : 'Localisation indisponible. Choisis un secteur.',
        );
    } finally {
      if (positionRequest.current === request) setPositionBusy(false);
    }
  };
  const resultRow = (item: DiscoveryItem, text?: string) => (
    <ResultRow
      key={item.id}
      item={item}
      saved={saved.has(item.id)}
      text={text}
      onPress={() => onOpen(item.id)}
    />
  );
  const resultRows = (items: DiscoveryItem[], options: { title: string; body: string }) =>
    !items.length ? (
      <EmptyState icon="search-outline" title={options.title} body={options.body} />
    ) : (
      <View style={styles.stack}>
        {items.slice(0, limit).map((item) => resultRow(item))}
        {items.length > limit && (
          <Button title="Afficher plus" secondary onPress={() => setLimit(limit + 12)} />
        )}
      </View>
    );
  const clearFilters = () => updateBrowse({ filters: { ...defaultFilters } });
  const when = dateWindow(period, today, custom);
  const agenda = scoped.filter(
    (item) =>
      isDatedKind(item.kind) &&
      (agendaKind === 'all' || (agendaKind === 'race' ? item.kind === 'race' : isGroup(item))) &&
      (!when ||
        (item.schedule &&
          item.schedule.day <= when.through &&
          (item.schedule.lastDay ?? item.schedule.day) >= when.from)),
  );
  const scopeIsFiltered =
    filters.distanceKm !== null ||
    filters.terrain !== null ||
    filters.category !== null ||
    facets.some(([key]) => key !== 'proximity' && filters[key]);
  const activeRaces = scoped.filter((item) => item.kind === 'race' && item.schedule);
  const groupRuns = scoped.filter(isGroup);
  const clubs = scoped.filter((item) => item.kind === 'club');
  const spots = scoped.filter(isSpot);
  const week = dateWindow('week', today)!;
  const thisWeek = scoped.filter((item) => item.schedule && item.schedule.day <= week.through);
  const feature =
    activeRaces.find((item) => item.featured && item.mediaKey) ??
    activeRaces.find((item) => item.mediaKey) ??
    activeRaces[0] ??
    spots.find((item) => item.mediaKey) ??
    groupRuns[0] ??
    spots[0];
  const featuredRaces = activeRaces.filter((item) => item.id !== feature?.id).slice(0, 3);
  const distant = scoped.filter(
    (item) => item.city !== where.name && item.id !== feature?.id && (isSpot(item) || item.kind === 'club'),
  );
  const currentGoal = prefs.saves.find(
    (save) => save.goal && items.some((item) => item.id === save.item.id && remaining(item, now)),
  );

  const heading = (
    <>
      <View style={[styles.wrap, { alignItems: 'center', justifyContent: 'space-between' }]}>
        <Chip
          title={position ? 'Autour de moi' : width < 345 ? where.name : `${where.name} · ${market.region}`}
          icon="location-outline"
          accessibilityLabel={`Choisir le secteur, ${position ? 'autour de moi' : where.name}`}
          onPress={() => setDialog('filters')}
        />
        <View style={styles.row}>
          <IconButton
            icon={searching ? 'close' : 'search-outline'}
            label={searching ? 'Fermer la recherche' : 'Rechercher dans Découvrir'}
            quiet
            onPress={() => {
              setSearching(!searching);
              setQuery('');
              setLimit(12);
            }}
          />
          <IconButton
            icon="options-outline"
            label="Filtres de découverte"
            quiet
            onPress={() => setDialog('filters')}
          />
          <IconButton
            icon={page === 'favorites' ? 'heart' : 'heart-outline'}
            label="Favoris et objectifs"
            quiet
            onPress={() => choosePage(page === 'favorites' ? 'explore' : 'favorites')}
          />
        </View>
      </View>
      {page === 'explore' && !searching && (
        <View style={{ gap: spacing.xs }}>
          <Copy
            variant="hero"
            accessibilityRole="header"
            style={{ fontSize: largeText ? 46 : 64, lineHeight: largeText ? 54 : 68 }}
          >
            Courir, ici.
          </Copy>
          <Copy muted>Courses, clubs et parcours près de toi.</Copy>
        </View>
      )}
      {searching && (
        <Input
          autoFocus
          value={query}
          onChangeText={(value) => {
            setQuery(value);
            setLimit(12);
          }}
          accessibilityLabel="Rechercher une course, un club ou un parcours"
          placeholder="Course, club, piste, parcours…"
          returnKeyType="search"
          autoCorrect={false}
        />
      )}
      <ChipRow label="Navigation Découvrir">
        {pages.map(([key, title]) => (
          <Chip
            key={key}
            title={title}
            selected={!searching && page === key}
            onPress={() => choosePage(key)}
          />
        ))}
      </ChipRow>
    </>
  );

  return (
    <>
      <Screen key={page} gap={spacing.lg}>
        {heading}
        {discovery.storageError && (
          <Copy accessibilityRole="alert" muted variant="caption">
            {discovery.storageError}
          </Copy>
        )}
        <CatalogueNotice
          {...discovery}
          refresh={discovery.refreshAvailable ? discovery.refresh : undefined}
        />
        {!discovery.booted ? (
          <CatalogueSkeleton />
        ) : searching ? (
          <DiscoverySection title="Recherche locale">
            {resultRows(scoped, {
              title: 'Aucune fiche trouvée',
              body: 'Essaie un autre nom, un autre secteur ou retire des filtres.',
            })}
            {scopeIsFiltered && <Button title="Retirer les filtres" secondary onPress={clearFilters} />}
          </DiscoverySection>
        ) : page === 'explore' ? (
          <>
            {feature && <Feature item={feature} onPress={() => onOpen(feature.id)} />}
            <ChipRow label="Filtres rapides">
              <Chip
                title="Cette semaine"
                icon="calendar-outline"
                onPress={() => choosePage('agenda', 'all', 'week')}
              />
              {facets.slice(0, 2).map(([key, title]) => (
                <Chip key={key} title={title} selected={filters[key]} onPress={() => applyFilter(key)} />
              ))}
              <Chip
                title="10 km"
                selected={filters.distanceKm === 10}
                onPress={() =>
                  updateBrowse({ filters: { ...filters, distanceKm: filters.distanceKm === 10 ? null : 10 } })
                }
              />
              <Chip
                title="Trail"
                selected={filters.terrain === 'trail'}
                onPress={() =>
                  updateBrowse({
                    filters: { ...filters, terrain: filters.terrain === 'trail' ? null : 'trail' },
                  })
                }
              />
            </ChipRow>
            {scopeIsFiltered && !scoped.length && (
              <EmptyState
                icon="options-outline"
                title="Aucune fiche avec ces filtres"
                body="Élargis ta recherche pour retrouver les rendez-vous et les lieux."
                action={<Button title="Retirer les filtres" secondary onPress={clearFilters} />}
              />
            )}
            <DiscoverySection
              title="Cette semaine près de toi"
              action="Agenda"
              onPress={() => choosePage('agenda', 'all', 'week')}
            >
              {thisWeek.length ? (
                largeText ? (
                  thisWeek.slice(0, 4).map((item) => resultRow(item))
                ) : (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.row}
                  >
                    {thisWeek.slice(0, 4).map((item) => (
                      <View key={item.id} style={{ width: 264 }}>
                        {resultRow(item)}
                      </View>
                    ))}
                  </ScrollView>
                )
              ) : (
                <Copy muted>
                  Le catalogue n’a pas encore de rendez-vous confirmé pour les sept prochains jours.
                </Copy>
              )}
            </DiscoverySection>
            <DiscoverySection
              title="Les prochaines courses"
              action="Tout voir"
              onPress={() => choosePage('agenda', 'race')}
            >
              {featuredRaces.map((item) => (
                <RaceTile key={item.id} item={item} now={now} onPress={() => onOpen(item.id)} />
              ))}
              {!featuredRaces.length && (
                <Copy muted>
                  {feature?.kind === 'race'
                    ? 'Retrouve aussi les annonces de dates dans l’agenda.'
                    : 'Les prochaines dates seront affichées dès leur confirmation.'}
                </Copy>
              )}
            </DiscoverySection>
            <DiscoverySection title="Courir ensemble" action="Les clubs" onPress={() => choosePage('clubs')}>
              <View style={styles.wrap}>
                <Chip
                  title="Sorties collectives"
                  icon="people-outline"
                  onPress={() => choosePage('agenda', 'group')}
                />
              </View>
              {clubs.slice(0, 2).map((item) => resultRow(item))}
              {groupRuns[0] && resultRow(groupRuns[0])}
            </DiscoverySection>
            <DiscoverySection
              title="Tes spots pour courir"
              action="Tous les spots"
              onPress={() => choosePage('routes')}
            >
              <MapOverview onPress={() => choosePage('map')} />
              {spots.slice(0, 3).map((item) => resultRow(item))}
            </DiscoverySection>
            {currentGoal && (
              <DiscoverySection title="Ton prochain objectif">
                {resultRow(
                  items.find((item) => item.id === currentGoal.item.id) ?? currentGoal.item,
                  currentGoal.goal ? `Objectif ${kmLabel(currentGoal.goal.distanceKm)}` : undefined,
                )}
              </DiscoverySection>
            )}
            {distant.length > 0 && (
              <DiscoverySection title="Au-delà du secteur">
                {distant.slice(0, 3).map((item) => resultRow(item))}
              </DiscoverySection>
            )}
          </>
        ) : page === 'agenda' ? (
          <DiscoverySection title="Agenda running">
            <ChipRow label="Période de l’agenda">
              {periods.map(([key, title]) => (
                <Chip
                  key={key}
                  title={title}
                  selected={key === period}
                  onPress={() => {
                    if (key === 'custom') setDialog('dates');
                    else {
                      setPeriod(key);
                      setLimit(12);
                    }
                  }}
                />
              ))}
            </ChipRow>
            <ChipRow label="Types de rendez-vous">
              {(
                [
                  ['all', 'Tout'],
                  ['race', 'Courses'],
                  ['group', 'Sorties et séances'],
                ] as const
              ).map(([key, title]) => (
                <Chip
                  key={key}
                  title={title}
                  selected={agendaKind === key}
                  onPress={() => {
                    setAgendaKind(key);
                    setLimit(12);
                  }}
                />
              ))}
            </ChipRow>
            {when && (
              <Copy muted variant="caption">
                {when.from === when.through
                  ? dayLabel(when.from)
                  : `${dayLabel(when.from, true)} – ${dayLabel(when.through)}`}
              </Copy>
            )}
            {!agenda.length && (
              <EmptyState
                icon="calendar-outline"
                title="Aucun rendez-vous confirmé"
                body="Choisis une autre période ou retire un filtre pour élargir la recherche."
              />
            )}
            {agenda.slice(0, limit).map((item, index) => {
              const day = item.schedule?.day;
              const newDay = !index || day !== agenda[index - 1]?.schedule?.day;
              return (
                <View key={item.id} style={styles.stack}>
                  {newDay && (
                    <Label accessibilityRole="header">{day ? dayLabel(day) : 'Jour à confirmer'}</Label>
                  )}
                  {resultRow(
                    item,
                    [
                      item.schedule?.startAt
                        ? new Date(item.schedule.startAt).toLocaleTimeString('fr-FR', {
                            hour: '2-digit',
                            minute: '2-digit',
                            timeZone: 'Europe/Paris',
                          })
                        : item.dateNote,
                      item.city,
                    ]
                      .filter(Boolean)
                      .join(' · '),
                  )}
                </View>
              );
            })}
            {agenda.length > limit && (
              <Button title="Afficher plus" secondary onPress={() => setLimit(limit + 12)} />
            )}
          </DiscoverySection>
        ) : page === 'map' ? (
          <DiscoverySection title="Carte des environs">
            <DiscoveryMap
              key={`${point.latitude}:${point.longitude}`}
              items={scoped}
              center={point}
              offline={discovery.offline}
              onOpen={onOpen}
            />
          </DiscoverySection>
        ) : page === 'clubs' ? (
          <>
            <DiscoverySection title="Courir ensemble">
              {resultRows(clubs, {
                title: 'Aucun club trouvé',
                body: 'Élargis le rayon ou choisis un autre filtre.',
              })}
            </DiscoverySection>
            <DiscoverySection
              title="Sorties et séances confirmées"
              action="Agenda"
              onPress={() => choosePage('agenda', 'group')}
            >
              {groupRuns.length ? (
                groupRuns.slice(0, limit).map((item) => resultRow(item))
              ) : (
                <Copy muted>Consulte le canal officiel d’un club pour connaître son prochain départ.</Copy>
              )}
            </DiscoverySection>
          </>
        ) : page === 'routes' ? (
          <DiscoverySection title="Lieux et parcours">
            <MapOverview onPress={() => choosePage('map')} />
            {resultRows(spots, {
              title: 'Aucun spot dans ce secteur',
              body: 'Choisis un autre secteur ou élargis le rayon.',
            })}
          </DiscoverySection>
        ) : (
          <DiscoverySection title="Favoris et objectifs">
            {!prefs.saves.length && (
              <EmptyState
                icon="heart-outline"
                title="Tes premières envies de courir"
                body="Enregistre une course, un club ou un lieu depuis sa fiche."
              />
            )}
            {(['Objectifs', 'Rendez-vous', 'Clubs', 'Lieux et parcours'] as const).map((title) => {
              const group = prefs.saves.filter(({ item, goal, favorite }) =>
                title === 'Objectifs'
                  ? !!goal
                  : favorite &&
                    (title === 'Rendez-vous'
                      ? isDatedKind(item.kind)
                      : title === 'Clubs'
                        ? item.kind === 'club'
                        : isSpot(item)),
              );
              if (!group.length) return null;
              return (
                <View key={title} style={styles.stack}>
                  <Label>{title}</Label>
                  {group.slice(0, limit).map(({ item: snapshot, goal }) => {
                    const item = items.find((value) => value.id === snapshot.id) ?? snapshot;
                    const text =
                      entries.get(item.id) === null
                        ? 'Fiche retirée du catalogue'
                        : title === 'Objectifs' && goal
                          ? kmLabel(goal.distanceKm)
                          : undefined;
                    return resultRow(item, text);
                  })}
                  {group.length > limit && (
                    <Button title={`Voir plus · ${title}`} secondary onPress={() => setLimit(limit + 12)} />
                  )}
                </View>
              );
            })}
          </DiscoverySection>
        )}
      </Screen>
      {dialog === 'filters' && (
        <Dialog title="Filtrer Découvrir" onClose={close}>
          <View style={{ gap: spacing.lg }}>
            <View style={styles.stack}>
              <Label>Secteur</Label>
              <View style={styles.wrap}>
                {sectors.map((s) => (
                  <Chip
                    title={s.name}
                    key={s.id}
                    selected={!position && s.id === sector}
                    onPress={() => selectSector(s.id)}
                  />
                ))}
              </View>
              <Chip
                title={positionBusy ? 'Recherche de la position…' : 'Autour de moi'}
                icon="locate-outline"
                selected={!!position}
                disabled={positionBusy || discovery.blocked}
                onPress={() => void locate()}
              />
              <Copy variant="caption" muted>
                La position sert à trier les fiches sur cet appareil. Tu peux choisir un secteur à tout
                moment.
              </Copy>
              {positionError && (
                <Copy variant="caption" accessibilityRole="alert" style={{ color: colors.warning.text }}>
                  {positionError}
                </Copy>
              )}
            </View>
            <View style={styles.stack}>
              <Label>Rayon</Label>
              <View style={styles.wrap}>
                {radiuses.map((option) => (
                  <Chip
                    title={`${option} km`}
                    key={option}
                    selected={option === radius}
                    onPress={() => updateBrowse({ radius: option })}
                  />
                ))}
              </View>
            </View>
            <View style={styles.stack}>
              <Label>Catégorie</Label>
              <View style={styles.wrap}>
                {categories.map(([category, title]) => (
                  <Chip
                    key={category}
                    title={title}
                    selected={filters.category === category}
                    onPress={() =>
                      updateBrowse({
                        filters: { ...filters, category: filters.category === category ? null : category },
                      })
                    }
                  />
                ))}
              </View>
            </View>
            <View style={styles.stack}>
              <Label>Distance de course</Label>
              <View style={styles.wrap}>
                {raceDistances.map((km) => (
                  <Chip
                    key={km}
                    title={kmLabel(km)}
                    selected={filters.distanceKm === km}
                    onPress={() =>
                      updateBrowse({
                        filters: { ...filters, distanceKm: filters.distanceKm === km ? null : km },
                      })
                    }
                  />
                ))}
              </View>
            </View>
            <View style={styles.stack}>
              <Label>Terrain</Label>
              <View style={styles.wrap}>
                {terrains.map((terrain) => (
                  <Chip
                    key={terrain}
                    title={terrainTitle[terrain]}
                    selected={filters.terrain === terrain}
                    onPress={() =>
                      updateBrowse({
                        filters: { ...filters, terrain: filters.terrain === terrain ? null : terrain },
                      })
                    }
                  />
                ))}
              </View>
            </View>
            <View style={styles.stack}>
              <Label>Critères</Label>
              <View style={styles.wrap}>
                {facets.map(([key, title]) => (
                  <Chip key={key} title={title} selected={filters[key]} onPress={() => applyFilter(key)} />
                ))}
              </View>
            </View>
            <Button title="Afficher les résultats" onPress={close} />
            <Button title="Réinitialiser les critères" variant="quiet" onPress={clearFilters} />
            {discovery.refreshAvailable && (
              <Button
                title="Actualiser le catalogue"
                variant="quiet"
                icon="refresh-outline"
                onPress={() => {
                  discovery.refresh();
                  close();
                }}
              />
            )}
          </View>
        </Dialog>
      )}
      {dialog === 'dates' && (
        <Dialog title="Choisir les dates" onClose={close}>
          <DatePicker
            initial={custom ?? { from: today, through: today }}
            onApply={(dates) => {
              setCustom(dates);
              setPeriod('custom');
              setLimit(12);
              close();
            }}
          />
        </Dialog>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  stack: { gap: spacing.sm },
});
