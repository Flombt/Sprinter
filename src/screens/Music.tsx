import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
import { interaction, typography } from '../ui/tokens';

export default function Music({ onClose, foregroundOnlyRun = false, active = true }: {
  onClose?: () => void;
  foregroundOnlyRun?: boolean;
  active?: boolean;
}) {
  const design = useDesign();
  const state = useMusic(), { colors, reduceMotion } = useTheme(), insets = useSafeAreaInsets();
  const [input, setInput] = useState(''), [adding, setAdding] = useState(false), [connection, setConnection] = useState(false);
  const [notice, setNotice] = useState<string | null>(null), [noticeError, setNoticeError] = useState(false);
  const [libraryBusy, setLibraryBusy] = useState(false);
  const [trackPlaylist, setTrackPlaylist] = useState<PlaylistReference | null>(null), [playerOptions, setPlayerOptions] = useState(false);
  const mounted = useRef(false), inputRevision = useRef(0);
  const selected = selectedPlaylist(state), connected = state.status === 'connected';
  const playback = playbackPresentation(state);
  const playlists = [...new Map([...state.preferences.playlists, ...state.library].map(p => [p.id, p])).values()];
  useEffect(() => {
    mounted.current = true;
    void music.initialize();
    return () => { mounted.current = false; };
  }, []);
  useEffect(() => active ? music.watchPlayback() : undefined, [active]);
  useEffect(() => { if (active && connected && !music.getSnapshot().library.length) void music.loadLibrary(); }, [
    active, connected,
  ]);
  useEffect(() => { if (!connected) { setTrackPlaylist(null); setPlayerOptions(false); } }, [connected]);
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
      <ActionIcon icon={onClose ? 'close' : 'person-outline'} label={onClose ? 'Fermer Spotify' : 'Connexion et compte Spotify'} onPress={onClose ?? (() => setConnection(true))} />
    </View>

    <Surface paper contentStyle={{ padding: 18, gap: 13 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Icon name="link-outline" color={design.ink} size={17} /><Kicker style={{ color: '#706C65' }}>AJOUTER UNE PLAYLIST</Kicker></View>
      <View style={{ flexDirection: 'row', alignItems: 'center', borderRadius: 9, borderWidth: 1, borderColor: design.paperLine, backgroundColor: '#E6E3DC' }}>
        <TextInput accessibilityLabel="Lien de playlist Spotify" placeholder="Collez votre lien Spotify…" placeholderTextColor="#77736D"
          value={input} onChangeText={value => { inputRevision.current++; setInput(value); setNotice(null); }} autoCapitalize="none" autoCorrect={false}
          keyboardType="url" returnKeyType="done" onSubmitEditing={() => void importPlaylist()} maxLength={2048} editable={!adding}
          selectionColor={design.accent} style={{ flex: 1, minWidth: 0, minHeight: 50, paddingHorizontal: 12, color: design.ink, fontSize: 13 }} />
        <Pressable accessibilityRole="button" accessibilityLabel="Coller le lien Spotify" disabled={adding} onPress={() => void paste()} style={{ width: 44, minHeight: 50, alignItems: 'center', justifyContent: 'center' }}><Icon name="clipboard-outline" size={17} color="#706C65" /></Pressable>
      </View>
      <ActionButton title={adding ? 'Import en cours…' : 'Importer la playlist'} icon="add" compact onPress={() => void importPlaylist()} disabled={!input.trim() || adding || state.busy || !state.ready} />
    </Surface>

    {(notice || state.message) && <View accessibilityRole="alert" accessibilityLiveRegion="polite" style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
      <Icon name={notice && !noticeError ? 'checkmark-circle-outline' : 'information-circle-outline'} size={17} color={notice && !noticeError ? design.accent : design.danger} />
      <BodyText style={{ flex: 1, fontSize: 12, color: notice && !noticeError ? design.accent : design.danger }}>{notice ?? state.message}</BodyText>
      <ActionIcon icon="close" label="Fermer le message Spotify" onPress={() => { setNotice(null); music.clearMessage(); }} />
    </View>}

    {selected && <View style={{ gap: 13 }}>
      <View style={s.row}><Kicker>POUR LA COURSE</Kicker><StatusBadge label={state.preferencesSaving ? 'ENREGISTREMENT…' : 'SÉLECTIONNÉE'} active={!state.preferencesSaving} /></View>
      <Surface style={{ borderLeftWidth: 3, borderLeftColor: design.accent }} contentStyle={{ padding: 17, gap: 16 }}>
        <View style={{ flexDirection: 'row', gap: 17, alignItems: 'center' }}>
          <Artwork image={selected.image} size={64} />
          <View style={{ flex: 1, gap: 5 }}><BodyText numberOfLines={2} style={{ fontSize: 17, lineHeight: 23, fontWeight: '600', letterSpacing: -.3 }}>{playlistTitle(selected)}</BodyText>
            <BodyText numberOfLines={1} style={{ fontSize: typography.small.fontSize, color: design.secondary }}>{[selected.owner, selected.count !== null ? selected.count + ' titres' : 'Playlist Spotify'].filter(Boolean).join(' · ')}</BodyText>
          </View>
        </View>
        <ActionButton title={connected && !controlReason(state, 'play') ? 'Lancer la playlist' : 'Ouvrir dans Spotify'} icon="play" compact onPress={() => {
          if (connected && !controlReason(state, 'play')) void music.playSelected();
          else open(selected);
        }} />
        {connected && <View style={s.row}><BodyText style={{ flex: 1, fontSize: 12, color: design.secondary }}>Lancer avec la course</BodyText>
          <ToggleSwitch label="Lancer Spotify avec la course" value={state.preferences.autoPlay} disabled={state.busy || state.preferencesSaving}
            onChange={value => void music.setAutoPlay(value)} /></View>}
        <View style={s.row}>
          {connected && <Pressable accessibilityRole="button" onPress={() => setTrackPlaylist(selected)} style={{ minHeight: 44, justifyContent: 'center' }}><BodyText style={{ fontSize: 12, color: design.accent }}>Voir les morceaux</BodyText></Pressable>}
          <Pressable accessibilityRole="button" disabled={state.busy || state.preferencesSaving} onPress={() => void music.select(null)} style={{ minHeight: 44, justifyContent: 'center' }}><BodyText style={{ fontSize: 12, color: design.secondary }}>Partir sans playlist</BodyText></Pressable>
        </View>
      </Surface>
    </View>}

    {connected && state.playback?.track && <Surface contentStyle={{ gap: 15 }}>
      <View style={s.row}><Kicker>EN ÉCOUTE</Kicker><ActionIcon icon="refresh-outline" label="Actualiser le lecteur Spotify" onPress={() => void music.refreshPlayback(true)} disabled={state.playerBusy} /></View>
      <View style={{ flexDirection: 'row', gap: 13, alignItems: 'center' }}><Artwork image={state.playback.track.image} size={48} /><View style={{ flex: 1, gap: 2 }}>
        <BodyText numberOfLines={1} style={{ fontSize: 14, fontWeight: '500' }}>{state.playback.track.title}</BodyText>
        <BodyText numberOfLines={1} style={{ fontSize: typography.small.fontSize, color: design.secondary }}>{state.playback.track.artist}</BodyText>
      </View></View>
      <PlaybackControls state={state} />
      <BodyText style={{ fontSize: typography.small.fontSize, color: playback.fresh ? design.accent : design.secondary, textAlign: 'center' }}>{playback.label}</BodyText>
    </Surface>}

    {connected && <View style={{ gap: 12 }}>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: playerOptions }} onPress={() => setPlayerOptions(!playerOptions)} style={{ ...s.row, minHeight: 44 }}>
        <BodyText style={{ fontSize: 12, color: design.secondary }}>Options du lecteur</BodyText><Icon name={playerOptions ? 'chevron-up' : 'chevron-down'} size={16} color={design.secondary} />
      </Pressable>
      {playerOptions && <PlayerPanel state={state} openSpotify={() => openTrack(state.playback?.track ?? undefined)} />}
    </View>}

    <View style={{ gap: 13 }}>
      <View style={s.row}><SectionLabel title="VOS PLAYLISTS" meta={playlists.length > 0 ? String(playlists.length).padStart(2, '0') : undefined} />
        {connected && <ActionIcon icon="refresh-outline" label="Actualiser mes playlists" onPress={() => void music.loadLibrary()} disabled={state.busy} />}
      </View>
      {!state.ready ? <ActivityIndicator color={design.accent} accessibilityLabel="Chargement des playlists" /> : playlists.length ? playlists.map(playlist => {
        const chosen = selected?.id === playlist.id, saved = state.preferences.playlists.some(p => p.id === playlist.id);
        return <Surface key={playlist.id} style={{ borderRadius: 12, borderLeftWidth: 3, borderLeftColor: chosen ? design.accent : design.line }} contentStyle={{ padding: 11, flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <Pressable accessibilityRole="button" accessibilityLabel={'Choisir ' + playlistTitle(playlist)} accessibilityState={{ selected: chosen, disabled: state.busy }} disabled={state.busy}
            onPress={() => void music.select(playlist)} style={({ pressed }) => ({ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, opacity: pressed ? interaction.pressedOpacity : 1, minHeight: 54 })}>
            <Artwork image={playlist.image} size={48} />
            <View style={{ flex: 1, gap: 3 }}><BodyText numberOfLines={1} style={{ fontSize: 13, fontWeight: '500' }}>{playlistTitle(playlist)}</BodyText><BodyText style={{ color: chosen ? design.accent : design.secondary, fontSize: typography.small.fontSize }}>{chosen ? 'Pour la prochaine course' : playlist.owner ?? 'Enregistrée dans Sprinter'}</BodyText></View>
            <Icon name={chosen ? 'checkmark-circle' : 'radio-button-off-outline'} color={chosen ? design.accent : design.muted} size={21} />
          </Pressable>
          {connected && <ActionIcon icon="list-outline" label={'Voir les morceaux de ' + playlistTitle(playlist)} onPress={() => setTrackPlaylist(playlist)} />}
          {saved && <Pressable accessibilityRole="button" accessibilityLabel={'Retirer ' + playlistTitle(playlist) + ' de Sprinter'} disabled={state.busy} onPress={() => void music.remove(playlist.id)} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}><Icon name="close" color={design.muted} size={16} /></Pressable>}
        </Surface>;
      }) : <Surface contentStyle={{ flexDirection: 'row', gap: 14, alignItems: 'center', paddingVertical: 23 }}>
        <Icon name="albums-outline" size={26} color={design.secondary} />
        <View style={{ flex: 1, gap: 4 }}><BodyText style={{ fontSize: 14, fontWeight: '600' }}>Aucune playlist pour le moment</BodyText>
          <BodyText style={{ color: design.secondary, fontSize: 12, lineHeight: 18 }}>Importez un lien ou retrouvez votre compte.</BodyText>
        </View>
      </Surface>}
      {connected && state.nextOffset !== null && <ActionButton title={libraryBusy ? 'Chargement…' : 'Voir plus de playlists'} secondary disabled={libraryBusy} onPress={() => void loadMore()} />}
    </View>

    <Pressable accessibilityRole="button" accessibilityLabel={connected ? 'Gérer le compte Spotify' : 'Connecter mon compte Spotify'} onPress={() => setConnection(true)} style={{ minHeight: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderTopWidth: 1, borderTopColor: design.line }}>
      <Image source={colors.dark ? require('../../assets/spotify/logo-white.png') : require('../../assets/spotify/logo-black.png')} resizeMode="contain" accessibilityLabel="Spotify" style={{ width: 84, height: 25, zIndex: 1 }} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><BodyText style={{ color: design.secondary, fontSize: typography.small.fontSize }}>{connected ? state.profile?.name ?? 'Compte connecté' : 'Connecter mon compte'}</BodyText><Icon name="arrow-forward" color={design.secondary} size={14} /></View>
    </Pressable>

    <Modal visible={active && connection} animationType={reduceMotion ? 'none' : 'slide'} presentationStyle="pageSheet" onRequestClose={() => setConnection(false)}>
      <View style={{ flex: 1, backgroundColor: design.background }}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 24, paddingTop: insets.top + 18, paddingBottom: insets.bottom + 24, gap: 24 }}>
        <View style={s.row}><DisplayText style={{ fontSize: 32, lineHeight: 38 }}>VOTRE COMPTE</DisplayText><ActionIcon icon="close" label="Fermer les réglages Spotify" onPress={() => setConnection(false)} /></View>
        <ConnectionCard state={state} openExternal={openExternal} onMessage={setNotice} />
      </ScrollView></View>
    </Modal>
    {active && trackPlaylist && connected && <TrackSheet key={trackPlaylist.id} playlist={trackPlaylist} onClose={() => setTrackPlaylist(null)}
      onOpenPlaylist={() => open(trackPlaylist)} onOpenTrack={track => openTrack(track, trackPlaylist)} />}
  </AppScreen>;
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
});
