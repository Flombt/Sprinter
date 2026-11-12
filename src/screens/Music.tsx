import { spacing, radii, fontSizes, fontWeights, iconSizes } from '../ui/tokens';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { FeedbackPressable } from '../ui/FeedbackPressable';
import { useAnimateLayoutChange } from '../ui/layoutAnimation';
import * as Clipboard from 'expo-clipboard';
import { music } from '../spotify/device';
import { Artwork, confirmSpotifySwitch, PlaybackControls, PlayerPanel, useMusic } from '../spotify/components';
import { TrackSheet } from '../spotify/TrackSheet';
import { ConnectionCard } from '../spotify/ConnectionCard';
import { playbackPresentation, playlistTitle } from '../spotify/presentation';
import { controlReason, selectedPlaylist } from '../spotify/store';
import type { PlaylistReference, SpotifyTrack } from '../spotify/types';
import { Icon } from '../ui/components';
import { ActionButton, ActionIcon, AppScreen, BodyText, useDesign, DisplayText, Kicker, SectionLabel, StatusBadge, Surface, ToggleSwitch } from '../ui/design';
import { useTheme } from '../ui/theme';

export default function Music({ active, onClose, onAccount, onTracks, foregroundOnlyRun = false }: {
  active: boolean; onClose?: () => void; onAccount: () => void;
  onTracks: (playlist: PlaylistReference) => void; foregroundOnlyRun?: boolean;
}) {
  const design = useDesign();
  const state = useMusic(active), { colors } = useTheme();
  const animateLayout = useAnimateLayoutChange();
  const [input, setInput] = useState(''), [adding, setAdding] = useState(false);
  const [notice, setNotice] = useState<string | null>(null), [noticeError, setNoticeError] = useState(false);
  const [libraryBusy, setLibraryBusy] = useState(false);
  const [playerOptions, setPlayerOptions] = useState(false);
  const mounted = useRef(false), inputRevision = useRef(0);
  const selected = selectedPlaylist(state), connected = state.status === 'connected';
  const playback = playbackPresentation(state);
  const playlists = [...new Map([...state.preferences.playlists, ...state.library].map(p => [p.id, p])).values()];
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  useEffect(() => { if (active) return music.watchPlayback(); }, [active]);
  useEffect(() => { if (connected) void music.loadLibrary(); }, [connected]);
  useEffect(() => { if (!connected) setPlayerOptions(false); }, [connected]);
  const openExternal = (action: () => void) => confirmSpotifySwitch(foregroundOnlyRun, action);
  const open = (playlist: PlaylistReference) => openExternal(() => void music.openPlaylist(playlist));
  const openTrack = (track?: SpotifyTrack, fallback?: PlaylistReference) => openExternal(() => {
    if (track?.url) void music.platform.openSpotify('spotify:' + track.type + ':' + track.id, track.url).catch(() => music.openPlaylist(fallback));
    else void music.openPlaylist(fallback);
  });
  const importPlaylist = async () => {
    if (!input.trim() || adding || state.busy || !state.ready) return;
    const revision = ++inputRevision.current, value = input;
    setAdding(true); setNotice(null); music.clearMessage();
    try {
      const ok = await music.importPlaylist(value);
      if (!mounted.current) return;
      if (ok) {
        if (inputRevision.current === revision) setInput('');
        setNotice('Playlist ajoutée.'); setNoticeError(false); music.clearMessage();
      }
    } finally { if (mounted.current) setAdding(false); }
  };
  const paste = async () => {
    const revision = ++inputRevision.current;
    try { const value = await Clipboard.getStringAsync(); if (mounted.current && revision === inputRevision.current) { setInput(value); setNotice(null); } }
    catch { if (mounted.current) { setNotice('Collez votre lien directement dans le champ.'); setNoticeError(true); } }
  };
  const loadMore = async () => {
    if (libraryBusy) return;
    setLibraryBusy(true);
    try { await music.loadLibrary(true); } finally { if (mounted.current) setLibraryBusy(false); }
  };
  return <AppScreen gap={18}>
    <View style={s.row}>
      <View><Kicker>VOTRE BANDE-SON</Kicker><DisplayText accessibilityRole="header">MUSIQUE.</DisplayText></View>
      <ActionIcon icon={onClose ? 'close' : 'person-outline'} label={onClose ? 'Fermer Spotify' : 'Connexion et compte Spotify'} onPress={onClose ?? (onAccount)} />
    </View>

    <Surface paper contentStyle={{ padding: spacing.lg, gap: spacing.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}><Icon name="link-outline" color={design.ink} size={iconSizes.small} /><Kicker style={{ color: '#706C65' }}>AJOUTER UNE PLAYLIST</Kicker></View>
      <View style={{ flexDirection: 'row', alignItems: 'center', borderRadius: radii.control, borderWidth: 1, borderColor: design.paperLine, backgroundColor: '#E6E3DC' }}>
        <TextInput accessibilityLabel="Lien de playlist Spotify" placeholder="Collez votre lien Spotify…" placeholderTextColor="#77736D"
          value={input} onChangeText={value => { inputRevision.current++; setInput(value); setNotice(null); }} autoCapitalize="none" autoCorrect={false}
          keyboardType="url" returnKeyType="done" onSubmitEditing={() => void importPlaylist()} maxLength={2048} editable={!adding}
          selectionColor={design.accent} style={{ flex: 1, minWidth: 0, minHeight: 50, paddingHorizontal: spacing.md, color: design.ink, fontSize: fontSizes.caption }} />
        <FeedbackPressable accessibilityRole="button" accessibilityLabel="Coller le lien Spotify" disabled={adding} onPress={() => void paste()} style={{ width: 44, minHeight: 50, alignItems: 'center', justifyContent: 'center' }}><Icon name="clipboard-outline" size={iconSizes.small} color="#706C65" /></FeedbackPressable>
      </View>
      <ActionButton title={adding ? 'Import en cours…' : 'Importer la playlist'} icon="add" compact onPress={() => void importPlaylist()} disabled={!input.trim() || adding || state.busy || !state.ready} />
    </Surface>

    {(notice || state.message) && <View accessibilityRole="alert" accessibilityLiveRegion="polite" style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
      <Icon name={notice && !noticeError ? 'checkmark-circle-outline' : 'information-circle-outline'} size={iconSizes.small} color={notice && !noticeError ? design.accent : design.danger} />
      <BodyText style={{ flex: 1, fontSize: fontSizes.small, color: notice && !noticeError ? design.accent : design.danger }}>{notice ?? state.message}</BodyText>
      <ActionIcon icon="close" label="Fermer le message Spotify" onPress={() => { setNotice(null); music.clearMessage(); }} />
    </View>}

    {selected && <View style={{ gap: spacing.md }}>
      <View style={s.row}><Kicker>POUR LA COURSE</Kicker><StatusBadge label={state.preferencesSaving ? 'ENREGISTREMENT…' : 'SÉLECTIONNÉE'} active={!state.preferencesSaving} /></View>
      <Surface style={{ borderLeftWidth: 3, borderLeftColor: design.accent }} contentStyle={{ padding: spacing.lg, gap: spacing.lg }}>
        <View style={{ flexDirection: 'row', gap: spacing.lg, alignItems: 'center' }}>
          <Artwork image={selected.image} size={64} />
          <View style={{ flex: 1, gap: spacing.xs }}><BodyText numberOfLines={2} style={{ fontSize: fontSizes.body, lineHeight: 23, fontWeight: fontWeights.semibold, letterSpacing: -.3 }}>{playlistTitle(selected)}</BodyText>
            <BodyText numberOfLines={1} style={{ fontSize: fontSizes.small, color: design.secondary }}>{[selected.owner, selected.count !== null ? selected.count + ' titres' : 'Playlist Spotify'].filter(Boolean).join(' · ')}</BodyText>
          </View>
        </View>
        <ActionButton title={connected && !controlReason(state, 'play') ? 'Lancer la playlist' : 'Ouvrir dans Spotify'} icon="play" compact onPress={() => {
          if (connected && !controlReason(state, 'play')) void music.playSelected();
          else open(selected);
        }} />
        {connected && <View style={s.row}><BodyText style={{ flex: 1, fontSize: fontSizes.small, color: design.secondary }}>Lancer avec la course</BodyText>
          <ToggleSwitch label="Lancer Spotify avec la course" value={state.preferences.autoPlay} disabled={state.busy || state.preferencesSaving}
            onChange={value => void music.setAutoPlay(value)} /></View>}
        <View style={s.row}>
          {connected && <FeedbackPressable accessibilityRole="button" onPress={() => onTracks(selected)} style={{ minHeight: 44, justifyContent: 'center' }}><BodyText style={{ fontSize: fontSizes.small, color: design.accent }}>Voir les morceaux</BodyText></FeedbackPressable>}
          <FeedbackPressable accessibilityRole="button" disabled={state.busy || state.preferencesSaving} onPress={() => void music.select(null)} style={{ minHeight: 44, justifyContent: 'center' }}><BodyText style={{ fontSize: fontSizes.small, color: design.secondary }}>Partir sans playlist</BodyText></FeedbackPressable>
        </View>
      </Surface>
    </View>}

    {connected && state.playback?.track && <Surface contentStyle={{ gap: spacing.lg }}>
      <View style={s.row}><Kicker>EN ÉCOUTE</Kicker><ActionIcon icon="refresh-outline" label="Actualiser le lecteur Spotify" onPress={() => void music.refreshPlayback(true)} disabled={state.playerBusy} /></View>
      <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}><Artwork image={state.playback.track.image} size={48} /><View style={{ flex: 1, gap: 2 }}>
        <BodyText numberOfLines={1} style={{ fontSize: fontSizes.body, fontWeight: fontWeights.medium }}>{state.playback.track.title}</BodyText>
        <BodyText numberOfLines={1} style={{ fontSize: fontSizes.small, color: design.secondary }}>{state.playback.track.artist}</BodyText>
      </View></View>
      <PlaybackControls state={state} />
      <BodyText style={{ fontSize: fontSizes.small, color: playback.fresh ? design.accent : design.secondary, textAlign: 'center' }}>{playback.label}</BodyText>
    </Surface>}

    {connected && <View style={{ gap: spacing.md }}>
      <FeedbackPressable accessibilityRole="button" accessibilityState={{ expanded: playerOptions }} onPress={() => { animateLayout(); setPlayerOptions(value => !value); }} style={{ ...s.row, minHeight: 44 }}>
        <BodyText style={{ fontSize: fontSizes.small, color: design.secondary }}>Options du lecteur</BodyText><Icon name={playerOptions ? 'chevron-up' : 'chevron-down'} size={iconSizes.small} color={design.secondary} />
      </FeedbackPressable>
      {playerOptions && <PlayerPanel state={state} openSpotify={() => openTrack(state.playback?.track ?? undefined)} />}
    </View>}

    <View style={{ gap: spacing.md }}>
      <View style={s.row}><SectionLabel title="VOS PLAYLISTS" meta={playlists.length > 0 ? String(playlists.length).padStart(2, '0') : undefined} />
        {connected && <ActionIcon icon="refresh-outline" label="Actualiser mes playlists" onPress={() => void music.loadLibrary()} disabled={state.busy} />}
      </View>
      {!state.ready ? <ActivityIndicator color={design.accent} accessibilityLabel="Chargement des playlists" /> : playlists.length ? playlists.map(playlist => {
        const chosen = selected?.id === playlist.id, saved = state.preferences.playlists.some(p => p.id === playlist.id);
        return <Surface key={playlist.id} style={{ borderRadius: radii.control, borderLeftWidth: 3, borderLeftColor: chosen ? design.accent : design.line }} contentStyle={{ padding: spacing.md, flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
          <Pressable accessibilityRole="button" accessibilityLabel={'Choisir ' + playlistTitle(playlist)} accessibilityState={{ selected: chosen, disabled: state.busy }} disabled={state.busy}
            onPress={() => void music.select(playlist)} style={({ pressed }) => ({ flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.md, opacity: pressed ? .7 : 1, minHeight: 54 })}>
            <Artwork image={playlist.image} size={48} />
            <View style={{ flex: 1, gap: 3 }}><BodyText numberOfLines={1} style={{ fontSize: fontSizes.caption, fontWeight: fontWeights.medium }}>{playlistTitle(playlist)}</BodyText><BodyText style={{ color: chosen ? design.accent : design.secondary, fontSize: fontSizes.micro }}>{chosen ? 'Pour la prochaine course' : playlist.owner ?? 'Enregistrée dans Sprinter'}</BodyText></View>
            <Icon name={chosen ? 'checkmark-circle' : 'radio-button-off-outline'} color={chosen ? design.accent : design.muted} size={iconSizes.standard} />
          </Pressable>
          {connected && <ActionIcon icon="list-outline" label={'Voir les morceaux de ' + playlistTitle(playlist)} onPress={() => onTracks(playlist)} />}
          {saved && <FeedbackPressable accessibilityRole="button" accessibilityLabel={'Retirer ' + playlistTitle(playlist) + ' de Sprinter'} disabled={state.busy} onPress={() => void music.remove(playlist.id)} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}><Icon name="close" color={design.muted} size={iconSizes.small} /></FeedbackPressable>}
        </Surface>;
      }) : <Surface contentStyle={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center', paddingVertical: spacing.xxl }}>
        <Icon name="albums-outline" size={iconSizes.large} color={design.secondary} />
        <View style={{ flex: 1, gap: spacing.xs }}><BodyText style={{ fontSize: fontSizes.body, fontWeight: fontWeights.semibold }}>Aucune playlist pour le moment</BodyText>
          <BodyText style={{ color: design.secondary, fontSize: fontSizes.small, lineHeight: 18 }}>Importez un lien ou retrouvez votre compte.</BodyText>
        </View>
      </Surface>}
      {connected && state.nextOffset !== null && <ActionButton title={libraryBusy ? 'Chargement…' : 'Voir plus de playlists'} secondary disabled={libraryBusy} onPress={() => void loadMore()} />}
    </View>

    <FeedbackPressable accessibilityRole="button" accessibilityLabel={connected ? 'Gérer le compte Spotify' : 'Connecter mon compte Spotify'} onPress={onAccount} style={{ minHeight: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md, borderTopWidth: 1, borderTopColor: design.line }}>
      <Image source={colors.dark ? require('../../assets/spotify/logo-white.png') : require('../../assets/spotify/logo-black.png')} resizeMode="contain" accessibilityLabel="Spotify" style={{ width: 84, height: 25, zIndex: 1 }} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}><BodyText style={{ color: design.secondary, fontSize: fontSizes.small }}>{connected ? state.profile?.name ?? 'Compte connecté' : 'Connecter mon compte'}</BodyText><Icon name="arrow-forward" color={design.secondary} size={iconSizes.small} /></View>
    </FeedbackPressable>

  </AppScreen>;
}

export function SpotifyAccount({ onBack, foregroundOnlyRun }: { onBack: () => void; foregroundOnlyRun: boolean }) {
  const state = useMusic();
  const [notice, setNotice] = useState<string | null>(null);
  return <AppScreen><View style={s.row}><DisplayText accessibilityRole="header">VOTRE COMPTE</DisplayText>
    <ActionIcon icon="close" label="Fermer les réglages Spotify" onPress={onBack} /></View>
    <ConnectionCard state={state} openExternal={action => confirmSpotifySwitch(foregroundOnlyRun, action)} onMessage={setNotice} />
    {notice && <BodyText accessibilityRole="alert">{notice}</BodyText>}
  </AppScreen>;
}

export function SpotifyTracks({ playlist, onBack, foregroundOnlyRun }: { playlist: PlaylistReference; onBack: () => void; foregroundOnlyRun: boolean }) {
  const state = useMusic();
  useEffect(() => { if (state.status !== 'connected') onBack(); }, [onBack, state.status]);
  return <TrackSheet playlist={playlist} onClose={onBack}
    onOpenPlaylist={() => confirmSpotifySwitch(foregroundOnlyRun, () => void music.openPlaylist(playlist))}
    onOpenTrack={track => confirmSpotifySwitch(foregroundOnlyRun, () => {
      if (track.url) void music.platform.openSpotify('spotify:' + track.type + ':' + track.id, track.url).catch(() => music.openPlaylist(playlist));
    })} />;
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
});
