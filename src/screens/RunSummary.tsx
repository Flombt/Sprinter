import { SaveRunsNudge } from '../account/ui/SaveRunsNudge';
import { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, Platform, View, useWindowDimensions } from 'react-native';
import { activityAnalysis } from '../analysis/cache';
import { paceRoute } from '../analysis/paceRoute';
import { personalRecords, runRecords } from '../analysis/records';
import { duration, km, pace } from '../core/format';
import type { RunRecord } from '../core/types';
import { ActivityGpxButton, ActivitySharing } from '../sharing/components';
import { Button, Copy, Header, Label, MetricGrid, Panel, Screen } from '../ui/components';
import RouteMap from '../ui/RouteMap';
import { SettingsDisclosure } from '../ui/settings';
import { useAdaptiveLayout, useTheme } from '../ui/theme';
import { spacing, typography } from '../ui/tokens';
import { workoutRecords } from '../workouts/records';

const steps = 12;

function SummaryMetric({
  label,
  value,
  format,
}: {
  label: string;
  value: number | null;
  format: (value: number) => string;
}) {
  const { reduceMotion } = useTheme();
  const { largeText } = useAdaptiveLayout();
  const { fontScale } = useWindowDimensions();
  const progress = useRef(new Animated.Value(0)).current;
  const animate = !reduceMotion && !largeText && value !== null && value > 0;
  const formatted = value === null ? '—' : format(value);
  const lineHeight = Math.ceil(typography.metricLarge.lineHeight * fontScale);

  useEffect(() => {
    if (!animate) return;
    progress.setValue(0);
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: 600,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: Platform.OS !== 'web',
    });
    animation.start();
    return () => animation.stop();
  }, [animate, progress]);

  return (
    <View accessible accessibilityLabel={label + ' ' + formatted} style={{ gap: spacing.xs }}>
      <Label>{label}</Label>
      {animate ? (
        <View
          aria-hidden
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={{ height: lineHeight, overflow: 'hidden' }}
        >
          <Animated.View
            style={{ transform: [{ translateY: Animated.multiply(progress, -lineHeight * steps) }] }}
          >
            {Array.from({ length: steps + 1 }, (_, index) => (
              <Copy
                key={index}
                variant="metricLarge"
                numberOfLines={1}
                adjustsFontSizeToFit
                style={{ height: lineHeight }}
              >
                {format((value * index) / steps)}
              </Copy>
            ))}
          </Animated.View>
        </View>
      ) : (
        <Copy variant="metricLarge">{formatted}</Copy>
      )}
    </View>
  );
}

export default function RunSummary({
  run,
  history,
  onBack,
  onDetail,
}: {
  run: RunRecord;
  history: RunRecord[];
  onBack: () => void;
  onDetail: () => void;
}) {
  const analysis = useMemo(() => activityAnalysis(run), [run]);
  const paceParts = useMemo(() => paceRoute(run, analysis.mapPoints), [analysis.mapPoints, run]);
  const record = useMemo(() => {
    const others = history.filter((item) => item.id !== run.id);
    const attempts = [...others, run];
    const best = personalRecords(attempts.flatMap(runRecords)).find((item) => item.best?.runId === run.id);
    if (best) return 'Record personnel · ' + best.label;
    const bestWorkout = workoutRecords(attempts).find((group) => group.attempts[0]?.id === run.id);
    return bestWorkout ? 'Record de séance · ' + bestWorkout.name : null;
  }, [history, run]);

  return (
    <Screen>
      <Header title="Course enregistrée" onBack={onBack} />
      <SaveRunsNudge runs={history.length} />
      <Panel variant="metric" style={{ gap: spacing.lg }}>
        <SummaryMetric label="Distance · km" value={run.distanceMeters} format={km} />
        <MetricGrid>
          <SummaryMetric label="Temps actif" value={run.activeSeconds} format={duration} />
          <SummaryMetric
            label="Allure moyenne · min/km"
            value={analysis.averagePace}
            format={(seconds) => (seconds === 0 ? '0:00' : pace(seconds))}
          />
        </MetricGrid>
        {record && (
          <Copy variant="emphasis" accessibilityLiveRegion="polite">
            {record}
          </Copy>
        )}
      </Panel>
      {analysis.mapPoints.length > 0 && (
        <RouteMap points={analysis.mapPoints} paceParts={paceParts} height={220} interactive />
      )}
      {run.endedAt !== null && run.points.length > 0 && <ActivityGpxButton run={run} />}
      <Button title="Voir le détail" arrow icon="stats-chart-outline" onPress={onDetail} />
      <SettingsDisclosure title="Partager" icon="share-outline">
        <ActivitySharing run={run} />
      </SettingsDisclosure>
    </Screen>
  );
}
