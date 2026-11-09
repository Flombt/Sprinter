import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { music } from '../spotify/device';
import { Artwork, confirmSpotifySwitch, PlayerPanel, SpotifyBrand, useMusic } from '../spotify/components';
import { ConnectionCard } from '../spotify/ConnectionCard';
import { PlaylistCard } from '../spotify/PlaylistCard';
import { playlistDetails, playlistTitle, selectedPlaybackLabel } from '../spotify/presentation';
import { controlReason, selectedPlaylist } from '../spotify/store';
import type { PlaylistReference, SpotifyTrack } from '../spotify/types';
import { SpotifyError } from '../spotify/auth';
import { Button, Copy, Divider, Header, Icon, IconButton, Panel, Screen, SectionHeading, styles } from '../ui/components';
import { TextField, Toggle } from '../ui/controls';
import { useAdaptiveLayout, useTheme } from '../ui/theme';
import { interaction, spacing } from '../ui/tokens';

interface TrackList {
  playlist: PlaylistReference; tracks: SpotifyTrack[]; next: number | null; error: string | null;
}

export default function Music({ onClose, foregroundOnlyRun = false }: { onClose?: () => void; foregroundOnlyRun?: boolean }) {
  const state = useMusic(); const { colors } = useTheme(); const { largeText } = useAdaptiveLayout();
  const selected = selectedPlaylist(state); const connected = state.status === 'connected';
  const [input, setInput] = useState(''); const [adding, setAdding] = useState(false);
  const [departureOptions, setDepartureOptions] = useState(false);
  const [trackList, setTrackList] = useState<TrackList | null>(null);
  const [tracksBusy, setTracksBusy] = useState(false); const [libraryBusy, setLibraryBusy] = useState(false);
  const [localMessage, setLocalMessage] = useState<string | null>(null);
  const trackRequest = useRef(0); const inputRevision = useRef(0); const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true; void music.initialize(); const unwatch = music.watchPlayback();
    return () => { mounted.current = false; trackRequest.current++; unwatch(); };
  }, []);
  useEffect(() => {
    if (state.status !== 'connected') { trackRequest.current++; setTrackList(null); setTracksBusy(false); }
  }, [state.status]);

  const openExternal = (action: () => void) => confirmSpotifySwitch(foregroundOnlyRun, action);
  const open = (playlist?: PlaylistReference) => openExternal(() => void music.openPlaylist(playlist));
  const openTrack = (track: SpotifyTrack, fallback?: PlaylistReference) => openExternal(() => {
    if (track.url) void music.platform.openSpotify(`spotify:${track.type}:${track.id}`, track.url).catch(() => music.openPlaylist(fallback));
    else void music.openPlaylist(fallback);
  });
  const openCurrent = () => state.playback?.track ? openTrack(state.playback.track) : open();
  const loadLibrary = async (more = false) => {
    if (libraryBusy) return;
    setLibraryBusy(true);
    try { await music.loadLibrary(more); } finally { if (mounted.current) setLibraryBusy(false); }
  };
  const closeTracks = () => { trackRequest.current++; setTrackList(null); setTracksBusy(false); };
  const showTracks = async (playlist: PlaylistReference, more = false) => {
    if (more && (tracksBusy || trackList?.playlist.id !== playlist.id || trackList.next === null)) return;
    const request = ++trackRequest.current;
    const offset = more ? trackList?.next ?? 0 : 0;
    setTracksBusy(true);
    if (!more) setTrackList({ playlist, tracks: [], next: null, error: null });
    else setTrackList(old => old ? { ...old, error: null } : old);
    const current = () => mounted.current && request === trackRequest.current && music.getSnapshot().status === 'connected';
    try {
      const result = await music.tracks(playlist.id, offset);
      if (!current()) return;
      setTrackList(old => ({ playlist, tracks: more ? [...(old?.tracks ?? []), ...result.tracks] : result.tracks, next: result.nextOffset, error: null }));
    } catch (error) {
      if (!current()) return;
      setTrackList(old => ({ playlist, tracks: more ? old?.tracks ?? [] : [], next: more ? offset : null,
        error: error instanceof SpotifyError && error.status === 403
          ? 'Morceaux inaccessibles : Spotify peut les réserver au propriétaire ou à ses collaborateurs, ou vos permissions sont insuffisantes. Le lien reste utilisable dans Spotify.'
          : error instanceof SpotifyError ? error.message : 'Les morceaux sont momentanément indisponibles.' }));
    } finally { if (mounted.current && request === trackRequest.current) setTracksBusy(false); }
  };
  const paste = async () => {
    const revision = ++inputRevision.current;
    try { const value = await Clipboard.getStringAsync(); if (mounted.current && revision === inputRevision.current) { setInput(value); setLocalMessage(null); } }
    catch { if (mounted.current) setLocalMessage('Collage indisponible. Collez le lien directement dans le champ.'); }
  };
  const addPlaylist = async () => {
    if (!state.ready || adding || state.busy || !input.trim()) return;
    inputRevision.current++;
    setAdding(true);
    try { const ok = await music.importPlaylist(input); if (ok && mounted.current) setInput(''); }
    finally { if (mounted.current) setAdding(false); }
  };

  // An actual playlist detail, backed by the existing API; returning invalidates pending responses.
  if (trackList) return <Screen key="music-tracks">
    <Header title={playlistTitle(trackList.playlist)} subtitle="Morceaux Spotify" onBack={closeTracks} />
    <Panel style={{ gap: spacing.md }}>
      <Artwork image={trackList.playlist.image} size={96} />
      <Copy muted variant="caption">{playlistDetails(trackList.playlist)}</Copy>
      <SpotifyBrand onPress={() => open(trackList.playlist)} caption="Ouvrir la playlist ↗" />
    </Panel>
    {trackList.error && <Copy accessibilityRole="alert" style={{ color: colors.orange }} variant="caption">{trackList.error}</Copy>}
    <View style={{ gap: spacing.sm }}>
      {trackList.tracks.map((track, index) => <Pressable key={`${track.id}-${index}`} accessibilityRole="link"
        accessibilityLabel={`${track.title}, ${track.artist}${track.explicit ? ', contenu explicite' : ''}. Ouvrir dans Spotify.`}
        accessibilityState={{ disabled: !track.url }} disabled={!track.url} onPress={() => openTrack(track, trackList.playlist)}
        style={({ pressed }) => ({ opacity: pressed ? interaction.pressedOpacity : 1 })}>
        <Panel variant="list" style={{ flexDirection: largeText ? 'column' : 'row', alignItems: largeText ? 'flex-start' : 'center', gap: spacing.md }}>
          <Artwork image={track.image} size={48} />
          <View style={{ flex: largeText ? undefined : 1, minWidth: 0, gap: spacing.xs }}>
            <Copy variant="emphasis">{track.title}</Copy><Copy muted variant="caption">{track.artist}</Copy>
            {track.explicit && <Copy variant="small" muted>Contenu explicite</Copy>}
          </View><Icon name="open-outline" size={16} color={colors.secondary} />
        </Panel>
      </Pressable>)}
    </View>
    {tracksBusy ? <ActivityIndicator accessibilityLabel="Chargement des morceaux" color={colors.secondary} />
      : trackList.next !== null ? <Button title={trackList.error ? 'Réessayer la suite' : 'Afficher la suite'} secondary onPress={() => void showTracks(trackList.playlist, true)} />
      : trackList.error ? <Button title="Réessayer" secondary onPress={() => void showTracks(trackList.playlist)} />
      : !trackList.tracks.length && <Copy muted>Aucun morceau accessible dans cette playlist.</Copy>}
    <Copy muted variant="small">Les morceaux s’écoutent dans Spotify. Leur disponibilité dépend des autorisations de votre compte.</Copy>
  </Screen>;

  const cards = (playlists: PlaylistReference[]) => playlists.map(playlist => <PlaylistCard key={playlist.id} playlist={playlist}
    selected={playlist.id === state.preferences.selectedId} saved={state.preferences.playlists.some(p => p.id === playlist.id)}
    connected={connected} disabled={!state.ready || state.busy} onTracks={() => void showTracks(playlist)} onOpen={() => open(playlist)} />);
  const playReason = selected && connected ? controlReason(state, 'play') : null;
  const contextLabel = selected ? selectedPlaybackLabel(state, selected) : null;
  return <Screen key="music-home">
    <Header title="Musique" subtitle="Votre bande-son" onBack={onClose} />
    <Copy muted>Votre musique accompagne la course. Le coach garde le tempo.</Copy>
    {state.message && <Panel variant="setting"><View style={[styles.row, { gap: spacing.sm, alignItems: 'flex-start' }]}>
      <Copy accessibilityRole="alert" accessibilityLiveRegion="polite" variant="caption" style={{ flex: 1 }}>{state.message}</Copy>
      <IconButton icon="close" label="Fermer le message Spotify" quiet onPress={music.clearMessage} />
    </View></Panel>}
    {localMessage && <Copy accessibilityRole="alert" variant="caption" style={{ color: colors.orange }}>{localMessage}</Copy>}
    <ConnectionCard state={state} openExternal={openExternal} onMessage={setLocalMessage} />
    {connected && <PlayerPanel state={state} openSpotify={openCurrent} />}

    {(selected || state.preferences.playlists.length > 0) && <View style={{ gap: spacing.md }}>
      <SectionHeading title="Pour la prochaine course" />
      <Panel style={{ gap: spacing.lg }}>
        {selected ? <>
          <View style={{ flexDirection: largeText ? 'column' : 'row', alignItems: largeText ? 'flex-start' : 'center', gap: spacing.md }}>
            <Artwork image={selected.image} size={64} />
            <View style={{ flex: largeText ? undefined : 1, minWidth: 0, gap: spacing.xs }}>
              <Copy variant="emphasis">{playlistTitle(selected)}</Copy>
              <Copy muted variant="caption">{playlistDetails(selected)}</Copy>
            </View>
          </View>
          <Copy muted variant="caption">{contextLabel ?? 'Ce choix prépare votre prochaine course. Il ne change pas la lecture actuelle de Spotify.'}</Copy>
          {connected ? <>
            <Button title="Lancer cette playlist" icon="play" disabled={!!playReason} hint={playReason ?? undefined} onPress={() => void music.playSelected()} />
            {playReason && <Copy muted variant="caption">{playReason}</Copy>}
          </> : <Copy muted variant="caption">Ouvrez la playlist dans Spotify avant de démarrer, puis revenez dans Sprinter.</Copy>}
          <SpotifyBrand onPress={() => open(selected)} caption="Ouvrir la playlist ↗" />
          <Pressable accessibilityRole="button" accessibilityState={{ expanded: departureOptions }} onPress={() => setDepartureOptions(!departureOptions)}
            style={[styles.row, { gap: spacing.sm, minHeight: 44 }]}>
            <Icon name="options-outline" size={18} color={colors.secondary} />
            <Copy muted variant="caption" style={{ flex: 1 }}>{connected && state.preferences.autoPlay ? 'Lancement avec la course activé' : 'Options de départ'}</Copy>
            <Icon name={departureOptions ? 'chevron-up' : 'chevron-down'} size={16} color={colors.secondary} />
          </Pressable>
          {departureOptions && <View style={{ gap: spacing.md }}>
            <Divider />
            {connected && <Toggle title="Lancer avec ma course" body="Si Spotify dispose d’un appareil actif et autorise la lecture."
              value={state.preferences.autoPlay} disabled={state.busy} onChange={value => void music.setAutoPlay(value)} />}
            <Button title="Ne pas choisir de playlist" variant="quiet" disabled={state.busy} onPress={() => void music.select(null)} />
          </View>}
        </> : <>
          <View style={[styles.row, { gap: spacing.md }]}><Icon name="headset-outline" color={colors.secondary} /><Copy variant="emphasis" style={{ flex: 1 }}>Sans playlist sélectionnée</Copy></View>
          <Copy muted variant="caption">Choisissez une playlist ci-dessous ou partez ainsi. Votre lecture Spotify reste indépendante.</Copy>
        </>}
      </Panel>
    </View>}

    <View style={{ gap: spacing.md }}>
      <SectionHeading title="Ajouter une playlist" />
      <Panel style={{ gap: spacing.md }}>
        {!state.preferences.playlists.length && <View style={{ gap: spacing.xs }}>
          <Copy variant="emphasis">Retrouvez votre playlist avant chaque sortie.</Copy>
          <Copy muted variant="caption">Copiez son lien depuis Spotify. Vous pourrez l’enregistrer sans connecter votre compte.</Copy>
        </View>}
        <TextField label="Lien de playlist Spotify" value={input} onChangeText={value => { inputRevision.current++; setInput(value); }} editable={!adding}
          placeholder="https://open.spotify.com/playlist/…" accessibilityHint="Un lien Spotify ou une URI spotify:playlist est accepté."
          autoCapitalize="none" autoCorrect={false} keyboardType="url" onSubmitEditing={() => void addPlaylist()} />
        <View style={{ flexDirection: largeText ? 'column' : 'row', gap: spacing.sm }}>
          <Button title="Coller le lien" icon="clipboard-outline" variant="secondary" disabled={adding} onPress={() => void paste()} style={{ flex: largeText ? undefined : 1 }} />
          <Button title={adding ? 'Ajout…' : 'Ajouter'} icon="add" disabled={!state.ready || state.busy || adding || !input.trim()} onPress={() => void addPlaylist()} style={{ flex: largeText ? undefined : 1 }} />
        </View>
        <Copy muted variant="small">Liens Spotify et URI spotify:playlist acceptés. Seule la référence est enregistrée, aucun fichier musical.</Copy>
      </Panel>
    </View>

    {state.preferences.playlists.length > 0 && <View style={{ gap: spacing.md }}>
      <SectionHeading title="Vos playlists" />
      <Copy muted variant="caption">{state.preferences.playlists.length} référence{state.preferences.playlists.length > 1 ? 's' : ''} enregistrée{state.preferences.playlists.length > 1 ? 's' : ''} · touchez une playlist pour la choisir.</Copy>
      {cards(state.preferences.playlists)}
    </View>}
    {connected && <View style={{ gap: spacing.md }}>
      <SectionHeading title="Playlists du compte" />
      <Copy muted variant="caption">Retrouvez les playlists accessibles à votre compte, puis enregistrez celles que vous souhaitez utiliser en course.</Copy>
      <Button title={libraryBusy ? 'Actualisation…' : 'Actualiser mes playlists'} icon="refresh-outline" secondary disabled={libraryBusy || state.busy} onPress={() => void loadLibrary()} />
      {cards(state.library)}
      {libraryBusy && <ActivityIndicator accessibilityLabel="Chargement des playlists" color={colors.secondary} />}
      {!libraryBusy && state.nextOffset !== null && <Button title="Charger d’autres playlists" secondary disabled={state.busy} onPress={() => void loadLibrary(true)} />}
      {!libraryBusy && !state.library.length && <Panel variant="setting"><Copy muted variant="caption">Aucune playlist chargée. Actualisez la liste, ou ajoutez directement un lien Spotify.</Copy></Panel>}
    </View>}
    <Copy muted variant="small">Les commandes de lecture nécessitent Spotify Premium, les autorisations correspondantes et un appareil actif. La musique reste diffusée par Spotify et ne bloque jamais votre course. Les contrôles se synchronisent au premier plan ; écran verrouillé, utilisez Spotify ou vos écouteurs. Sprinter n’est pas approuvé par Spotify.</Copy>
  </Screen>;
}
