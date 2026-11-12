import { spacing, fontSizes, fontWeights } from '../ui/tokens';
import { ChoiceGroup, Input, TextField, Toggle } from '../ui/controls';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useIsFocused, useNavigation, usePreventRemove } from '@react-navigation/native';
import { View } from 'react-native';
import { FeedbackPressable } from '../ui/FeedbackPressable';
import { RunRecord } from '../core/types';
import { duration, km, pace, runDate } from '../core/format';
import { Button, Copy, Header, IconButton, Label, Panel, Screen, styles } from '../ui/components';
import { useTheme } from '../ui/theme';
import { confirm } from '../ui/confirm';
import { useSessionStructure } from '../services/useSessionSelector';
import { createTemplate } from '../workouts/templates';
import { makeGhost, newSegment, shiftWorkoutPaces, uid, validateWorkout, workoutStatistics, workoutTotals } from '../workouts/definition';
import { workouts } from '../workouts/store';
import { workoutRecords } from '../workouts/records';
import { EFFORT_LABELS, WorkoutBlock, WorkoutDefinition, WorkoutSegment } from '../workouts/types';
import { usePersonalRecords } from '../analysis/useRecords';
import { WorkoutLibraryView, type WorkoutLibraryFilter } from '../workouts/LibraryView';
import { WorkoutOverview } from '../workouts/LibraryCards';

function PersonalBestChooser({ history, onBack, onChoose, error }: { history: RunRecord[]; onBack: () => void; onChoose: (run: RunRecord, meters: number) => void; error: string | null }) {
  const { busy, done, records } = usePersonalRecords(history);
  const { colors } = useTheme();
  return <Screen bottom={45}><Header title="Défier mon record" onBack={onBack} />
    <Copy muted>Les meilleurs segments continus de votre historique servent de référence. Aucun record n’est créé à partir d’une moyenne ou d’un parcours incomplet.</Copy>
    {busy && <Copy accessibilityLiveRegion="polite">Calcul des records : {done} / {history.length} sorties.</Copy>}
    {!history.length && <Copy>Enregistrez une première sortie avec son parcours GPS pour débloquer ce défi.</Copy>}
    {error && <Copy accessibilityRole="alert" style={{ color: colors.danger }}>{error}</Copy>}
    {records.map(record => { const best = record.best, run = best ? history.find(r => r.id === best.runId) : null;
      return <Panel key={record.meters} style={{ gap: spacing.md }}><Copy variant="section">{record.label}</Copy>
        {best ? <><Copy>{duration(best.seconds)} · {pace(best.pace)} /km · {runDate(best.startedAt)}</Copy>
          <Copy muted variant="caption">Segment mesuré de {km(best.fromMeters)} à {km(best.toMeters)} km dans la sortie source.</Copy></> : <Copy muted>{busy ? 'Recherche en cours…' : 'Aucun segment GPS qualifié sur cette distance.'}</Copy>}
        <Button title="Défier ce record" secondary disabled={busy || !run} onPress={() => { if (run) onChoose(run, record.meters); }} />
      </Panel>;
    })}
    <Copy muted variant="caption">Le chrono et la référence sont figés à la création. Le défi doit être couru sans pause ; le GPS continue même si le défi est perdu ou non évaluable.</Copy>
  </Screen>;
}

function Choices<T extends string>({ value, items, onChange }: { value: T; items: readonly (readonly [T, string])[]; onChange: (value: T) => void }) {
  return <ChoiceGroup value={value} choices={items} onChange={onChange} />;
}
function Field({ label, value, onChange, multiline = false }: { label: string; value: string; onChange: (value: string) => void; multiline?: boolean }) {
  return <TextField label={label} value={value} onChangeText={onChange} multiline={multiline} maxLength={multiline ? 800 : 100} />;
}
const numberText = (value: number) => Number.isFinite(value) ? String(Math.round(value * 100) / 100) : '';
const paceText = (value: number) => Number.isFinite(value) ? `${Math.floor(value / 60)}:${String(Math.round(value % 60)).padStart(2, '0')}` : '';
function NumberField({ label, value, onChange, isPace = false }: { label: string; value: number; onChange: (value: number) => void; isPace?: boolean }) {
  const { colors } = useTheme(); const [text, setText] = useState(() => isPace ? paceText(value) : numberText(value)); const [focused, setFocused] = useState(false);
  useEffect(() => { if (!focused && Number.isFinite(value)) setText(isPace ? paceText(value) : numberText(value)); }, [value, focused, isPace]);
  return <View style={{ gap: spacing.xs, flex: 1, minWidth: 115 }}><Label>{label}</Label><Input accessibilityLabel={label} value={text} keyboardType={isPace ? 'numbers-and-punctuation' : 'decimal-pad'}
    onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} onChangeText={raw => {
      setText(raw); const input = raw.trim().replace(',', '.');
      const match = /^(\d{1,2}):([0-5]\d)$/.exec(input);
      onChange(isPace ? match ? Number(match[1]) * 60 + Number(match[2]) : NaN : /^(\d+(\.\d*)?|\.\d+)$/.test(input) ? Number(input) : NaN);
    }} placeholder={isPace ? '5:30' : '0'} placeholderTextColor={colors.muted}
    invalid={!Number.isFinite(value)} style={{ fontVariant: ['tabular-nums'] }} /></View>;
}
function SegmentEditor({ segment: s, onChange }: { segment: WorkoutSegment; onChange: (segment: WorkoutSegment) => void }) {
  const update = (patch: Partial<WorkoutSegment>) => onChange({ ...s, ...patch });
  return <View style={{ gap: spacing.md }}><Field label="Nom du bloc" value={s.name} onChange={name => update({ name })} />
    <Choices value={s.effort} items={Object.entries(EFFORT_LABELS) as [WorkoutSegment['effort'], string][]} onChange={effort => update({ effort })} />
    <Label>Terminer le bloc après</Label><Choices value={s.end.kind} items={[["distance", "Une distance"], ["duration", "Une durée"], ["inTarget", "Du temps en cible"]]} onChange={kind => update({ end: kind === 'inTarget' ? { kind, value: 20, maximumSeconds: 300 } : { kind, value: kind === 'distance' ? 400 : 90 } })} />
    <NumberField label={s.end.kind === 'distance' ? 'Distance (mètres)' : s.end.kind === 'duration' ? 'Durée (secondes)' : 'Confirmation en cible (s)'} value={s.end.value} onChange={value => update({ end: { ...s.end, value } })} />
    {s.end.kind === 'inTarget' && <NumberField label="Limite de la condition (s)" value={s.end.maximumSeconds} onChange={maximumSeconds => update({ end: { kind: 'inTarget', value: s.end.value, maximumSeconds } })} />}
    <Toggle title="Objectif d’allure" value={!!s.target} onChange={enabled => update({ target: enabled ? { fast: 310, slow: 330 } : null, assessment: enabled ? 'averagePace' : 'none' })} />
    {s.target && <><Choices value={s.paceRule} items={[["range", "Plage"], ["notFaster", "Pas trop vite"], ["notSlower", "Pas trop lent"]]} onChange={paceRule => update({ paceRule })} />
      <View style={[styles.row, { gap: spacing.sm, flexWrap: 'wrap' }]}><NumberField label="Rapide (min:sec /km)" isPace value={s.target.fast} onChange={fast => update({ target: { ...s.target!, fast } })} />
        <NumberField label="Lente (min:sec /km)" isPace value={s.target.slow} onChange={slow => update({ target: { ...s.target!, slow } })} /></View>
      <NumberField label="Marge de tolérance (s/km)" value={s.tolerance} onChange={tolerance => update({ tolerance })} />
      <Label>Réussite du bloc</Label><Choices value={s.assessment} items={[["none", "Pas de score d’allure"], ["averagePace", "Allure moyenne"], ["compliance", "Temps dans la cible"]]} onChange={assessment => update({ assessment })} />
      {s.assessment === 'compliance' && <NumberField label="Temps fiable en cible requis (%)" value={s.minimumCompliance} onChange={minimumCompliance => update({ minimumCompliance })} />}
    </>}
    <Toggle title="Temps maximal pour ce bloc" value={s.maximumSeconds !== null} onChange={enabled => update({ maximumSeconds: enabled ? 300 : null })} />
    {s.maximumSeconds !== null && <NumberField label="Temps maximal (secondes)" value={s.maximumSeconds} onChange={maximumSeconds => update({ maximumSeconds })} />}
  </View>;
}
function BlocksEditor({ blocks, onChange, depth = 0 }: { blocks: WorkoutBlock[]; onChange: (blocks: WorkoutBlock[]) => void; depth?: number }) {
  const { colors } = useTheme();
  const change = (index: number, block: WorkoutBlock) => onChange(blocks.map((old, i) => i === index ? block : old));
  const move = (index: number, delta: number) => { const next = [...blocks], other = index + delta; if (other < 0 || other >= next.length) return; [next[index], next[other]] = [next[other]!, next[index]!]; onChange(next); };
  const copyBlock = (block: WorkoutBlock): WorkoutBlock => block.kind === 'repeat'
    ? { ...block, id: uid(), blocks: block.blocks.map(copyBlock) } : { ...block, id: uid(), end: { ...block.end }, target: block.target ? { ...block.target } : null };
  return <View style={{ gap: spacing.lg }}>{blocks.map((block, index) => <Panel key={block.id} style={{ gap: spacing.lg, padding: depth ? 12 : 18, borderWidth: 1, borderColor: colors.line }}>
    <View style={[styles.row, { gap: spacing.xs, flexWrap: 'wrap' }]}><Label style={{ flex: 1 }}>{block.kind === 'repeat' ? 'Groupe répété' : `Bloc ${index + 1}`}</Label>
      {index > 0 && <IconButton icon="arrow-up" label="Monter le bloc" onPress={() => move(index, -1)} />}{index < blocks.length - 1 && <IconButton icon="arrow-down" label="Descendre le bloc" onPress={() => move(index, 1)} />}
      <IconButton icon="copy-outline" label="Dupliquer le bloc" onPress={() => onChange([...blocks.slice(0, index + 1), copyBlock(block), ...blocks.slice(index + 1)])} />
      <IconButton icon="trash-outline" label="Retirer le bloc" onPress={() => onChange(blocks.filter((_, i) => i !== index))} /></View>
    {block.kind === 'segment' ? <SegmentEditor segment={block} onChange={value => change(index, value)} /> : <>
      <NumberField label="Nombre de répétitions (1 à 100)" value={block.count} onChange={count => change(index, { ...block, count })} />
      <BlocksEditor depth={depth + 1} blocks={block.blocks} onChange={value => change(index, { ...block, blocks: value })} /></>}
  </Panel>)}<Button title="Ajouter un bloc" secondary icon="add" onPress={() => onChange([...blocks, newSegment()])} />
    {depth < 3 && <Button title="Ajouter un groupe répété" secondary icon="repeat" onPress={() => onChange([...blocks, { kind: 'repeat', id: uid(), count: 3, blocks: [newSegment(), { ...newSegment(), name: 'Récupération', effort: 'recovery', target: null, assessment: 'none', end: { kind: 'duration', value: 90 } }] }])} />}
  </View>;
}
export function WorkoutSummary({ definition }: { definition: WorkoutDefinition }) {
  let label = '';
  try { const totals = workoutTotals(definition); label = `${totals.segments} segment${totals.segments > 1 ? 's' : ''}${totals.meters ? ` · ${km(totals.meters, 2)} km de blocs distance` : ''}${totals.seconds ? ` · ${duration(totals.seconds)} de blocs chronométrés` : ''}`; } catch { label = 'Configuration à corriger'; }
  return <Copy muted variant="caption">{label}</Copy>;
}
export function WorkoutEditor({ initial, onBack, onSelected, onCommit }: { initial: WorkoutDefinition; onBack: () => void; onSelected?: () => void; onCommit?: (definition: WorkoutDefinition) => void }) {
  const { colors } = useTheme(); const library = useSyncExternalStore(workouts.subscribe, workouts.getSnapshot, workouts.getSnapshot);
  const running = useSessionStructure(useIsFocused());
  const [draft, setDraft] = useState<WorkoutDefinition>(() => JSON.parse(JSON.stringify(initial)));
  const [ghostMeters, setGhostMeters] = useState(initial.challenge.ghost?.distanceMeters ?? 0); const [ghostError, setGhostError] = useState<string | null>(null);
  const [paceAdjustmentError, setPaceAdjustmentError] = useState<string | null>(null);
  const [showRules, setShowRules] = useState(initial.challenge.kind !== 'none');
  const errors = [...validateWorkout(draft), ...(draft.challenge.kind === 'ghost' && ghostError ? [ghostError] : [])]; const update = (patch: Partial<WorkoutDefinition>) => setDraft({ ...draft, ...patch });
  const rules = draft.challenge; const changeRules = (patch: Partial<typeof rules>) => update({ challenge: { ...rules, ...patch } });
  const source = rules.ghost ? running.history.find(run => run.id === rules.ghost!.runId) : null;
  const changeGhostDistance = (value: number) => {
    setGhostMeters(value);
    try {
      if (!source || !Number.isFinite(value) || draft.blocks.length !== 1 || draft.blocks[0]?.kind !== 'segment') throw new Error('Choisissez une distance valide et conservez un seul bloc de distance pour le fantôme.');
      const ghost = makeGhost(source, value);
      update({ challenge: { ...rules, ghost, timeLimitSeconds: ghost.seconds }, blocks: [{ ...draft.blocks[0], end: { kind: 'distance', value } }] }); setGhostError(null);
    } catch (error) { setGhostError(error instanceof Error ? error.message : 'Distance de référence invalide.'); }
  };
  const navigation = useNavigation();
  const saved = useRef(false);
  usePreventRemove(true, ({ data }) => {
    const leave = () => navigation.dispatch(data.action);
    if (saved.current) leave();
    else confirm('Fermer l’éditeur ?', 'Les modifications non enregistrées seront perdues.', 'Fermer', leave);
  });
  const adjustPaces = (seconds: number) => {
    try { setDraft(shiftWorkoutPaces(draft, seconds)); setPaceAdjustmentError(null); }
    catch (error) { setPaceAdjustmentError(error instanceof Error ? error.message : 'Ajustement indisponible.'); }
  };
  const save = async (select: boolean) => {
    if (errors.length) return;
    if (onCommit) { saved.current = true; onCommit(draft); return; }
    if (await workouts.save(draft, select)) { saved.current = true; if (select && onSelected) onSelected(); else onBack(); }
  };
  return <Screen bottom={45}><Header title="Personnaliser la séance" onBack={onBack} />
    <WorkoutOverview definition={draft} valid={!errors.length} plan />
    <Field label="Nom de la séance" value={draft.name} onChange={name => update({ name })} />
    <Field label="Description" value={draft.description} multiline onChange={description => update({ description })} />
    <Copy muted variant="caption">Ces valeurs sont des exemples modifiables. Adaptez les distances, allures et récupérations à votre niveau.</Copy>
    <Panel style={{ gap: spacing.md }}><Label>Adapter toutes les cibles d’allure</Label><Copy muted variant="caption">Décalez les plages en conservant leurs écarts, la progression, les distances et les récupérations. Le chrono d’un défi record ou d’un contre-la-montre reste distinct.</Copy>
      <View style={[styles.row, { gap: spacing.sm, flexWrap: 'wrap' }]}><Button title="15 s/km plus vite" secondary style={{ flex: 1 }} onPress={() => adjustPaces(-15)} /><Button title="15 s/km plus lent" secondary style={{ flex: 1 }} onPress={() => adjustPaces(15)} /></View>
      {paceAdjustmentError && <Copy accessibilityRole="alert" style={{ color: colors.danger, fontSize: fontSizes.small }}>{paceAdjustmentError}</Copy>}
    </Panel>
    <Button title={showRules ? 'Masquer les conditions du défi' : 'Configurer les conditions du défi'} variant="secondary" icon={showRules ? 'chevron-up' : 'chevron-down'} onPress={() => setShowRules(value => !value)} />
    {showRules && <Panel style={{ gap: spacing.lg }}><Label>Règle du défi</Label><Choices value={rules.kind} items={[["none", "Blocs uniquement"], ["survival", "Survie"], ["timeTrial", "Contre-la-montre"], ["progression", "Accélération"], ["regularity", "Régularité"], ...(rules.ghost ? [[rules.ghost.source === 'personalBest' ? 'personalBest' : 'ghost', rules.ghost.source === 'personalBest' ? 'Record personnel' : 'Fantôme']] as const : [])]} onChange={kind => changeRules({ kind, timeLimitSeconds: kind === 'timeTrial' ? rules.timeLimitSeconds ?? 1500 : ['ghost', 'personalBest'].includes(kind) ? rules.ghost?.seconds ?? null : rules.timeLimitSeconds })} />
      {rules.kind === 'survival' && <><Choices value={rules.outsideMode} items={[["consecutive", "Secondes consécutives"], ["cumulative", "Secondes cumulées"]]} onChange={outsideMode => changeRules({ outsideMode })} />
        <NumberField label="Budget hors cible (secondes)" value={rules.allowedOutsideSeconds} onChange={allowedOutsideSeconds => changeRules({ allowedOutsideSeconds })} />
        <NumberField label="Avertir après (secondes)" value={rules.warningSeconds} onChange={warningSeconds => changeRules({ warningSeconds })} />
        <Copy muted variant="caption">Consécutif : le compteur repart à zéro au retour dans la cible. Cumulé : les écarts fiables s’additionnent sur la séance. Une interruption GPS ne consomme aucun budget.</Copy></>}
      {rules.kind === 'timeTrial' && <NumberField label="Temps limite (secondes)" value={rules.timeLimitSeconds ?? NaN} onChange={timeLimitSeconds => changeRules({ timeLimitSeconds })} />}
      {rules.kind === 'progression' && <NumberField label="Accélération minimale entre efforts (s/km)" value={rules.progressionSeconds} onChange={progressionSeconds => changeRules({ progressionSeconds })} />}
      {rules.kind === 'regularity' && <><NumberField label="Score de stabilité minimal (sur 100)" value={rules.minimumStabilityScore ?? 80} onChange={minimumStabilityScore => changeRules({ minimumStabilityScore })} />
        <Copy muted variant="caption">Score calculé sur la dispersion de l’allure fiable des efforts, pondérée par le temps. Une dispersion relative de 5 % donne 80/100. Il faut aussi respecter les conditions d’allure des blocs. Récupérations et pauses sont exclues.</Copy></>}
      {rules.kind === 'ghost' && rules.ghost && <><Copy>Référence réelle du {runDate(rules.ghost.startedAt)} : {km(rules.ghost.distanceMeters)} km en {duration(rules.ghost.seconds)}.</Copy>
        {source ? <NumberField label="Distance comparable du fantôme (m)" value={ghostMeters} onChange={changeGhostDistance} /> : <Copy muted variant="caption">La course source a été supprimée. Sa référence sauvegardée reste utilisable à cette distance.</Copy>}
        <Copy muted variant="caption">La distance peut couvrir 95 à 100 % de la course source. Le temps de référence est recalculé depuis son vrai parcours. Modifiez cette distance ici, puis conservez-la dans le bloc.</Copy></>}
      {rules.kind === 'personalBest' && rules.ghost && <><Copy>Record GPS du {runDate(rules.ghost.startedAt)} : {km(rules.ghost.distanceMeters)} km en {duration(rules.ghost.seconds)}.</Copy>
        <Copy muted variant="caption">Référence figée à la création : segment source de {km(rules.ghost.fromMeters ?? 0)} à {km((rules.ghost.fromMeters ?? 0) + rules.ghost.distanceMeters)} km. Conservez sa distance et son temps. Une pause, une récupération de l’activité ou une perte de continuité empêche la qualification du défi.</Copy></>}
      <NumberField label="Couverture GPS requise (%)" value={rules.minimumCoverage * 100} onChange={value => changeRules({ minimumCoverage: value / 100 })} />
    </Panel>}
    <Label>Blocs dans l’ordre d’exécution</Label><Copy muted variant="caption">Chaque bloc enchaîne automatiquement le suivant après sa distance, sa durée ou sa confirmation en cible. Pour une récupération, choisissez le type Récupération et sa durée ou sa distance. Les pauses suspendent le temps de séance.</Copy><BlocksEditor blocks={draft.blocks} onChange={blocks => update({ blocks })} />
    {!!errors.length && <Panel style={{ gap: spacing.xs }}><Copy accessibilityRole="alert" style={{ color: colors.danger, fontWeight: fontWeights.semibold }}>À corriger avant d’enregistrer</Copy>{errors.slice(0, 8).map(error => <Copy key={error} style={{ color: colors.danger, fontSize: fontSizes.small }}>{error}</Copy>)}{errors.length > 8 && <Copy muted>{errors.length - 8} autre(s) correction(s).</Copy>}</Panel>}
    {library.message && <Copy accessibilityRole="alert" style={{ color: colors.danger }}>{library.message}</Copy>}
    {onCommit ? <Button title="Appliquer ces blocs au calendrier" disabled={!!errors.length} onPress={() => void save(false)} /> : <><Button title={library.busy ? 'Enregistrement…' : 'Enregistrer et choisir'} icon="checkmark" disabled={library.busy || !!errors.length} onPress={() => void save(true)} />
    <Button title="Enregistrer dans ma bibliothèque" secondary disabled={library.busy || !!errors.length} onPress={() => void save(false)} /></>}
  </Screen>;
}
export type WorkoutPage = 'Workouts' | 'WorkoutGhost' | 'WorkoutPersonalBest' | 'WorkoutRecords';

export default function Workouts({ view, onClose, onSelected, onDetail, onEdit, onBrowse }: {
  view: WorkoutPage; onClose: () => void; onSelected: () => void; onDetail: (run: RunRecord) => void;
  onEdit: (definition: WorkoutDefinition) => void; onBrowse: (view: Exclude<WorkoutPage, 'Workouts'>) => void;
}) {
  const { colors } = useTheme(); const library = useSyncExternalStore(workouts.subscribe, workouts.getSnapshot, workouts.getSnapshot);
  const running = useSessionStructure(useIsFocused());
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<WorkoutLibraryFilter>('all');
  const ghostCandidates = useMemo(() => view === 'WorkoutGhost' ? running.history.map(run => {
    let eligible = true; try { makeGhost(run); } catch { eligible = false; } return { run, eligible };
  }) : [], [view, running.history]);
  useEffect(() => { void workouts.initialize(); }, []);
  if (view === 'WorkoutPersonalBest') return <PersonalBestChooser history={running.history} error={error} onBack={onClose} onChoose={(run, meters) => {
    try { onEdit(createTemplate('personalBest', run, meters)); setError(null); } catch (e) { setError(e instanceof Error ? e.message : 'Record indisponible.'); }
  }} />;
  if (view === 'WorkoutGhost') return <Screen bottom={45}><Header title="Choisir mon fantôme" onBack={onClose} />
    <Copy muted>Une course terminée d’au moins 100 m avec son trajet GPS est nécessaire. La référence reprend sa distance réelle, sans extrapolation.</Copy>
    {running.history.length === 0 && <Copy>Aucune course enregistrée pour le moment. Faites une première sortie pour créer votre fantôme.</Copy>}
    {error && <Copy accessibilityRole="alert" style={{ color: colors.danger }}>{error}</Copy>}
    {ghostCandidates.map(({ run, eligible }) => {
      return <Panel key={run.id} style={{ gap: spacing.md }}><Copy style={{ fontWeight: fontWeights.semibold }}>{runDate(run.startedAt)} · {km(run.distanceMeters)} km</Copy><Copy muted>{duration(run.activeSeconds)} de temps actif</Copy>
        <Button title={eligible ? 'Utiliser cette référence' : 'Trajet insuffisant pour un fantôme'} secondary disabled={!eligible} onPress={() => { try { onEdit(createTemplate('ghost', run)); setError(null); } catch (e) { setError(e instanceof Error ? e.message : 'Référence indisponible.'); } }} /></Panel>; })}
  </Screen>;
  if (view === 'WorkoutRecords') { const groups = workoutRecords(running.history); return <Screen bottom={45}><Header title="Records de séances" onBack={onClose} />
    <Copy muted>Seules les séances terminées et validées sont classées. Distance, blocs, cibles, tolérances et règles doivent être identiques pour être comparés.</Copy>
    {!groups.length && <Copy>Aucun record validé pour le moment.</Copy>}{groups.map(group => <Panel key={group.key} style={{ gap: spacing.md }}><Copy style={{ fontSize: fontSizes.section, fontWeight: fontWeights.semibold }}>{group.name}</Copy>
      <Copy muted variant="caption">{group.metric === 'time' ? 'Classement par temps actif' : group.metric === 'stability' ? 'Classement par score de stabilité' : 'Classement par temps fiable en cible'}</Copy>
      {group.attempts.map((run, index) => { const stats = workoutStatistics(run.workout!); return <FeedbackPressable key={run.id} accessibilityRole="button" disabled={!onDetail} onPress={() => onDetail?.(run)} style={{ minHeight: 48, justifyContent: 'center', gap: 2 }}>
        <Copy>{index + 1}. {group.metric === 'time' ? duration(stats.elapsed) : group.metric === 'stability' ? `${stats.stability.score?.toFixed(1)} /100` : `${stats.targetPercentage?.toFixed(1)} %`} · {runDate(run.startedAt)}</Copy><Copy muted variant="small">Voir les segments et le résultat</Copy></FeedbackPressable>; })}</Panel>)}
  </Screen>; }
  return <WorkoutLibraryView library={library} running={running} error={error} onClose={onClose} onDetail={onDetail}
    filter={filter} onBrowse={setFilter}
    canPrepare onSelected={onSelected} onEdit={onEdit} onRecords={() => onBrowse('WorkoutRecords')}
    onTemplate={kind => {
      try { setError(null); if (kind === 'ghost') onBrowse('WorkoutGhost'); else if (kind === 'personalBest') onBrowse('WorkoutPersonalBest'); else onEdit(createTemplate(kind)); }
      catch (value) { setError(value instanceof Error ? value.message : 'Ce modèle est indisponible.'); }
    }} />;
}
