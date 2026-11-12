import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { duration, km, pace, runDate } from '../core/format';
import type { RunRecord } from '../core/types';
import { aggregate, shoeMileage } from '../progression/aggregates';
import { exampleRuns } from '../progression/exampleRuns';
import { useProgression } from '../progression/hooks';
import { progression } from '../progression/store';
import {
  Button,
  Copy,
  EmptyState,
  IconButton,
  ListRow,
  Metric,
  MetricGrid,
  Panel,
  Screen,
  SectionHeading,
} from '../ui/components';
import { SegmentedControl, TextField } from '../ui/controls';
import { RunRow } from '../ui/RunRow';
import { spacing } from '../ui/tokens';

type StatsView = 'activities' | 'profile' | 'shoes';

export type StatsNavigation = {
  onHistory: () => void;
  onDetail: (run: RunRecord) => void;
  onExample: (id: string) => void;
  onRecords: () => void;
  onProgression: () => void;
  onShoes: () => void;
};

function ExampleRows({ onExample }: Pick<StatsNavigation, 'onExample'>) {
  return exampleRuns.map(({ title, run }) => (
    <ListRow
      key={run.id}
      title={title}
      icon="map-outline"
      subtitle={
        <Copy variant="caption" muted>
          {runDate(run.startedAt)} · {km(run.distanceMeters)} km · {duration(run.activeSeconds)}
        </Copy>
      }
      onPress={() => onExample(run.id)}
    />
  ));
}

export default function StatsDashboard({
  history,
  hasRun,
  onRunSettings,
  onHistory,
  onDetail,
  onExample,
  onRecords,
  onProgression,
  onShoes,
}: StatsNavigation & { history: RunRecord[]; hasRun: boolean; onRunSettings: () => void }) {
  const [view, setView] = useState<StatsView>('activities');
  const [draft, setDraft] = useState<string | null>(null);
  const { data, ready, busy, message } = useProgression();
  const totals = useMemo(() => aggregate(history, 0, Date.now() + 1), [history]);
  const recent = useMemo(
    () => [...totals.runs].sort((a, b) => b.startedAt - a.startedAt).slice(0, 5),
    [totals.runs],
  );
  const defaultShoe = data.shoes.find((shoe) => shoe.id === data.defaultShoeId && !shoe.archived);
  const activeShoes = data.shoes.filter((shoe) => !shoe.archived);
  const saveName = async () => {
    if (draft !== null && (await progression.saveProfileName(draft))) setDraft(null);
  };

  return (
    <Screen gap={spacing.lg}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: spacing.md,
        }}
      >
        <Copy variant="condensedTitle" accessibilityRole="header">
          Stats
        </Copy>
        <IconButton square icon="options-outline" label="Réglages de course" onPress={onRunSettings} />
      </View>
      {hasRun && (
        <Button title="Revenir au suivi de la course" icon="pulse-outline" onPress={onRunSettings} />
      )}
      <SegmentedControl<StatsView>
        label="Section des statistiques"
        value={view}
        onChange={setView}
        choices={[
          ['activities', 'Activités'],
          ['profile', 'Profil'],
          ['shoes', 'Paires'],
        ]}
      />

      {view === 'activities' && (
        <>
          <SectionHeading title="Vos dernières sorties" />
          {recent.length ? (
            <>
              {recent.map((run) => (
                <RunRow key={run.id} run={run} onPress={() => onDetail(run)} detailed />
              ))}
              <Button title="Tout l’historique" icon="time-outline" secondary onPress={onHistory} />
            </>
          ) : (
            <EmptyState
              icon="footsteps-outline"
              title="Aucune sortie enregistrée"
              body="Vos courses terminées apparaîtront ici."
            />
          )}
          <SectionHeading title="Activités fictives" />
          <ExampleRows onExample={onExample} />
        </>
      )}

      {view === 'profile' && (
        <>
          <Panel style={{ gap: spacing.lg }}>
            <View style={{ gap: spacing.xs }}>
              <Copy variant="heading">{data.profileName || 'Mon profil'}</Copy>
              <Copy variant="caption" muted>
                Profil local Sprinter
              </Copy>
            </View>
            {draft === null ? (
              <Button
                title="Modifier le nom"
                secondary
                disabled={!ready}
                onPress={() => setDraft(data.profileName ?? '')}
              />
            ) : (
              <>
                <TextField
                  label="Nom affiché"
                  value={draft}
                  onChangeText={setDraft}
                  maxLength={40}
                  editable={!busy}
                />
                <Button title="Enregistrer le nom" disabled={busy} onPress={() => void saveName()} />
                <Button title="Annuler" variant="quiet" disabled={busy} onPress={() => setDraft(null)} />
                {message && (
                  <Copy accessibilityRole="alert" variant="caption">
                    {message}
                  </Copy>
                )}
              </>
            )}
            <MetricGrid>
              <Metric label="Sorties" value={String(totals.outings)} />
              <Metric label="Distance totale" value={km(totals.meters)} unit="km" />
              <Metric label="Temps actif" value={duration(totals.activeSeconds)} />
              <Metric label="Allure moyenne" value={pace(totals.averagePace)} unit="/km" />
            </MetricGrid>
          </Panel>
          <ListRow
            title="Records personnels"
            icon="trophy-outline"
            onPress={onRecords}
            subtitle={
              <Copy muted variant="caption">
                Passages GPS du 100 m au marathon
              </Copy>
            }
          />
          <ListRow title="Progression et calendrier" icon="calendar-outline" onPress={onProgression} />
          <SectionHeading title="Activités fictives" />
          <ExampleRows onExample={onExample} />
        </>
      )}

      {view === 'shoes' && (
        <>
          <SectionHeading title="Vos paires" />
          {activeShoes.length ? (
            activeShoes.map((shoe) => {
              const mileage = shoeMileage(history, data, shoe.id);
              return (
                <ListRow
                  key={shoe.id}
                  title={shoe.name}
                  icon="footsteps-outline"
                  subtitle={
                    <Copy muted variant="caption">
                      {km(mileage.totalMeters)} km · {mileage.runs} sortie{mileage.runs > 1 ? 's' : ''}
                      {shoe.id === defaultShoe?.id ? ' · Par défaut' : ''}
                    </Copy>
                  }
                  onPress={onShoes}
                />
              );
            })
          ) : (
            <EmptyState
              icon="footsteps-outline"
              title="Aucune paire active"
              body="Ajoutez une paire et choisissez-la par défaut pour cumuler la distance de vos prochaines sorties."
            />
          )}
          <Button title="Gérer mes paires" icon="footsteps-outline" secondary onPress={onShoes} />
        </>
      )}
    </Screen>
  );
}
