import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import type { RunRecord } from '../core/types';
import { duration, km, pace } from '../core/format';
import { usePersonalRecords } from '../analysis/useRecords';
import { RECORD_DISTANCES } from '../analysis/types';
import {
  Button,
  Copy,
  Header,
  IconButton,
  Label,
  Metric,
  MetricGrid,
  Panel,
  Screen,
  styles,
} from '../ui/components';
import { useTheme } from '../ui/theme';
import { aggregate, consistency, entryState, periodComparison } from '../progression/aggregates';
import { addDays, addMonths, dayKey, dayLabel, dayStart, monday, period } from '../progression/dates';
import { useLocalNow, useProgression } from '../progression/hooks';
import { progression } from '../progression/store';
import { recordTimeline } from '../progression/records';
import { Calendar } from '../progression/Calendar';
import { Plans } from '../progression/PlanBuilder';
import { Shoes } from '../progression/Shoes';
import { Goals } from '../progression/Goals';
import { Choices } from '../progression/ui';

export default function Progression({
  history,
  canStart,
  onBack,
  onDetail,
  onStart,
  onRecords,
}: {
  history: RunRecord[];
  canStart: boolean;
  onBack: () => void;
  onDetail: (run: RunRecord) => void;
  onStart: () => void;
  onRecords: () => void;
}) {
  const local = useProgression(),
    now = useLocalNow(),
    today = dayKey(now);
  const [view, setView] = useState<{ name: 'dashboard' | 'calendar' | 'plans' | 'shoes'; day?: string }>({
    name: 'dashboard',
  });
  useEffect(() => {
    if (local.ready) void progression.reconcile(history);
  }, [history, local.ready]);
  if (view.name === 'calendar')
    return (
      <Calendar
        history={history}
        initialDay={view.day}
        canStart={canStart}
        onBack={() => setView({ name: 'dashboard' })}
        onDetail={onDetail}
        onStart={onStart}
      />
    );
  if (view.name === 'plans')
    return (
      <Plans
        history={history}
        onBack={() => setView({ name: 'dashboard' })}
        onSaved={(day) => setView({ name: 'calendar', day })}
      />
    );
  if (view.name === 'shoes') return <Shoes history={history} onBack={() => setView({ name: 'dashboard' })} />;
  return (
    <Dashboard
      history={history}
      now={now}
      today={today}
      onBack={onBack}
      onRecords={onRecords}
      onDetail={onDetail}
      onCalendar={() => setView({ name: 'calendar' })}
      onPlans={() => setView({ name: 'plans' })}
      onShoes={() => setView({ name: 'shoes' })}
    />
  );
}
function Dashboard({
  history,
  now,
  today,
  onBack,
  onRecords,
  onDetail,
  onCalendar,
  onPlans,
  onShoes,
}: {
  history: RunRecord[];
  now: number;
  today: string;
  onBack: () => void;
  onRecords: () => void;
  onDetail: (run: RunRecord) => void;
  onCalendar: () => void;
  onPlans: () => void;
  onShoes: () => void;
}) {
  const local = useProgression(),
    records = usePersonalRecords(history),
    { colors } = useTheme();
  const [kind, setKind] = useState<'week' | 'month'>('week'),
    [anchor, setAnchor] = useState(today),
    [goalWeek, setGoalWeek] = useState(monday(today)),
    [recordDistance, setRecordDistance] = useState(5000),
    [shown, setShown] = useState(20);
  const stats = useMemo(() => {
    const week = period(today, 'week'),
      month = period(today, 'month');
    return {
      week: aggregate(history, dayStart(week.start), dayStart(week.end), now),
      month: aggregate(history, dayStart(month.start), dayStart(month.end), now),
      all: aggregate(history, -Infinity, now + 1, now),
      regularity: consistency(history, now),
      comparison: periodComparison(history, anchor, kind, now),
    };
  }, [history, today, now, anchor, kind]);
  const complete = records.done >= history.length;
  const performances = useMemo(() => records.records.flatMap((r) => r.performances), [records.records]);
  const timeline = useMemo(
    () =>
      complete
        ? recordTimeline(performances)
            .filter((e) => e.performance.meters === recordDistance)
            .reverse()
        : [],
    [complete, performances, recordDistance],
  );
  const comp = stats.comparison,
    reg = stats.regularity;
  const aIds = new Set(comp.a.runs.map((r) => r.id)),
    bIds = new Set(comp.b.runs.map((r) => r.id));
  const best = (meters: number, ids: Set<string>) =>
    performances
      .filter((p) => p.meters === meters && ids.has(p.runId))
      .reduce<number | null>((n, p) => (n === null ? p.seconds : Math.min(n, p.seconds)), null);
  const missed = local.data.entries.filter(
      (e) => entryState(e, history, local.data, today).state === 'missed',
    ).length,
    skipped = local.data.entries.filter((e) => e.status === 'skipped').length;
  return (
    <Screen bottom={40}>
      <Header title="Ma progression" onBack={onBack} />
      <Copy muted>
        Vos activités enregistrées, vos objectifs et votre organisation, entièrement sur cet appareil.
      </Copy>
      <Button
        title="Calendrier : activités et prochaines séances"
        icon="calendar-outline"
        onPress={onCalendar}
      />
      <Button title="Préparer un 5 km, 10 km ou semi" secondary icon="fitness-outline" onPress={onPlans} />
      <Button
        title="Mes chaussures et leur kilométrage"
        secondary
        icon="footsteps-outline"
        onPress={onShoes}
      />
      {!local.ready && (
        <Panel style={{ gap: 10 }}>
          <Copy>
            Le stockage de progression n’est pas encore disponible. Les compteurs de vos courses restent
            accessibles.
          </Copy>
          <Button
            title="Réessayer le stockage local"
            secondary
            onPress={() => void progression.initialize()}
          />
        </Panel>
      )}
      {local.message && (
        <Copy accessibilityRole="alert" style={{ color: colors.warning.text }}>
          {local.message}
        </Copy>
      )}
      <Panel style={{ gap: 16 }}>
        <Label>Cette semaine · du lundi au dimanche</Label>
        <MetricGrid>
          <Metric label="Distance" value={km(stats.week.meters)} unit="km" />
          <Metric label="Sorties" value={String(stats.week.outings)} />
        </MetricGrid>
        <Copy muted>
          {duration(stats.week.activeSeconds)} de course active · {stats.week.activeDays} jour(s) avec sortie.
        </Copy>
      </Panel>
      <Panel style={{ gap: 16 }}>
        <Label>Ce mois</Label>
        <MetricGrid>
          <Metric label="Distance" value={km(stats.month.meters)} unit="km" />
          <Metric label="Sorties" value={String(stats.month.outings)} />
        </MetricGrid>
        <Copy muted>{duration(stats.month.activeSeconds)} de course active.</Copy>
      </Panel>
      <Panel style={{ gap: 14 }}>
        <Label>Tout l’historique exploitable</Label>
        <MetricGrid>
          <Metric label="Kilomètres" value={km(stats.all.meters)} />
          <Metric label="Sorties" value={String(stats.all.outings)} />
        </MetricGrid>
        <Metric label="Temps de course actif" value={duration(stats.all.activeSeconds)} />
        <Copy muted>
          Temps total enregistré :{' '}
          {stats.all.outings > 0 && stats.all.missingTotals === stats.all.outings
            ? '—'
            : duration(stats.all.knownTotalSeconds)}
          {stats.all.missingTotals ? ` · ${stats.all.missingTotals} total(aux) absent(s)` : ''}
          {stats.all.estimatedTotals ? ` · ${stats.all.estimatedTotals} estimé(s) après récupération` : ''}.
        </Copy>
      </Panel>
      <Panel style={{ gap: 14 }}>
        <Label>Régularité d’entraînement</Label>
        <Copy>
          {reg.outingsPerWeek === null ? '—' : reg.outingsPerWeek.toFixed(1)} sortie(s) par semaine observée ·{' '}
          {reg.activeDays} jour(s) de course sur {reg.observedDays} jour(s) observés.
        </Copy>
        <Copy>
          {reg.activeWeeks} / {reg.completeWeeks} semaines terminées avec au moins une sortie ·{' '}
          {reg.weeklyConsistency === null ? '—' : `${reg.weeklyConsistency.toFixed(0)} %`}.
        </Copy>
        <Copy muted>
          Série actuelle : {reg.currentStreak} semaine(s) avec sortie. Une semaine en cours encore vide ne
          coupe pas la série précédente.
        </Copy>
        <Copy muted>
          {reg.daysWithoutRun} jour(s) sans course enregistrée dans la fenêtre observée. Ce nombre ne mesure
          pas le repos physique.
        </Copy>
        <Copy muted>
          Calendrier :{' '}
          {local.ready
            ? `${missed} séance(s) passée(s) sans activité associée · ${skipped} élément(s) marqué(s) non réalisé(s).`
            : 'données locales indisponibles.'}
        </Copy>
        <Label>Volumes des semaines terminées observées</Label>
        {reg.counts.map((value, i) => (
          <View key={reg.weeks[i]} style={{ gap: 4 }}>
            <Copy muted variant="small">
              {reg.weeks[i]} · {km(value.meters)} km · {value.outings} sortie(s)
            </Copy>
            <View style={{ height: 5, backgroundColor: colors.line, borderRadius: 3 }}>
              <View
                style={{
                  height: 5,
                  borderRadius: 3,
                  backgroundColor: colors.secondary,
                  width: `${(value.meters / Math.max(1, ...reg.counts.map((c) => c.meters))) * 100}%`,
                }}
              />
            </View>
          </View>
        ))}
        {!reg.completeWeeks && <Copy muted>Pas encore de semaine terminée dans l’historique.</Copy>}
      </Panel>
      <Panel style={{ gap: 14 }}>
        <Label>Objectifs hebdomadaires</Label>
        <View style={[styles.row, { justifyContent: 'space-between' }]}>
          <IconButton
            icon="chevron-back"
            label="Objectif de la semaine précédente"
            onPress={() => setGoalWeek(addDays(goalWeek, -7))}
          />
          <Copy>{goalWeek}</Copy>
          <IconButton
            icon="chevron-forward"
            label="Objectif de la semaine suivante"
            onPress={() => setGoalWeek(addDays(goalWeek, 7))}
          />
        </View>
      </Panel>
      {local.ready && (
        <Goals
          data={local.data}
          history={history}
          week={goalWeek}
          busy={local.busy}
          now={now}
          onSaved={setGoalWeek}
        />
      )}
      <Panel style={{ gap: 16 }}>
        <Label>Comparer les périodes</Label>
        <Choices
          value={kind}
          choices={[
            ['week', 'Semaines'],
            ['month', 'Mois'],
          ]}
          onChange={setKind}
        />
        <View style={[styles.row, { justifyContent: 'space-between' }]}>
          <IconButton
            icon="chevron-back"
            label="Période précédente"
            onPress={() => setAnchor(addDays(comp.current.start, -1))}
          />
          <Copy style={{ flex: 1, textAlign: 'center', fontSize: 13 }}>{dayLabel(comp.current.start)}</Copy>
          <IconButton
            icon="chevron-forward"
            label="Période suivante"
            onPress={() =>
              setAnchor(kind === 'week' ? addDays(comp.current.start, 7) : addMonths(comp.current.start, 1))
            }
          />
        </View>
        <Button title="Période actuelle" secondary onPress={() => setAnchor(today)} />
        <Copy muted variant="caption">
          {comp.ongoing
            ? 'Période en cours et précédente au même avancement du calendrier, dans la limite des jours disponibles.'
            : 'Périodes calendaires complètes, ou données disponibles jusqu’à aujourd’hui.'}
        </Copy>
        <MetricGrid>
          <Metric label="Sélection" value={km(comp.a.meters)} unit="km" />
          <Metric label="Précédente" value={km(comp.b.meters)} unit="km" />
        </MetricGrid>
        <Copy>
          {comp.a.outings} / {comp.b.outings} sorties · {duration(comp.a.activeSeconds)} /{' '}
          {duration(comp.b.activeSeconds)} actifs.
        </Copy>
        <Copy muted>
          Allures moyennes pondérées : {pace(comp.a.averagePace)} / {pace(comp.b.averagePace)} par km.
          Distances et efforts des sorties peuvent différer ; cette moyenne ne suffit pas à conclure à une
          amélioration de performance.
        </Copy>
        <Label>Meilleurs segments comparables · sélection / précédente</Label>
        {!complete ? (
          <Copy muted>
            Calcul des records : {records.done} / {history.length}.
          </Copy>
        ) : (
          RECORD_DISTANCES.map((d) => {
            const a = best(d.meters, aIds),
              b = best(d.meters, bIds);
            return (
              <Copy key={d.meters} variant="caption">
                {d.label} : {a === null ? '—' : duration(a)} / {b === null ? '—' : duration(b)}
                {a !== null && b !== null
                  ? ` · ${a - b < 0 ? 'plus court' : a - b > 0 ? 'plus long' : 'identique'}` +
                    (Math.abs(a - b) >= 0.5 ? ` de ${Math.round(Math.abs(a - b))} s` : '')
                  : ''}
              </Copy>
            );
          })
        )}
      </Panel>
      <Panel style={{ gap: 13 }}>
        <Label>Historique des records GPS</Label>
        <Choices<number>
          value={recordDistance}
          choices={RECORD_DISTANCES.map((d) => [d.meters, d.label])}
          onChange={(v) => {
            setRecordDistance(v);
            setShown(20);
          }}
        />
        {!complete ? (
          <Copy muted>
            Calcul des activités : {records.done} / {history.length}.
          </Copy>
        ) : !timeline.length ? (
          <Copy muted>Aucun segment qualifié pour cette distance.</Copy>
        ) : (
          timeline.slice(0, shown).map((item) => (
            <View key={`${item.performance.runId}:${item.performance.meters}`} style={{ gap: 7 }}>
              <Copy>
                {dayLabel(dayKey(item.performance.endedAt))} · {duration(item.performance.seconds)} ·{' '}
                {item.gainSeconds === null
                  ? 'première marque'
                  : item.gainSeconds < 0.5
                    ? 'gain inférieur à 1 s'
                    : `gain de ${Math.round(item.gainSeconds)} s`}
              </Copy>
              <Button
                title="Voir la course source"
                secondary
                onPress={() => {
                  const run = history.find((r) => r.id === item.performance.runId);
                  if (run) onDetail(run);
                }}
              />
            </View>
          ))
        )}
        {timeline.length > shown && (
          <Button title="Afficher les records précédents" secondary onPress={() => setShown(shown + 20)} />
        )}
        <Button title="Tous les records personnels actuels" secondary onPress={onRecords} />
        <Copy muted variant="small">
          Meilleur segment continu qualifié par activité et distance. L’historique est recalculé à partir des
          activités conservées ; une suppression peut donc changer la chronologie des records.
        </Copy>
      </Panel>
      <Copy muted variant="small">
        Jours, semaines et mois suivent le fuseau local de l’appareil. Une sortie est affectée à son jour de
        départ. Les volumes restent les distances enregistrées, parfois partielles lors de pertes GPS. Aucune
        estimation de performance future n’est produite.
      </Copy>
    </Screen>
  );
}
