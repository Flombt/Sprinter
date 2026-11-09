import { useMemo } from 'react';
import { ScrollView, View } from 'react-native';
import type { RunRecord } from '../core/types';
import { duration, km } from '../core/format';
import type { SessionState } from '../services/session';
import { Copy, Divider, Hero, Icon, Label, ListRow, Metric, MetricGrid, Panel, Screen, SectionHeading, styles } from '../ui/components';
import { useAdaptiveLayout, useTheme } from '../ui/theme';
import { radii, spacing } from '../ui/tokens';
import { RunRow } from '../ui/RunRow';
import { aggregate, recordedRun } from '../progression/aggregates';
import { addDays, dateOf, dayKey, dayStart, monday } from '../progression/dates';
import { useLocalNow, useProgression } from '../progression/hooks';
import type { WeeklyGoal } from '../progression/types';
export { RunRow } from '../ui/RunRow';

interface WeekDay {
  key: string; label: string; meters: number; outings: number; isToday: boolean; isFuture: boolean;
}
const DAY_NAMES = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

function WeekActivity({ days }: { days: WeekDay[] }) {
  const { colors } = useTheme(); const { largeText, fontScale } = useAdaptiveLayout();
  const maximum = Math.max(1, ...days.map(day => day.meters));
  const columns = days.map((day, index) => <View key={day.key} accessible
    accessibilityLabel={`${day.label}${day.isToday ? ', aujourd’hui' : ''}, ${day.isFuture ? 'à venir' : `${km(day.meters)} kilomètres, ${day.outings} ${day.outings === 1 ? 'sortie' : 'sorties'}`}`}
    style={{ ...(largeText ? { width: 48 * fontScale } : { flex: 1, minWidth: 0 }), alignItems: 'center', gap: spacing.sm }}>
    <View style={{ height: 40, width: '100%', justifyContent: 'flex-end' }}>
      {!day.isFuture && <View style={{ height: day.meters > 0 ? Math.max(6, day.meters / maximum * 40) : 2,
        borderRadius: radii.sm, backgroundColor: day.meters > 0 ? colors.accentText : colors.line }} />}
    </View>
    <View style={{ paddingHorizontal: spacing.xs, paddingVertical: spacing.xs, borderRadius: radii.sm, backgroundColor: day.isToday ? colors.accentSoft : 'transparent' }}>
      <Copy variant="small" style={{ color: day.isToday ? colors.accentText : colors.secondary, fontWeight: day.isToday ? '700' : '500' }}>{DAY_NAMES[index]}</Copy>
    </View>
  </View>);
  return <View style={{ gap: spacing.sm }}><Label>Distance par jour</Label>
    {largeText ? <ScrollView horizontal contentContainerStyle={{ gap: spacing.sm, paddingBottom: spacing.xs }}>{columns}</ScrollView>
      : <View style={[styles.row, { alignItems: 'flex-end', gap: spacing.sm }]}>{columns}</View>}
  </View>;
}

function GoalProgress({ label, current, target, value }: { label: string; current: number; target: number; value: string }) {
  const { colors } = useTheme();
  const percentage = Math.min(100, Math.max(0, Math.floor(current / target * 100)));
  return <View style={{ gap: spacing.sm }}>
    <View style={[styles.row, { justifyContent: 'space-between', flexWrap: 'wrap', gap: spacing.xs }]}>
      <Copy variant="caption" muted>{label}</Copy><Copy variant="caption" style={{ fontWeight: '600' }}>{value}{current >= target ? ' · atteint' : ''}</Copy>
    </View>
    <View accessible accessibilityRole="progressbar" accessibilityLabel={`${label}, ${value}${current >= target ? ', atteint' : ''}`}
      accessibilityValue={{ min: 0, max: 100, now: percentage, text: `${percentage} %` }}
      style={{ height: 5, borderRadius: radii.pill, backgroundColor: colors.line, overflow: 'hidden' }}>
      <View style={{ height: '100%', width: `${percentage}%`, backgroundColor: colors.accentText }} />
    </View>
  </View>;
}

function WeeklySummary({ stats, days, range, goal, emptyMessage }: {
  stats: ReturnType<typeof aggregate>; days: WeekDay[]; range: string; goal?: WeeklyGoal; emptyMessage: string;
}) {
  const { colors } = useTheme();
  const distanceGoal = goal?.distanceMeters ?? 0, outingsGoal = goal?.outings ?? 0;
  const hasDistanceGoal = Number.isFinite(distanceGoal) && distanceGoal > 0, hasOutingsGoal = Number.isFinite(outingsGoal) && outingsGoal > 0;
  return <Panel variant="metric" style={{ gap: spacing.lg }}>
    <View style={{ gap: spacing.xs }}><Copy variant="section" accessibilityRole="header">Cette semaine</Copy><Copy variant="caption" muted>{range}</Copy></View>
    <MetricGrid><Metric label="Distance" value={km(stats.meters, 1)} unit="km" large /><Metric label="Temps actif" value={duration(stats.activeSeconds)} /></MetricGrid>
    <View style={[styles.row, { flexWrap: 'wrap', gap: spacing.md, justifyContent: 'space-between' }]}>
      <View style={[styles.row, { gap: spacing.sm }]}><Icon name="footsteps-outline" size={17} color={colors.accentText} />
        <Copy variant="emphasis">{stats.outings} {stats.outings === 1 ? 'sortie' : 'sorties'}</Copy></View>
      <Copy variant="caption" muted>{stats.activeDays} {stats.activeDays === 1 ? 'jour avec sortie' : 'jours avec sortie'}</Copy>
    </View>
    <Divider />
    {stats.outings > 0 ? <WeekActivity days={days} /> : <Copy variant="caption" muted>{emptyMessage}</Copy>}
    {(hasDistanceGoal || hasOutingsGoal) && <View style={{ gap: spacing.md }}><Label>Vos objectifs de semaine</Label>
      {hasDistanceGoal && <GoalProgress label="Distance" current={stats.meters} target={distanceGoal} value={`${km(stats.meters)} / ${km(distanceGoal, 1)} km`} />}
      {hasOutingsGoal && <GoalProgress label="Sorties" current={stats.outings} target={outingsGoal} value={`${stats.outings} / ${outingsGoal}`} />}
    </View>}
  </Panel>;
}

export default function Home({ state, onStart, onHistory, onDetail, onProgression }: { state: SessionState; onStart: () => void; onHistory: () => void; onDetail: (run: RunRecord) => void; onProgression?: () => void }) {
  const { largeText } = useAdaptiveLayout(), progress = useProgression(), clock = useLocalNow();
  const week = useMemo(() => {
    // Refresh on history commits as well as the local clock: a just-finished run appears immediately.
    const now = Date.now(), today = dayKey(now), start = monday(today), end = addDays(start, 6);
    const stats = aggregate(state.history, dayStart(start), Math.min(dayStart(addDays(start, 7)), now + 1), now);
    const daily = new Map<string, { meters: number; outings: number }>();
    for (const run of stats.runs) { const key = dayKey(run.startedAt), day = daily.get(key) ?? { meters: 0, outings: 0 };
      day.meters += run.distanceMeters; day.outings++; daily.set(key, day); }
    const days = Array.from({ length: 7 }, (_, i): WeekDay => { const key = addDays(start, i); return {
      key, label: dateOf(key).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }),
      meters: daily.get(key)?.meters ?? 0, outings: daily.get(key)?.outings ?? 0, isToday: key === today, isFuture: key > today,
    }; });
    const shortDate = (day: string) => dateOf(day).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
    return { stats, days, start, range: `Du ${shortDate(start)} au ${shortDate(end)}`,
      today: dateOf(today).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'short' }),
      latest: state.history.find(run => recordedRun(run) && run.endedAt! <= now) ?? null };
  }, [state.history, clock]);
  const goal = progress.ready ? progress.data.goals.find(value => value.week === week.start) : undefined;
  const run = state.run, latest = week.latest;
  const heroTitle = !run ? undefined : state.restored ? 'Course récupérée.' : state.autoPaused ? 'Pause automatique.' : state.running ? 'Course en cours.' : 'Course en pause.';
  const heroDescription = run ? `${km(run.distanceMeters)} km · ${duration(run.activeSeconds)} de temps actif.${state.restored ? ' Récupérée en pause.' : ''}` : undefined;
  const emptyWeek = run ? 'Votre course sera ajoutée au bilan une fois terminée et enregistrée.'
    : state.unreadableCount > 0 ? 'Ce bilan utilise les sorties lisibles. Consultez l’historique pour les activités indisponibles.'
      : state.history.length ? 'Votre prochaine sortie complétera le bilan de cette semaine.' : 'Votre première sortie lancera ce bilan : distance, temps de course et régularité.';
  return <Screen>
    <View style={{ flexDirection: largeText ? 'column' : 'row', alignItems: largeText ? 'flex-start' : 'baseline', justifyContent: 'space-between', gap: spacing.sm }}>
      <Copy variant="heading" accessibilityRole="header" accessibilityLabel="Sprinter, Courir">sprinter</Copy><Copy variant="caption" muted>{week.today}</Copy>
    </View>
    <Hero onStart={onStart} hasRun={run !== null} title={heroTitle} description={heroDescription} />
    <WeeklySummary stats={week.stats} days={week.days} range={week.range} goal={goal} emptyMessage={emptyWeek} />
    {onProgression && <ListRow icon="calendar-outline" title="Progression & calendrier" onPress={onProgression}
      label="Ouvrir ma progression et mon calendrier : objectifs, records et prochaines séances."
      subtitle={<Copy variant="caption" muted>Vos objectifs, vos records et vos prochaines séances.</Copy>} />}
    {latest && <View style={{ gap: spacing.sm }}><SectionHeading title="Dernière sortie" action="Tout voir" onPress={onHistory} />
      <RunRow run={latest} onPress={() => onDetail(latest)} />
    </View>}
    {state.unreadableCount > 0 && <ListRow icon="alert-circle-outline" title="Consulter mon historique" onPress={onHistory}
      subtitle={<Copy variant="caption" muted>{state.unreadableCount} {state.unreadableCount === 1 ? 'activité conservée mais indisponible' : 'activités conservées mais indisponibles'}. Vos données restent enregistrées.</Copy>} />}
  </Screen>;
}
