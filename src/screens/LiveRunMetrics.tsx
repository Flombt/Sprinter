import { StyleSheet, View } from 'react-native';
import { averagePace, duration, km, pace, targetLabel } from '../core/format';
import type { RunRecord } from '../core/types';
import { paceTargetAt } from '../pacing/goals';
import type { SessionState } from '../services/session';
import { Copy, Label, NumericReadout } from '../ui/components';
import { PaceGauge } from '../ui/PaceGauge';
import { useAdaptiveLayout, useTheme } from '../ui/theme';
import { spacing, typography } from '../ui/tokens';
import { effectiveTarget, segmentTarget } from '../workouts/definition';

function RunValue({ label, value }: { label: string; value: string }) {
  return <View accessible accessibilityLabel={label + ' ' + value} style={styles.value}>
    <Copy variant="metric" style={styles.center}>{value}</Copy>
    <Label style={styles.label}>{label}</Label>
  </View>;
}

export function LiveRunMetrics({ run, state, expanded }: {
  run: RunRecord;
  state: SessionState;
  expanded: boolean;
}) {
  const { colors } = useTheme();
  const { largeText } = useAdaptiveLayout();
  const workout = run.workout;
  const block = workout?.segments[workout.currentIndex]?.planned;
  const courseTarget = workout ? null : paceTargetAt(run.target, run.distanceMeters);
  const target = workout ? (block && workout.status !== 'abandoned' ? effectiveTarget(block) : null)
    : courseTarget;
  const value = pace(state.pace);
  const targetText = block && target ? segmentTarget(block)
    : courseTarget ? targetLabel(courseTarget) + ' /km' : 'Allure libre';
  const targetTitle = block && target ? block.name
    : run.target.kilometerTargets && target ? 'Kilomètre ' + (Math.floor(run.distanceMeters / 1000) + 1) : 'Cible';

  return <View style={styles.container}>
    {!expanded && <>
      <View style={styles.hero}>
        <Label style={styles.label}>Allure actuelle · min/km</Label>
        {largeText ? <NumericReadout variant="pace" value={value} style={styles.center} />
          : <Copy
            variant="pace"
            adjustsFontSizeToFit
            numberOfLines={1}
            accessibilityLabel={value === '—' ? 'Allure indisponible' : value + ' par kilomètre'}
            style={styles.center}
          >
            {value}
          </Copy>}
      </View>
      <PaceGauge
        value={state.pace}
        target={target}
        tolerance={run.config.toleranceSeconds ?? 0}
        state={state.paceState}
        quality={state.quality}
        running={state.running}
        autoPaused={state.autoPaused}
      />
    </>}
    <View style={[styles.row, largeText && styles.stacked]}>
      {expanded && <RunValue label="Allure actuelle · /km" value={value} />}
      <RunValue label="Distance · km" value={km(run.distanceMeters)} />
      {!largeText && <View style={[styles.rule, { backgroundColor: colors.line }]} />}
      <RunValue label="Temps actif" value={duration(run.activeSeconds)} />
    </View>
    {!expanded && <View style={[styles.secondary, largeText && styles.stacked]}>
      <View style={styles.secondaryCell}>
        <Label style={styles.label}>Allure moyenne</Label>
        <Copy variant="caption" style={styles.center}>{pace(averagePace(run))} /km</Copy>
      </View>
      <View style={styles.secondaryCell}>
        <Label style={styles.label}>{targetTitle}</Label>
        <Copy variant="caption" style={styles.center}>{targetText}</Copy>
      </View>
    </View>}
  </View>;
}

const styles = StyleSheet.create({
  container: { gap: spacing.xs, paddingBottom: spacing.sm },
  hero: { alignItems: 'center', paddingHorizontal: spacing.md },
  center: { textAlign: 'center' },
  label: { textAlign: 'center', fontSize: typography.caption.fontSize },
  row: { flexDirection: 'row', paddingHorizontal: spacing.sm, gap: spacing.sm },
  stacked: { flexDirection: 'column' },
  value: { flex: 1, minWidth: 0, alignItems: 'center', justifyContent: 'center' },
  rule: { width: StyleSheet.hairlineWidth, marginVertical: spacing.xs },
  secondary: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.sm },
  secondaryCell: { flex: 1, alignItems: 'center', justifyContent: 'center', minWidth: 0 },
});
