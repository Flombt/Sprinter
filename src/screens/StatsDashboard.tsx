import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { km, runDate } from '../core/format';
import type { RunRecord } from '../core/types';
import { distanceDashboard, type DashboardPeriod } from '../progression/distanceDashboard';
import { dayKey, monday } from '../progression/dates';
import { exampleRuns } from '../progression/exampleRuns';
import { useLocalNow, useProgression } from '../progression/hooks';
import {
  Button,
  Copy,
  EmptyState,
  Header,
  IconButton,
  Label,
  Screen,
  SectionHeading,
} from '../ui/components';
import { ChoiceGroup } from '../ui/controls';
import { DetailRow } from '../ui/editorial';
import { move } from '../ui/motion';
import { RunRow } from '../ui/RunRow';
import { SettingsDisclosure } from '../ui/settings';
import { useAdaptiveLayout, useTheme } from '../ui/theme';
import { editorial, interaction, layout, motionDuration, radii, spacing } from '../ui/tokens';

export type StatsNavigation = {
  onHistory: () => void;
  onDetail: (run: RunRecord) => void;
  onExample: (id: string) => void;
  onRecords: () => void;
  onProgression: () => void;
  onShoes: () => void;
  onCompare: () => void;
};

const periods = [
  ['week', 'Semaine'],
  ['month', 'Mois'],
  ['year', 'Année'],
] as const;
const titles = { week: 'Cette semaine', month: 'Ce mois-ci', year: 'Cette année' };

function DistanceChart({
  data,
  period,
}: {
  data: ReturnType<typeof distanceDashboard>;
  period: DashboardPeriod;
}) {
  const { largeText, width } = useAdaptiveLayout();
  const { reduceMotion } = useTheme();
  const reveal = useRef(new Animated.Value(1)).current;
  const [selected, select] = useState<string>();
  const bucketInfo = data.bins.find(({ start }) => selected === start);
  const max = Math.max(1, ...data.bins.map(({ meters }) => meters));
  const chartKey = data.bins.map(({ start, meters }) => start + ':' + meters).join('|');
  const interactive =
    !largeText && width >= data.bins.length * layout.touch + layout.screenGutter * 2 + spacing.xxxl;
  useEffect(() => {
    if (reduceMotion) {
      reveal.setValue(1);
      return;
    }
    reveal.setValue(0.5);
    const animation = move(reveal, 1, motionDuration.chart);
    animation.start();
    return () => animation.stop();
  }, [chartKey, reduceMotion, reveal]);
  const count = data.total.outings;
  const days = data.total.activeDays;
  const delta =
    data.previous.meters > 0
      ? Math.round(((data.total.meters - data.previous.meters) / data.previous.meters) * 100)
      : null;
  return (
    <View style={styles.board}>
      <View style={styles.chartTitle}>
        <View style={{ flexShrink: 1 }}>
          <Label style={styles.inverseMuted}>{titles[period]}</Label>
          <Copy variant="editorialNumber" style={styles.inverse}>
            {km(data.total.meters)}{' '}
            <Copy variant="section" style={styles.inverse}>
              km
            </Copy>
          </Copy>
        </View>
        <Copy variant="caption" style={styles.inverseMuted}>
          {count} sortie{count !== 1 ? 's' : ''}
        </Copy>
      </View>
      <View style={[styles.chart, largeText && styles.chartList]}>
        {data.bins.map((bin) => {
          const focused = selected === bin.start;
          const label = bin.description + ', ' + km(bin.meters) + ' kilomètres';
          const bar = (
            <>
              {!largeText && (
                <View style={styles.barSlot}>
                  {bin.meters > 0 && (
                    <Animated.View
                      style={[
                        styles.bar,
                        {
                          height: Math.max(3, (bin.meters / max) * 55),
                          opacity: reveal,
                          transform: [{ scaleY: reveal }],
                          backgroundColor: focused ? editorial.ink : editorial.graph,
                        },
                      ]}
                    />
                  )}
                </View>
              )}
              <Copy
                variant={largeText ? 'bodyCompact' : 'small'}
                style={[styles.inverseMuted, { textAlign: largeText ? 'left' : 'center' }]}
              >
                {largeText ? bin.description + ' · ' + km(bin.meters) + ' km' : bin.label}
              </Copy>
            </>
          );
          return interactive ? (
            <Pressable
              key={bin.start}
              accessibilityRole="button"
              accessibilityLabel={label}
              accessibilityState={{ selected: focused }}
              onPress={() => select(focused ? undefined : bin.start)}
              style={({ pressed }) => [styles.column, pressed && { opacity: interaction.pressedOpacity }]}
            >
              {bar}
            </Pressable>
          ) : (
            <View
              key={bin.start}
              accessible
              accessibilityLabel={label}
              style={largeText ? styles.listItem : styles.column}
            >
              {bar}
            </View>
          );
        })}
      </View>
      <Copy variant="caption" accessibilityLiveRegion="polite" style={styles.inverseMuted}>
        {bucketInfo
          ? bucketInfo.description + ' · ' + km(bucketInfo.meters) + ' km'
          : days +
            (days === 1 ? ' jour couru' : ' jours courus') +
            (delta === null
              ? ''
              : ' · ' + (delta > 0 ? '+' : '') + delta + ' % vs période précédente à date comparable')}
      </Copy>
    </View>
  );
}

export default function StatsDashboard({
  history,
  hasRun,
  active,
  onRunSettings,
  onStart,
  onHistory,
  onDetail,
  onExample,
  onRecords,
  onProgression,
  onShoes,
  onCompare,
}: StatsNavigation & {
  history: RunRecord[];
  hasRun: boolean;
  active: boolean;
  onRunSettings: () => void;
  onStart: () => void;
}) {
  const [period, setPeriod] = useState<DashboardPeriod>('week');
  const clock = useLocalNow(active);
  const dashboard = useMemo(() => distanceDashboard(history, period, clock), [history, period, clock]);
  const { data } = useProgression();
  const goal = data.goals.find((value) => value.week === monday(dayKey(clock)));
  const goalDetail = goal
    ? [
        goal.distanceMeters !== null ? km(goal.distanceMeters) + ' km' : null,
        goal.outings !== null ? goal.outings + (goal.outings === 1 ? ' sortie' : ' sorties') : null,
      ]
        .filter(Boolean)
        .join(' · ')
    : '';
  return (
    <Screen gap={spacing.lg}>
      <Header
        editorial
        title="Progrès"
        right={<IconButton square icon="time-outline" label="Historique" onPress={onHistory} />}
      />
      <ChoiceGroup value={period} onChange={setPeriod} label="Période" choices={periods} pills />
      {dashboard.total.outings ? (
        <>
          <DistanceChart data={dashboard} period={period} key={period} />
          {dashboard.latest && (
            <View style={{ gap: spacing.xs }}>
              <SectionHeading editorial title="Dernière sortie" action="Historique" onPress={onHistory} />
              <RunRow run={dashboard.latest} onPress={() => onDetail(dashboard.latest!)} compact />
            </View>
          )}
        </>
      ) : (
        <EmptyState
          icon="footsteps-outline"
          title={history.length ? 'Aucune sortie sur cette période' : 'À la première sortie'}
          body={
            history.length
              ? 'Changez de période ou retrouvez vos courses dans l’historique.'
              : 'Vos sorties, vos distances et vos records apparaîtront ici.'
          }
          action={
            <Button
              title={history.length ? 'Voir l’historique' : 'Aller à Courir'}
              endIcon="arrow-forward"
              onPress={history.length ? onHistory : onStart}
            />
          }
        />
      )}
      <View>
        <DetailRow
          title="Plans et objectifs"
          detail={goalDetail ? 'Objectif de la semaine : ' + goalDetail : 'Calendrier, plans et objectifs'}
          icon="flag-outline"
          onPress={onProgression}
        />
        <DetailRow
          title="Records"
          detail="Meilleurs temps vérifiés"
          icon="trophy-outline"
          onPress={onRecords}
        />
        <DetailRow
          title="Chaussures"
          detail="Paires et kilométrage"
          icon="footsteps-outline"
          onPress={onShoes}
        />
        <DetailRow
          title="Comparer deux sorties"
          icon="stats-chart-outline"
          onPress={onCompare}
          disabled={history.length < 2}
        />
        <DetailRow
          title={hasRun ? 'Détails et réglages de course' : 'Réglages de course'}
          icon="options-outline"
          onPress={onRunSettings}
          rule={false}
        />
      </View>
      <SettingsDisclosure title="Activités d’exemple" icon="map-outline">
        {exampleRuns.map(({ title, run }) => (
          <DetailRow
            key={run.id}
            title={title}
            detail={runDate(run.startedAt) + ' · Activité fictive'}
            icon="map-outline"
            onPress={() => onExample(run.id)}
          />
        ))}
      </SettingsDisclosure>
    </Screen>
  );
}

const styles = StyleSheet.create({
  board: {
    backgroundColor: editorial.surface,
    borderRadius: radii.card,
    padding: spacing.lg,
    gap: spacing.md,
  },
  chartTitle: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  inverse: { color: editorial.ink },
  inverseMuted: { color: editorial.secondary },
  chart: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: editorial.secondary,
    paddingTop: spacing.sm,
  },
  chartList: { flexDirection: 'column', gap: spacing.xs },
  column: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'flex-end',
    minHeight: layout.touch,
    gap: spacing.xs,
  },
  barSlot: {
    width: 22,
    maxWidth: '85%',
    height: 58,
    borderBottomWidth: 2,
    borderColor: '#739589',
    borderRadius: 4,
    justifyContent: 'flex-end',
  },
  bar: { width: '100%', borderRadius: 4, transformOrigin: 'center bottom' },
  listItem: { paddingVertical: spacing.xs },
});
