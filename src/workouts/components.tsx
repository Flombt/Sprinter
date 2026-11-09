import { View } from 'react-native';
import { duration, km, pace, targetLabel } from '../core/format';
import { Button, Copy, Label, Metric, MetricGrid, Panel, styles } from '../ui/components';
import { useTheme } from '../ui/theme';
import { confirm } from '../ui/confirm';
import { session } from '../services/session';
import { effectiveTarget, ghostDistance, segmentGoal, segmentTarget, workoutRepetitions, workoutStatistics } from './definition';
import { CHALLENGE_STATUS, EFFORT_LABELS, WORKOUT_STATUS, WorkoutSnapshot } from './types';

export function WorkoutLivePanel({ workout: w, qualityGood, busy }: { workout: WorkoutSnapshot; qualityGood: boolean; busy: boolean }) {
  const { colors } = useTheme(); const current = w.segments[w.currentIndex], stats = workoutStatistics(w), rules = w.definition.challenge;
  const active = w.status === 'running' || w.status === 'paused';
  const elapsed = current?.startedAt !== null && current ? Math.max(0, w.lastSeconds - current.startedAt) : 0;
  const remaining = !current ? '' : current.planned.end.kind === 'distance' ? `${Math.max(0, current.planned.end.value - (w.lastMeters - current.startMeters)).toFixed(0)} m restants`
    : current.planned.end.kind === 'duration' ? `${duration(Math.max(0, current.planned.end.value - elapsed))} restantes`
      : `${duration(w.conditionSeconds)} / ${duration(current.planned.end.value)} en cible · limite ${duration(Math.max(0, current.planned.end.maximumSeconds - elapsed))}`;
  const budget = Math.max(0, rules.allowedOutsideSeconds - (rules.outsideMode === 'consecutive' ? w.currentDeviation : stats.outsideSeconds));
  const lastEvent = w.events.at(-1);
  const stateColor = w.challengeStatus === 'failed' ? colors.danger : w.challengeStatus === 'warning' ? colors.orange : colors.text;
  return <Panel style={{ gap: 15 }}><View style={[styles.row, { justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }]}><Label>Séance · {WORKOUT_STATUS[w.status]}</Label><Copy style={{ fontSize: 12, color: stateColor, fontWeight: '700' }}>{CHALLENGE_STATUS[w.challengeStatus]}</Copy></View>
    <Copy variant="section">{w.definition.name}</Copy>
    {active && current && <><Label>Segment {w.currentIndex + 1} / {w.segments.length} · {EFFORT_LABELS[current.planned.effort]}</Label>
      <Copy style={{ fontSize: 19, fontWeight: '600' }}>{current.planned.name}</Copy>
      {current.planned.repetition !== null && <Copy>Répétition {current.planned.repetition} / {current.planned.repetitionCount}</Copy>}
      <Copy>{segmentGoal(current.planned)} · {segmentTarget(current.planned)}</Copy><Copy style={{ fontSize: 23, lineHeight: 30, fontWeight: '600', fontVariant: ['tabular-nums'] }}>{remaining}</Copy>
      {current.planned.assessment === 'averagePace' && <Copy muted variant="caption">Allure moyenne de ce bloc : {pace(current.distanceMeters > 0 ? elapsed / current.distanceMeters * 1000 : null)} /km. La réussite est jugée sur cette moyenne à la fin du bloc.</Copy>}
      {rules.kind === 'survival' && <View style={{ gap: 5 }}><Copy style={{ fontWeight: '600', color: stateColor }}>Budget restant : {budget.toFixed(1)} s {rules.outsideMode === 'consecutive' ? 'consécutives' : 'cumulées'}</Copy><Copy muted variant="caption">{qualityGood ? 'Seules les secondes d’allure fiable consomment ce budget.' : rules.outsideMode === 'consecutive' ? 'Allure non fiable : continuité interrompue, compteur consécutif réinitialisé.' : 'Allure non fiable : budget cumulé figé, aucun échec calculé sur le signal manquant.'}</Copy></View>}
      {['timeTrial', 'ghost', 'personalBest'].includes(rules.kind) && rules.timeLimitSeconds !== null && <Copy>Temps limite restant : {duration(Math.max(0, rules.timeLimitSeconds - stats.elapsed))}</Copy>}
      {['ghost', 'personalBest'].includes(rules.kind) && rules.ghost && <Copy muted>{qualityGood && !w.distanceInterrupted && !(rules.kind === 'personalBest' && w.hadPause) ? `Écart ${rules.kind === 'personalBest' ? 'au record' : 'au fantôme'} : ${Math.round(stats.distance - ghostDistance(rules.ghost, stats.elapsed)) > 0 ? '+' : ''}${Math.round(stats.distance - ghostDistance(rules.ghost, stats.elapsed))} m` : 'Comparaison de progression suspendue : la continuité des mesures ne permet pas de la qualifier.'}</Copy>}
      {rules.kind === 'personalBest' && w.hadPause && <Copy style={{ color: colors.orange, fontSize: 12 }}>Une pause a été enregistrée. La sortie continue, mais ce défi ne pourra pas qualifier un record continu.</Copy>}
      {rules.kind === 'regularity' && <View style={{ gap: 5 }}><Copy style={{ fontWeight: '600' }}>Stabilité provisoire : {stats.stability.score === null ? '—' : `${stats.stability.score.toFixed(1)} /100`} · objectif {rules.minimumStabilityScore ?? 80}/100</Copy>
        <Copy muted variant="caption">Couverture d’allure des efforts : {stats.stability.coverage === null ? '—' : `${(stats.stability.coverage * 100).toFixed(0)} %`}. Au moins 30 secondes et cinq observations fiables sont nécessaires. Les conditions de temps en cible s’appliquent aussi.</Copy></View>}
    </>}
    {w.awaitingFinalFix && <Copy muted>Dernières mesures GPS en attente pour confirmer le résultat.</Copy>}
    {w.reason && <Copy style={{ color: stateColor, fontSize: 13 }}>{w.reason}</Copy>}
    {lastEvent && <Copy accessibilityLiveRegion="polite" muted variant="caption">{lastEvent.message}</Copy>}
    {w.challengeStatus === 'failed' && active && <Copy muted variant="caption">Votre course continue. Poursuivez les blocs ou passez en course libre.</Copy>}
    {!active && <Copy>Votre GPS et votre chronomètre de sortie continuent en course libre.</Copy>}
    {active && <Button title="Abandonner la séance, continuer librement" secondary disabled={busy} onPress={() => confirm('Continuer en course libre ?', 'La séance sera marquée abandonnée. Le GPS, le chronomètre et l’enregistrement de votre sortie continuent.', 'Continuer librement', () => { void session.abandonWorkout(); })} />}
  </Panel>;
}
const outcomeLabels = { pending: 'À venir', succeeded: 'Réussi', failed: 'Objectif non atteint', unrated: 'Non évaluable' };
export function WorkoutResult({ workout: w }: { workout: WorkoutSnapshot }) {
  const { colors } = useTheme(); const stats = workoutStatistics(w), repetitions = workoutRepetitions(w);
  return <View style={{ gap: 17 }}><Panel style={{ gap: 17 }}><Label>Résultat de la séance</Label><Copy style={{ fontSize: 23, fontWeight: '600' }}>{w.definition.name}</Copy>
    <Copy style={{ fontWeight: '700', color: w.challengeStatus === 'failed' ? colors.danger : colors.text }}>{WORKOUT_STATUS[w.status]} · {CHALLENGE_STATUS[w.challengeStatus]}</Copy>
    {w.reason && <Copy muted>{w.reason}</Copy>}
    <MetricGrid><Metric label="Temps de séance" value={duration(stats.elapsed)} /><Metric label="Distance de séance" value={km(stats.distance)} unit="km" /></MetricGrid>
    <MetricGrid><Metric label="Temps en cible" value={stats.targetPercentage === null ? '—' : `${stats.targetPercentage.toFixed(0)} %`} /><Metric label="Écarts" value={String(stats.deviations)} /></MetricGrid>
    <Copy muted variant="caption">Hors cible : {duration(stats.outsideSeconds)} au total · plus long écart continu : {duration(stats.longestDeviation)}. Mesures d’allure fiables : {duration(stats.reliableSeconds)}. Couverture du suivi : {stats.trackingCoverage === null ? '—' : `${(stats.trackingCoverage * 100).toFixed(0)} %`}.</Copy>
    <Copy muted variant="caption">Le pourcentage en cible utilise uniquement les mesures fiables des blocs avec une cible. Les pauses, l’acquisition GPS et les pertes de signal sont exclues. Un résultat non évaluable ne constitue pas un échec.</Copy>
    {w.definition.challenge.kind === 'regularity' && <><MetricGrid><Metric label="Score de stabilité" value={stats.stability.score === null ? '—' : stats.stability.score.toFixed(1)} unit="/100" /><Metric label="Minimum requis" value={String(w.definition.challenge.minimumStabilityScore ?? 80)} unit="/100" /></MetricGrid>
      <Copy muted variant="caption">Écart-type d’allure : {stats.stability.standardDeviation === null ? '—' : `${stats.stability.standardDeviation.toFixed(1)} s/km`}, sur {duration(stats.stability.seconds)} fiables. Score pondéré par la durée des mesures ; efforts uniquement, hors récupérations. Une faible couverture empêche de valider le défi.</Copy></>}
    {w.definition.challenge.kind === 'personalBest' && w.definition.challenge.ghost && <Copy muted variant="caption">Référence : {km(w.definition.challenge.ghost.distanceMeters)} km en {duration(w.definition.challenge.ghost.seconds)}, segment GPS du {new Date(w.definition.challenge.ghost.startedAt).toLocaleDateString('fr-FR')}. Il faut battre strictement ce chrono, sans pause ni perte de continuité.</Copy>}
  </Panel>{repetitions.length > 0 && <Panel style={{ gap: 12 }}><Label>Temps par répétition</Label>{repetitions.map((rep, index) => <View key={index} style={{ gap: 4 }}>
    <Copy style={{ fontWeight: '600' }}>{rep.name}{rep.partial ? ' · partielle' : ''}</Copy><Copy variant="caption">{duration(rep.seconds)} au total · effort {duration(rep.effortSeconds)} sur {km(rep.effortMeters)} km · {pace(rep.effortMeters > 0 ? rep.effortSeconds / rep.effortMeters * 1000 : null)} /km</Copy>
    <Copy muted variant="caption">Récupération : {duration(rep.recoverySeconds)} · en cible : {rep.targetPercentage === null ? '—' : `${rep.targetPercentage.toFixed(0)} %`} · {outcomeLabels[rep.outcome as keyof typeof outcomeLabels]}.</Copy>
  </View>)}</Panel>}<Label>Segments prévus et réalisés</Label>{w.segments.map((s, index) => {
    const elapsed = s.startedAt === null ? null : Math.max(0, (s.endedAt ?? w.lastSeconds) - s.startedAt);
    const average = elapsed !== null && s.distanceMeters > 0 ? elapsed / s.distanceMeters * 1000 : null;
    const target = effectiveTarget(s.planned);
    return <Panel key={s.planned.key} style={{ gap: 8 }}><Label>{index + 1}. {EFFORT_LABELS[s.planned.effort]}{s.planned.repetition ? ` · répétition ${s.planned.repetition}/${s.planned.repetitionCount}` : ''}</Label>
      <Copy style={{ fontSize: 18, fontWeight: '600' }}>{s.planned.name}</Copy><Copy muted variant="caption">Prévu : {segmentGoal(s.planned)} · {segmentTarget(s.planned)}</Copy>
      <Copy style={{ color: s.outcome === 'failed' ? colors.danger : colors.text }}>{s.startedAt === null ? 'Non commencé' : `${outcomeLabels[s.outcome]}${s.partial ? ' · partiel' : ''}`}</Copy>
      {elapsed !== null && <><Copy>Réalisé : {km(s.distanceMeters)} km · {duration(elapsed)} · {pace(average)} /km</Copy>
        {target && <Copy muted variant="caption">En cible : {s.reliableSeconds > 0 ? `${(s.inTargetSeconds / s.reliableSeconds * 100).toFixed(0)} %` : '—'} · hors cible {duration(s.outsideSeconds)} · {s.deviations} écart(s) · plus long {duration(s.longestDeviation)}.</Copy>}
        {s.planned.maximumSeconds !== null && <Copy muted variant="caption">Temps maximal prévu : {duration(s.planned.maximumSeconds)}</Copy>}
      </>}{s.reason && <Copy muted variant="caption">{s.reason}</Copy>}
    </Panel>;
  })}</View>;
}
export function liveWorkoutTarget(w: WorkoutSnapshot) {
  const segment = w.segments[w.currentIndex];
  const target = (w.status === 'running' || w.status === 'paused') && segment ? effectiveTarget(segment.planned) : null;
  return target ? `${targetLabel({ ...target, distanceMeters: null })} /km` : 'Allure libre';
}
