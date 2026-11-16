import { useMemo } from 'react';
import { View } from 'react-native';
import { activityAnalysis } from '../analysis/cache';
import { personalRecords, runRecords } from '../analysis/records';
import { duration, km, pace } from '../core/format';
import type { RunRecord } from '../core/types';
import { ActivityGpxButton, ActivitySharing } from '../sharing/components';
import { Button, Copy, Header, Screen } from '../ui/components';
import { DetailRow, MeasureStrip, paceReadout } from '../ui/editorial';
import { RouteTrace } from '../ui/RouteTrace';
import { SettingsDisclosure } from '../ui/settings';
import { useTheme } from '../ui/theme';
import { radii, spacing } from '../ui/tokens';
import { workoutRecords } from '../workouts/records';

export default function RunSummary({
  run,
  history,
  onBack,
  onDetail,
  onHistory,
}: {
  run: RunRecord;
  history: RunRecord[];
  onBack: () => void;
  onDetail: () => void;
  onHistory: () => void;
}) {
  const { colors } = useTheme();
  const analysis = useMemo(() => activityAnalysis(run), [run]);
  const record = useMemo(() => {
    const others = history.filter((item) => item.id !== run.id);
    const attempts = [...others, run];
    const best = personalRecords(attempts.flatMap(runRecords)).find((item) => item.best?.runId === run.id);
    if (best) return 'Record personnel · ' + best.label;
    const bestWorkout = workoutRecords(attempts).find((group) => group.attempts[0]?.id === run.id);
    return bestWorkout ? 'Record de séance · ' + bestWorkout.name : null;
  }, [history, run]);
  return (
    <Screen
      gap={spacing.lg}
      footer={
        <>
          <Button title="Voir le détail" endIcon="arrow-forward" onPress={onDetail} />
          <Button title="Retour à Courir" variant="quiet" onPress={onBack} />
        </>
      }
    >
      <Header editorial title="Bilan de sortie" subtitle="Sortie enregistrée" />
      <View
        style={{
          overflow: 'hidden',
          borderRadius: radii.card,
          borderWidth: 1,
          borderColor: colors.line,
          backgroundColor: colors.surface,
        }}
      >
        <RouteTrace points={analysis.mapPoints} height={200} emptyLabel="Aucun tracé GPS exploitable" />
        {analysis.mapPoints.length > 0 && (
          <Copy muted variant="caption" style={{ padding: spacing.md }}>
            Tracé GPS enregistré
          </Copy>
        )}
      </View>
      <MeasureStrip
        items={[
          { label: 'Distance', value: km(run.distanceMeters), unit: 'km' },
          { label: 'Temps actif', value: duration(run.activeSeconds) },
          {
            label: 'Allure moyenne',
            shortLabel: 'Allure moy.',
            value: paceReadout(pace(analysis.averagePace)),
            unit: '/km',
          },
        ]}
      />
      {record && (
        <Copy variant="emphasis" accessibilityLiveRegion="polite">
          {record}
        </Copy>
      )}
      <DetailRow title="Retrouver dans l’historique" icon="time-outline" onPress={onHistory} />
      <SettingsDisclosure title="Partager et exporter" icon="share-outline">
        {run.endedAt !== null && run.points.length > 0 && <ActivityGpxButton run={run} />}
        <ActivitySharing run={run} />
      </SettingsDisclosure>
    </Screen>
  );
}
