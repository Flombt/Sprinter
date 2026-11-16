import { Pressable, StyleSheet, View } from 'react-native';
import type { RunRecord } from '../core/types';
import { averagePace, duration, km, pace, runDate } from '../core/format';
import { CHALLENGE_STATUS } from '../workouts/types';
import { Copy, Icon, Label } from './components';
import { paceReadout } from './editorial';
import { RouteTrace } from './RouteTrace';
import { useAdaptiveLayout, useTheme } from './theme';
import { interaction, radii, spacing } from './tokens';

export function RunRow({
  run,
  onPress,
  compact = false,
}: {
  run: RunRecord;
  onPress: () => void;
  compact?: boolean;
}) {
  const { colors } = useTheme();
  const { largeText } = useAdaptiveLayout();
  const split = compact && !largeText;
  const date = runDate(run.startedAt);
  const name = run.workout?.definition.name ?? 'Sortie du ' + date;
  const average = paceReadout(pace(averagePace(run)));
  const performance = km(run.distanceMeters) + ' km · ' + duration(run.activeSeconds);
  const paceLabel = average === '—' ? 'Allure indisponible' : average + ' /km';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[
        name,
        performance,
        paceLabel,
        run.points.length ? 'Tracé GPS disponible' : 'Aucun tracé GPS',
      ].join(', ')}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        split && styles.split,
        {
          borderColor: colors.line,
          backgroundColor: colors.surface,
          opacity: pressed ? interaction.pressedOpacity : 1,
        },
      ]}
    >
      {(!compact || !largeText) && (
        <View style={split ? styles.preview : undefined}>
          <RouteTrace points={run.points} height={split ? 96 : 105} />
        </View>
      )}
      <View style={styles.details}>
        <View style={styles.copy}>
          <Label numberOfLines={largeText ? undefined : 1}>{date}</Label>
          <Copy variant="emphasis">{name}</Copy>
          <Copy muted variant="caption">
            {performance}
            {!compact && average !== '—' ? ' · ' + paceLabel : ''}
          </Copy>
          {run.healthKit && (
            <Copy muted variant="small">
              Santé · {run.healthKit.sourceName}
            </Copy>
          )}
          {run.workout && !compact && (
            <Copy muted variant="small">
              {CHALLENGE_STATUS[run.workout.challengeStatus]}
            </Copy>
          )}
        </View>
        <Icon name="chevron-forward" size={17} color={colors.accentText} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderRadius: radii.card },
  split: { flexDirection: 'row', alignItems: 'center' },
  preview: { width: '31%', alignSelf: 'center' },
  details: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    padding: spacing.md,
    alignItems: 'center',
    gap: spacing.sm,
  },
  copy: { flex: 1, minWidth: 0, gap: spacing.xs },
});
