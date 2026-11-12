import { useMemo } from 'react';
import { activityAnalysis } from '../analysis/cache';
import { runRecords } from '../analysis/records';
import { duration, km, pace } from '../core/format';
import { exampleRuns } from '../progression/exampleRuns';
import {
  Copy,
  EmptyState,
  Header,
  Metric,
  MetricGrid,
  Panel,
  Screen,
  SectionHeading,
} from '../ui/components';
import { PaceChart } from '../ui/PaceChart';
import RouteMap from '../ui/RouteMap';
import { spacing } from '../ui/tokens';

export default function ExampleDetail({ id, onBack }: { id: string; onBack: () => void }) {
  const example = exampleRuns.find(({ run }) => run.id === id);
  const run = example?.run;
  const analysis = useMemo(() => run && activityAnalysis(run), [run]);
  const segments = useMemo(
    () => (run ? runRecords(run).filter((record) => record.meters <= 500) : []),
    [run],
  );
  return (
    <Screen>
      <Header title={example?.title ?? 'Exemple indisponible'} subtitle="Activité fictive" onBack={onBack} />
      {run && analysis ? (
        <>
          <Panel>
            <MetricGrid>
              <Metric label="Distance" value={km(run.distanceMeters)} unit="km" />
              <Metric label="Temps actif" value={duration(run.activeSeconds)} />
              <Metric label="Allure moyenne" value={pace(analysis.averagePace)} unit="/km" />
            </MetricGrid>
          </Panel>
          <SectionHeading title="Parcours simulé" />
          <RouteMap points={analysis.mapPoints} interactive />
          <SectionHeading title="Évolution de l’allure" />
          <Panel>
            <PaceChart run={run} analysis={analysis} />
          </Panel>
          <SectionHeading title="Meilleurs passages simulés" />
          <Panel style={{ gap: spacing.md }}>
            <MetricGrid>
              {segments.map((segment) => (
                <Metric
                  key={segment.meters}
                  label={`${segment.meters} m`}
                  value={duration(segment.seconds)}
                />
              ))}
            </MetricGrid>
            <Copy muted variant="caption">
              Ces passages sont exclus de vos records personnels.
            </Copy>
          </Panel>
        </>
      ) : (
        <EmptyState
          icon="map-outline"
          title="Tracé introuvable"
          body="Revenez à la liste des activités fictives."
        />
      )}
    </Screen>
  );
}
