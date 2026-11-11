import { useMemo } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { averagePace, duration, km, pace } from '../core/format';
import { QUALITY_LABELS, type PaceTarget } from '../core/types';
import { session, type SessionState } from '../services/session';
import { Artwork, useMusic } from '../spotify/components';
import { selectedPlaylist } from '../spotify/store';
import { playlistTitle } from '../spotify/presentation';
import { Icon } from '../ui/components';
import { ActionButton, ActionIcon, AppScreen, BodyText, Brand, useDesign, DisplayText, Kicker, RunnerGlyph, SectionLabel, StatusBadge, Surface } from '../ui/design';
import { aggregate } from '../progression/aggregates';
import { dayKey, dayStart, monday } from '../progression/dates';
import { useRunSetup } from '../ui/useRunSetup';
export { RunRow } from '../ui/RunRow';

export default function Home({ state, target, onStart, onPrepare, onRecovery, onHistory, onStats, onMusic, onFinish }: {
  state: SessionState; target: PaceTarget; onStart: () => void; onHistory: () => void;
  onPrepare: () => void; onRecovery: () => void; onStats: () => void; onMusic: () => void; onFinish: () => void;
}) {
  const design = useDesign();
  const s = createStyles(design);
  const musicState = useMusic(), playlist = selectedPlaylist(musicState);
  const setup = useRunSetup(target, state);
  const run = state.run, currentTarget = run?.target ?? setup.target;
  const { width } = useWindowDimensions();
  const targetPaceSize = Math.min(89, Math.max(50, Math.floor((Math.min(width, 480) - 205) / 2.15)));
  const week = useMemo(() => aggregate(state.history, dayStart(monday(dayKey(Date.now()))), Date.now() + 1), [state.history]);
  const goal = run?.workout ? run.workout.definition.name : !run && setup.definition ? 'Séance' : currentTarget.distanceMeters ? km(currentTarget.distanceMeters, currentTarget.distanceMeters % 1000 ? 1 : 0) : 'Libre';
  return <AppScreen gap={18}>
    <View style={[s.row, { paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: design.line }]}>
      <Brand /><ActionIcon icon="time-outline" label="Historique des courses" onPress={onHistory} />
    </View>
    {state.recoveryBlocked && <BodyText accessibilityRole="alert" style={{ color: design.danger, fontSize: 13 }}>Une sauvegarde interrompue doit être conservée avant un nouveau départ.</BodyText>}
    {!run && !state.recoveryBlocked && setup.error && <BodyText accessibilityRole="alert" style={{ color: design.danger, fontSize: 12 }}>{setup.error}</BodyText>}

    <View style={s.row}>
      <View style={{ flex: 1, gap: 3 }}><Kicker numberOfLines={1}>{run ? 'VOTRE SORTIE' : setup.definition?.name ?? 'COURSE À PIED'}</Kicker>
        <DisplayText accessibilityRole="header" style={{ fontSize: 57, lineHeight: 61 }}>{run ? state.running ? 'EN COURSE.' : 'EN PAUSE.' : 'ON Y VA.'}</DisplayText>
      </View>
      {run ? <RunnerGlyph size={37} color={design.accent} /> : <ActionIcon icon="options-outline" label="Préparer ma course" onPress={onPrepare} />}
    </View>

    {run ? <Surface paper contentStyle={{ padding: 20, gap: 12 }}>
      <View style={s.row}><Kicker style={s.paperLabel}>DISTANCE</Kicker>
        <StatusBadge paper active={state.running && state.quality === 'good'} label={state.autoPaused ? 'PAUSE AUTO' : state.running ? QUALITY_LABELS[state.quality] : 'EN PAUSE'} />
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 9 }}>
        <DisplayText numeric style={{ color: design.ink, fontSize: 94, lineHeight: 98, letterSpacing: -2 }}>{km(run.distanceMeters)}</DisplayText>
        <BodyText style={{ color: '#6A6761', fontSize: 16 }}>km</BodyText>
      </View>
      <View style={{ height: 1, backgroundColor: design.paperLine }} />
      <View style={{ flexDirection: 'row', gap: 18 }}>
        <View style={{ flex: 1, gap: 2 }}><Kicker style={s.paperLabel}>TEMPS ACTIF</Kicker><DisplayText numeric style={s.paperMetric}>{duration(run.activeSeconds)}</DisplayText></View>
        <View style={{ width: 1, backgroundColor: design.paperLine }} />
        <View style={{ flex: 1, gap: 2 }}><Kicker style={s.paperLabel}>ALLURE MOYENNE</Kicker><DisplayText numeric style={s.paperMetric}>{pace(averagePace(run))}<BodyText style={{ fontSize: 12, color: '#6A6761' }}> /km</BodyText></DisplayText></View>
      </View>
    </Surface> : <Pressable accessibilityRole="button" accessibilityLabel={setup.definition ? 'Configurer la séance sélectionnée' : 'Modifier les objectifs dans l’onglet Stats'} onPress={setup.definition ? onPrepare : onStats}>
      <Surface paper contentStyle={{ padding: 20, gap: 14 }}>
        <View style={{ flexDirection: 'row', gap: 18 }}>
          <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
            <Kicker style={s.paperLabel}>ALLURE CIBLE</Kicker>
            <DisplayText numeric adjustsFontSizeToFit numberOfLines={1} style={{ fontSize: targetPaceSize, lineHeight: targetPaceSize + 8, letterSpacing: -2.2, color: design.ink }}>{pace((currentTarget.fast + currentTarget.slow) / 2)}</DisplayText>
            <BodyText style={{ color: '#6A6761', fontSize: 12, marginTop: -5 }}>min / km</BodyText>
          </View>
          <View style={{ width: 1, backgroundColor: design.paperLine }} />
          <View style={{ width: 86, gap: 8, justifyContent: 'space-between' }}>
            <Kicker style={s.paperLabel}>DISTANCE</Kicker>
            <View><DisplayText numeric adjustsFontSizeToFit numberOfLines={1} style={{ fontSize: currentTarget.distanceMeters ? 47 : 36, lineHeight: 51, color: design.ink }}>{goal}</DisplayText>
              <BodyText style={{ color: '#6A6761', fontSize: 12 }}>{setup.definition ? 'guidée' : currentTarget.distanceMeters ? 'kilomètres' : 'sans limite'}</BodyText>
            </View>
          </View>
        </View>
        <View style={{ height: 1, backgroundColor: design.paperLine }} />
        <View style={s.row}><BodyText style={{ color: '#6A6761', fontSize: 11 }}>Tolérance ± {Math.round((currentTarget.slow - currentTarget.fast) / 2)} s / km</BodyText>
          <View style={{ flexDirection: 'row', gap: 5, alignItems: 'center' }}><BodyText style={{ fontSize: 12, fontWeight: '600', color: design.ink }}>Modifier</BodyText><Icon name="arrow-forward" size={14} color={design.ink} /></View>
        </View>
      </Surface>
    </Pressable>}

    {run && <Pressable accessibilityRole="button" accessibilityLabel="Voir les statistiques de la course" onPress={onStats} style={[s.row, { paddingHorizontal: 2 }]}>
      <BodyText numberOfLines={1} style={{ flex: 1, fontSize: 12, color: design.secondary }}>Objectif <BodyText style={{ fontSize: 12 }}>{goal}{!run.workout && currentTarget.distanceMeters ? ' km' : ''}</BodyText></BodyText>
      <View style={{ flexDirection: 'row', gap: 5, alignItems: 'center' }}><BodyText style={{ fontSize: 12, color: design.secondary }}>Toutes les stats</BodyText><Icon name="arrow-forward" size={15} color={design.secondary} /></View>
    </Pressable>}

    <View style={{ gap: 6 }}>
      <ActionButton title={state.busy ? 'Connexion au GPS…' : state.recoveryBlocked ? 'Récupérer la sauvegarde' : run ? state.running || state.autoPaused ? 'Mettre en pause' : 'Reprendre la course' : setup.error ? 'Vérifier les options' : 'Démarrer une course'}
        icon={run && (state.running || state.autoPaused) ? 'pause' : 'play'} disabled={state.busy}
        onPress={state.recoveryBlocked ? onRecovery : run ? () => { if (state.running || state.autoPaused) void session.pause(); else void session.resume(); } : setup.error ? onPrepare : onStart} />
      {run && <Pressable accessibilityRole="button" accessibilityLabel="Terminer et enregistrer la course" disabled={state.busy} onPress={onFinish}
        style={{ minHeight: 44, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, opacity: state.busy ? .4 : 1 }}>
        <Icon name="stop-circle-outline" color={design.secondary} size={17} /><BodyText style={{ color: design.secondary, fontSize: 13 }}>Terminer la course</BodyText>
      </Pressable>}
    </View>

    <Pressable accessibilityRole="button" accessibilityLabel={playlist ? 'Changer de playlist : ' + playlistTitle(playlist) : 'Choisir une playlist Spotify'} onPress={onMusic}>
      <Surface contentStyle={{ padding: 14, flexDirection: 'row', gap: 12, alignItems: 'center' }}>
        <Artwork image={playlist?.image} size={44} />
        <View style={{ flex: 1, gap: 3 }}><Kicker style={{ fontSize: 9 }}>VOTRE BANDE-SON</Kicker>
          <BodyText numberOfLines={1} style={{ fontSize: 13, fontWeight: '500' }}>{playlist ? playlistTitle(playlist) : 'Ajouter une playlist Spotify'}</BodyText>
        </View>
        <Icon name="chevron-forward" color={design.secondary} size={17} />
      </Surface>
    </Pressable>

    {!run && <Pressable onPress={onHistory} accessibilityRole="button" accessibilityLabel={km(week.meters, 1) + ' kilomètres cette semaine. Ouvrir l’historique.'} style={{ gap: 10, paddingTop: 2 }}>
      <SectionLabel title="CETTE SEMAINE" meta="Historique ↗" />
      <View style={{ flexDirection: 'row', gap: 22, alignItems: 'baseline' }}>
        <DisplayText numeric style={{ fontSize: 36, lineHeight: 40 }}>{km(week.meters, 1)}<BodyText style={s.unit}> km</BodyText></DisplayText>
        <View style={{ width: 1, height: 23, backgroundColor: design.line }} />
        <DisplayText numeric style={{ fontSize: 36, lineHeight: 40 }}>{week.outings}<BodyText style={s.unit}> {week.outings === 1 ? 'sortie' : 'sorties'}</BodyText></DisplayText>
      </View>
    </Pressable>}
  </AppScreen>;
}

const createStyles = (design: ReturnType<typeof useDesign>) => StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  paperLabel: { color: '#706C65', fontSize: 9, letterSpacing: 1 },
  paperMetric: { color: design.ink, fontSize: 35, lineHeight: 40 },
  unit: { color: design.secondary, fontSize: 12, lineHeight: 18 },
});
