import { useMemo } from 'react';
import { View } from 'react-native';
import type { RunRecord } from '../core/types';
import { averagePace, duration, km, pace, runDate } from '../core/format';
import { CHALLENGE_STATUS } from '../workouts/types';
import { Copy, ListRow } from './components';
import { RunnerGlyph } from './design';
import { useTheme } from './theme';
import { spacing } from './tokens';

export function RunRow({ run, onPress, detailed = false }: { run: RunRecord; onPress: () => void; detailed?: boolean }) {
  const { colors } = useTheme();
  const date = useMemo(() => {
    if (!detailed) return '';
    const started = new Date(run.startedAt);
    return Number.isFinite(started.getTime()) ? started.toLocaleString('fr-FR', {
      day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    }) : 'Date indisponible';
  }, [detailed, run.startedAt]);
  const average = pace(averagePace(run));
  return <ListRow icon={<RunnerGlyph size={22} color={colors.accentText} />} title={`${km(run.distanceMeters)} km`} onPress={onPress}
    label={detailed ? `Course du ${date}, ${km(run.distanceMeters)} kilomètres, ${duration(run.activeSeconds)} de temps actif, ${average === '—' ? 'allure moyenne indisponible' : `allure moyenne ${average} par kilomètre`}`
      : `Course du ${runDate(run.startedAt)}, ${km(run.distanceMeters)} kilomètres, ${duration(run.activeSeconds)}, allure ${average} par kilomètre`}
    subtitle={<View style={{ gap: spacing.xs }}><Copy variant="caption" muted>{detailed ? date : `${runDate(run.startedAt)} · ${duration(run.activeSeconds)}`}</Copy>
      {detailed && <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
        <Copy variant="caption">Actif · {duration(run.activeSeconds)}</Copy><Copy variant="caption">{average} /km</Copy>
      </View>}
      {run.healthKit && <Copy variant="small" muted>Santé · {run.healthKit.sourceName}</Copy>}
      {run.workout && <Copy variant="small" muted>{run.workout.definition.name} · {CHALLENGE_STATUS[run.workout.challengeStatus]}</Copy>}</View>}
    trailing={detailed ? undefined : <View style={{ gap: spacing.xs }}><Copy variant="emphasis">{average}</Copy><Copy variant="small" muted>/km</Copy></View>} />;
}
