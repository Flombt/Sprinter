import { StyleSheet, View } from 'react-native';
import { averagePace, duration, km, pace, targetLabel } from '../core/format';
import type { RunRecord } from '../core/types';
import { paceTargetAt } from '../pacing/goals';
import type { SessionState } from '../services/session';
import { Copy, Label } from '../ui/components';
import { MeasureStrip, paceReadout } from '../ui/editorial';
import { PaceGauge } from '../ui/PaceGauge';
import { useAdaptiveLayout, useTheme } from '../ui/theme';
import { spacing } from '../ui/tokens';
import { effectiveTarget, segmentTarget } from '../workouts/definition';

export function LiveRunMetrics({
  run,
  state,
  expanded,
}: {
  run: RunRecord;
  state: SessionState;
  expanded: boolean;
}) {
  const { colors } = useTheme();
  const { largeText, compact } = useAdaptiveLayout();
  const workout = run.workout;
  const block = workout?.segments[workout.currentIndex]?.planned;
  const courseTarget = workout ? null : paceTargetAt(run.target, run.distanceMeters);
  const target = workout
    ? block && workout.status !== 'abandoned'
      ? effectiveTarget(block)
      : null
    : courseTarget;
  const measuredPace = state.quality === 'good' ? state.pace : null;
  const value = paceReadout(pace(measuredPace));
  const size = largeText ? (compact ? 60 : 68) : 96;
  const targetText =
    block && target
      ? segmentTarget(block)
      : courseTarget
        ? targetLabel(courseTarget) + ' /km'
        : 'Allure libre';
  const targetTitle =
    block && target
      ? block.name
      : run.target.kilometerTargets && target
        ? 'Kilomètre ' + (Math.floor(run.distanceMeters / 1000) + 1)
        : 'Cible';

  return (
    <View style={styles.container}>
      {!expanded && (
        <View style={[styles.instrument, { borderColor: colors.line }]}>
          <View style={styles.hero}>
            <Label style={styles.center}>Allure actuelle</Label>
            <Copy
              variant="editorialNumber"
              adjustsFontSizeToFit
              numberOfLines={1}
              maxFontSizeMultiplier={1.45}
              accessibilityLabel={
                value === '—' ? 'Allure indisponible' : pace(measuredPace) + ' par kilomètre'
              }
              style={[styles.center, { fontSize: size, lineHeight: Math.ceil(size * 1.03) }]}
            >
              {value}{' '}
              <Copy muted variant="section">
                /km
              </Copy>
            </Copy>
          </View>
          <PaceGauge
            value={measuredPace}
            target={target}
            tolerance={run.config.toleranceSeconds ?? 0}
            state={state.paceState}
            quality={state.quality}
            running={state.running}
            autoPaused={state.autoPaused}
            instrument
          />
        </View>
      )}
      <MeasureStrip
        items={[
          ...(expanded ? [{ label: 'Allure actuelle', value, unit: '/km' }] : []),
          { label: 'Distance', value: km(run.distanceMeters), unit: 'km' },
          { label: 'Temps actif', value: duration(run.activeSeconds) },
        ]}
      />
      {!expanded && workout && (
        <View style={[styles.secondary, largeText && styles.stacked]}>
          <View style={styles.secondaryCell}>
            <Label style={styles.center}>Allure moyenne</Label>
            <Copy variant="caption" style={styles.center}>
              {pace(averagePace(run))} /km
            </Copy>
          </View>
          <View style={styles.secondaryCell}>
            <Label style={styles.center}>{targetTitle}</Label>
            <Copy variant="caption" style={styles.center}>
              {targetText}
            </Copy>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.md },
  instrument: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: spacing.md,
  },
  hero: { alignItems: 'center', paddingHorizontal: spacing.xs },
  center: { textAlign: 'center' },
  stacked: { flexDirection: 'column' },
  secondary: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.sm },
  secondaryCell: { flex: 1, alignItems: 'center', justifyContent: 'center', minWidth: 0 },
});
