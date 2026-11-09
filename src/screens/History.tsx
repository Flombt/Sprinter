import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import type { SessionState } from '../services/session';
import type { RunRecord } from '../core/types';
import { duration, km } from '../core/format';
import { aggregate } from '../progression/aggregates';
import { useLocalNow } from '../progression/hooks';
import { Button, Copy, Divider, Header, Icon, IconButton, Label, Metric, MetricGrid, Panel, Screen, SectionHeading, styles, type IconName } from '../ui/components';
import { RunRow } from '../ui/RunRow';
import { useAdaptiveLayout, useTheme } from '../ui/theme';
import { layout, radii, spacing } from '../ui/tokens';

const PAGE_SIZE = 20;
const RECENT_COUNT = 3;

function AnalysisShortcut({ title, description, icon, onPress, disabled = false }: {
  title: string; description: string; icon: IconName; onPress: () => void; disabled?: boolean;
}) {
  const { colors } = useTheme(); const { largeText } = useAdaptiveLayout();
  return <Pressable accessibilityRole="button" accessibilityLabel={`${title}. ${description}`} accessibilityState={{ disabled }}
    disabled={disabled} onPress={onPress} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', minHeight: layout.touch,
      paddingVertical: spacing.sm, borderRadius: radii.control, backgroundColor: pressed ? colors.raised : 'transparent', gap: spacing.md })}>
    {!largeText && <Icon name={icon} size={22} color={disabled ? colors.secondary : colors.accentText} />}
    <View style={{ flex: 1, minWidth: 0, gap: spacing.xs }}>
      <Copy variant="emphasis" style={{ color: disabled ? colors.secondary : colors.text }}>{title}</Copy>
      <Copy variant="caption" muted>{description}</Copy>
    </View>
    <View style={{ opacity: disabled ? .35 : 1 }}><Icon name="chevron-forward" size={16} color={colors.secondary} /></View>
  </Pressable>;
}

function HistoryAnalysis({ count, onRecords, onCompare, onProgression }: {
  count: number; onRecords: () => void; onCompare: () => void; onProgression?: () => void;
}) {
  return <View style={{ gap: spacing.md }}><SectionHeading title="Analyser & progresser" />
    <Panel variant="list" style={{ gap: spacing.sm }}>
      <AnalysisShortcut title="Records personnels" description="Vos meilleurs segments GPS." icon="trophy-outline" onPress={onRecords} />
      <Divider />
      <AnalysisShortcut title="Comparer deux sorties" description={count < 2 ? 'Deux sorties minimum.' : 'À distance équivalente.'}
        icon="git-compare-outline" onPress={onCompare} disabled={count < 2} />
      {onProgression && <><Divider /><AnalysisShortcut title="Progression & calendrier" description="Objectifs, plans et régularité." icon="calendar-outline" onPress={onProgression} /></>}
    </Panel>
  </View>;
}

function HistoryOverview({ stats, count }: { stats: ReturnType<typeof aggregate>; count: number }) {
  const { colors } = useTheme();
  return <Panel variant="metric" style={{ gap: spacing.md }}>
    <View style={[styles.row, { justifyContent: 'space-between', flexWrap: 'wrap', gap: spacing.sm }]}>
      <Label>Cumul enregistré</Label><Copy variant="caption" muted>{count} {count === 1 ? 'sortie disponible' : 'sorties disponibles'}</Copy>
    </View>
    <MetricGrid><Metric label="Distance" value={km(stats.meters, 1)} unit="km" /><Metric label="Temps actif" value={duration(stats.activeSeconds)} /></MetricGrid>
    {stats.outings < count && <Copy variant="caption" style={{ color: colors.orange }}>
      {count - stats.outings} {count - stats.outings === 1 ? 'activité ne permet pas de calculer ce cumul.' : 'activités ne permettent pas de calculer ce cumul.'} Les sorties restent consultables.
    </Copy>}
  </Panel>;
}

function HistoryEmpty({ hasRun, unreadable, onStart }: { hasRun: boolean; unreadable: boolean; onStart: () => void }) {
  const { colors } = useTheme();
  return <Panel style={{ gap: spacing.lg }}>
    <View style={{ width: 48, height: 48, borderRadius: radii.control, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
      <Icon name="footsteps-outline" color={colors.accentText} size={25} />
    </View>
    <View style={{ gap: spacing.sm }}><Copy variant="heading" accessibilityRole="header">{hasRun ? 'Votre course vous attend.' : unreadable ? 'Aucune sortie affichable.' : 'Votre historique commence ici.'}</Copy>
      <Copy muted>{hasRun ? 'Votre course apparaîtra ici une fois terminée et enregistrée.' : unreadable
        ? 'Vos activités indisponibles restent conservées. Les prochaines sorties enregistrées rejoindront cet historique.'
        : 'Retrouvez après chaque course votre distance, votre temps actif, votre allure et les données de parcours disponibles.'}</Copy>
    </View>
    <Button title={hasRun ? 'Retrouver ma course' : 'Commencer une course'} icon={hasRun ? 'arrow-forward' : 'play'} onPress={onStart}
      hint={hasRun ? 'Ouvrir votre course et ses commandes.' : 'Ouvrir la préparation de votre prochaine course.'} />
  </Panel>;
}

export default function History({ state, onDetail, onStart, onRecords, onCompare, onProgression }: { state: SessionState; onDetail: (run: RunRecord) => void; onStart: () => void; onRecords: () => void; onCompare: () => void; onProgression?: () => void }) {
  const { colors } = useTheme(); const clock = useLocalNow(); const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const sorted = useMemo(() => [...state.history].sort((a, b) => b.startedAt - a.startedAt), [state.history]);
  const stats = useMemo(() => { const now = Date.now(); return aggregate(state.history, -Infinity, now + 1, now); }, [state.history, clock]);
  const recent = sorted.slice(0, RECENT_COUNT);
  const months = useMemo(() => {
    const groups = new Map<string, { title: string; runs: RunRecord[] }>();
    for (const run of sorted.slice(RECENT_COUNT, visibleCount)) {
      const date = new Date(run.startedAt), valid = Number.isFinite(date.getTime());
      const key = valid ? `${date.getFullYear()}-${date.getMonth()}` : 'unknown';
      const group: { title: string; runs: RunRecord[] } = groups.get(key) ?? { title: valid ? date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }) : 'Date indisponible', runs: [] };
      group.runs.push(run); groups.set(key, group);
    }
    return [...groups.entries()];
  }, [sorted, visibleCount]);
  const displayed = Math.min(visibleCount, sorted.length), remaining = Math.max(0, sorted.length - displayed);
  return <Screen><Header title="Vos sorties" subtitle="Historique & analyse" right={sorted.length > 0
    ? <IconButton icon={state.run ? 'arrow-forward' : 'add'} label={state.run ? 'Retrouver ma course' : 'Préparer une nouvelle course'} onPress={onStart} /> : undefined} />
    {state.unreadableCount > 0 && <Panel variant="list" style={{ gap: spacing.sm }}>
      <View style={[styles.row, { gap: spacing.sm }]}><Icon name="alert-circle-outline" size={20} color={colors.orange} />
        <Copy variant="emphasis" style={{ flex: 1 }}>{state.unreadableCount} {state.unreadableCount === 1 ? 'activité indisponible' : 'activités indisponibles'}</Copy></View>
      <Copy variant="caption" muted>Ces activités restent conservées sur cet appareil. Les sorties lisibles sont affichées ici.</Copy>
    </Panel>}
    {sorted.length > 0 ? <><HistoryOverview stats={stats} count={sorted.length} />
      <View style={{ gap: spacing.md }}><SectionHeading title={recent.length === 1 ? 'Dernière sortie' : 'Dernières sorties'} />
        {recent.map(run => <RunRow key={run.id} run={run} onPress={() => onDetail(run)} detailed />)}
      </View>
    </> : <HistoryEmpty hasRun={state.run !== null} unreadable={state.unreadableCount > 0} onStart={onStart} />}
    <HistoryAnalysis count={sorted.length} onRecords={onRecords} onCompare={onCompare} onProgression={onProgression} />
    {months.length > 0 && <View style={{ gap: spacing.lg }}><SectionHeading title="Sorties précédentes" />
      {months.map(([key, group]) => <View key={key} style={{ gap: spacing.md }}><Label>{group.title}</Label>
        {group.runs.map(run => <RunRow key={run.id} run={run} onPress={() => onDetail(run)} detailed />)}
      </View>)}
    </View>}
    {sorted.length > RECENT_COUNT && <View style={{ gap: spacing.md }}>
      <Copy variant="caption" muted style={{ textAlign: 'center' }}>{displayed} sorties affichées sur {sorted.length}</Copy>
      {remaining > 0 && <Button title={`Afficher ${Math.min(PAGE_SIZE, remaining)} ${Math.min(PAGE_SIZE, remaining) === 1 ? 'sortie supplémentaire' : 'sorties supplémentaires'}`}
        variant="secondary" icon="chevron-down" onPress={() => setVisibleCount(count => count + PAGE_SIZE)} />}
    </View>}
  </Screen>;
}
