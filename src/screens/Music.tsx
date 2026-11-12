import { Switch } from '../ui/controls';
import { controlColors, interaction, paperColors, spacing, typography } from '../ui/tokens';
import {
  Button,
  Card,
  Copy,
  Icon,
  IconButton,
  Label,
  Screen,
  SectionLabel,
  StatusBadge,
} from '../ui/components';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { music } from '../spotify/device';
import {
  Artwork,
  confirmSpotifySwitch,
  PlaybackControls,
  PlayerPanel,
  useMusic,
} from '../spotify/components';
import { TrackSheet } from '../spotify/TrackSheet';
import { ConnectionCard } from '../spotify/ConnectionCard';
import { playbackPresentation, playlistTitle } from '../spotify/presentation';
import { controlReason, selectedPlaylist } from '../spotify/store';
import type { PlaylistReference, SpotifyTrack } from '../spotify/types';
import { useTheme } from '../ui/theme';

export default function Music({
  onClose,
  foregroundOnlyRun = false,
  active = true,
}: {
  onClose?: () => void;
  foregroundOnlyRun?: boolean;
  active?: boolean;
}) {
  const state = useMusic(),
    { colors, reduceMotion } = useTheme(),
    insets = useSafeAreaInsets();
  const [input, setInput] = useState(''),
    [adding, setAdding] = useState(false),
    [connection, setConnection] = useState(false);
  const [notice, setNotice] = useState<string | null>(null),
    [noticeError, setNoticeError] = useState(false);
  const [libraryBusy, setLibraryBusy] = useState(false);
  const [trackPlaylist, setTrackPlaylist] = useState<PlaylistReference | null>(null),
    [playerOptions, setPlayerOptions] = useState(false);
  const mounted = useRef(false),
    inputRevision = useRef(0);
  const selected = selectedPlaylist(state),
    connected = state.status === 'connected';
  const playback = playbackPresentation(state);
  const playlists = [
    ...new Map([...state.preferences.playlists, ...state.library].map((p) => [p.id, p])).values(),
  ];
  useEffect(() => {
    mounted.current = true;
    void music.initialize();
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => (active ? music.watchPlayback() : undefined), [active]);
  useEffect(() => {
    if (active && connected && !music.getSnapshot().library.length) void music.loadLibrary();
  }, [active, connected]);
  useEffect(() => {
    if (!connected) {
      setTrackPlaylist(null);
      setPlayerOptions(false);
    }
  }, [connected]);
  const openExternal = (action: () => void) => confirmSpotifySwitch(foregroundOnlyRun, action);
  const open = (playlist: PlaylistReference) => openExternal(() => void music.openPlaylist(playlist));
  const openTrack = (track?: SpotifyTrack, fallback?: PlaylistReference) =>
    openExternal(() => {
      if (track?.url)
        void music.platform
          .openSpotify('spotify:' + track.type + ':' + track.id, track.url)
          .catch(() => music.openPlaylist(fallback));
      else void music.openPlaylist(fallback);
    });
  const importPlaylist = async () => {
    if (!input.trim() || adding || state.busy || !state.ready) return;
    const revision = ++inputRevision.current,
      value = input;
    setAdding(true);
    setNotice(null);
    music.clearMessage();
    try {
      const ok = await music.importPlaylist(value);
      if (!mounted.current) return;
      if (ok) {
        if (inputRevision.current === revision) setInput('');
        setNotice('Playlist ajoutée.');
        setNoticeError(false);
        music.clearMessage();
      }
    } finally {
      if (mounted.current) setAdding(false);
    }
  };
  const paste = async () => {
    const revision = ++inputRevision.current;
    try {
      const value = await Clipboard.getStringAsync();
      if (mounted.current && revision === inputRevision.current) {
        setInput(value);
        setNotice(null);
      }
    } catch {
      if (mounted.current) {
        setNotice('Collez votre lien directement dans le champ.');
        setNoticeError(true);
      }
    }
  };
  const loadMore = async () => {
    if (libraryBusy) return;
    setLibraryBusy(true);
    try {
      await music.loadLibrary(true);
    } finally {
      if (mounted.current) setLibraryBusy(false);
    }
  };
  return (
    <Screen gap={spacing.xl}>
      <View style={s.row}>
        <View>
          <Label>VOTRE BANDE-SON</Label>
          <Copy variant="condensedTitle" accessibilityRole="header">
            MUSIQUE.
          </Copy>
        </View>
        <IconButton
          square
          icon={onClose ? 'close' : 'person-outline'}
          label={onClose ? 'Fermer Spotify' : 'Connexion et compte Spotify'}
          onPress={onClose ?? (() => setConnection(true))}
        />
      </View>

      <Card variant="paper" contentStyle={{ padding: 18, gap: 13 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Icon name="link-outline" color={colors.heroText} size={17} />
          <Label style={{ color: paperColors.label }}>AJOUTER UNE PLAYLIST</Label>
        </View>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            borderRadius: 9,
            borderWidth: 1,
            borderColor: paperColors.line,
            backgroundColor: paperColors.field,
          }}
        >
          <TextInput
            accessibilityLabel="Lien de playlist Spotify"
            placeholder="Collez votre lien Spotify…"
            placeholderTextColor={paperColors.placeholder}
            value={input}
            onChangeText={(value) => {
              inputRevision.current++;
              setInput(value);
              setNotice(null);
            }}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            returnKeyType="done"
            onSubmitEditing={() => void importPlaylist()}
            maxLength={2048}
            editable={!adding}
            selectionColor={colors.heroAction}
            style={{
              flex: 1,
              minWidth: 0,
              minHeight: 50,
              paddingHorizontal: 12,
              color: colors.heroText,
              fontSize: 13,
            }}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Coller le lien Spotify"
            disabled={adding}
            onPress={() => void paste()}
            style={{ width: 44, minHeight: 50, alignItems: 'center', justifyContent: 'center' }}
          >
            <Icon name="clipboard-outline" size={17} color={paperColors.label} />
          </Pressable>
        </View>
        <Button
          highContrast
          onHero
          arrow
          size="compact"
          title={adding ? 'Import en cours…' : 'Importer la playlist'}
          icon="add"
          onPress={() => void importPlaylist()}
          disabled={!input.trim() || adding || state.busy || !state.ready}
        />
      </Card>

      {(notice || state.message) && (
        <View
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}
        >
          <Icon
            name={notice && !noticeError ? 'checkmark-circle-outline' : 'information-circle-outline'}
            size={17}
            color={notice && !noticeError ? colors.text : colors.danger}
          />
          <Copy
            variant="bodyCompact"
            style={{ flex: 1, fontSize: 12, color: notice && !noticeError ? colors.text : colors.danger }}
          >
            {notice ?? state.message}
          </Copy>
          <IconButton
            square
            icon="close"
            label="Fermer le message Spotify"
            onPress={() => {
              setNotice(null);
              music.clearMessage();
            }}
          />
        </View>
      )}

      {selected && (
        <View style={{ gap: 13 }}>
          <View style={s.row}>
            <Label>POUR LA COURSE</Label>
            <StatusBadge
              label={state.preferencesSaving ? 'ENREGISTREMENT…' : 'SÉLECTIONNÉE'}
              active={!state.preferencesSaving}
            />
          </View>
          <Card
            style={{ borderLeftWidth: 3, borderLeftColor: colors.line }}
            contentStyle={{ padding: 17, gap: 16 }}
          >
            <View style={{ flexDirection: 'row', gap: 17, alignItems: 'center' }}>
              <Artwork image={selected.image} size={64} />
              <View style={{ flex: 1, gap: 5 }}>
                <Copy
                  variant="bodyCompact"
                  numberOfLines={2}
                  style={{ fontSize: 17, lineHeight: 23, fontWeight: '600', letterSpacing: -0.3 }}
                >
                  {playlistTitle(selected)}
                </Copy>
                <Copy
                  variant="bodyCompact"
                  numberOfLines={1}
                  style={{ fontSize: typography.small.fontSize, color: colors.secondary }}
                >
                  {[selected.owner, selected.count !== null ? selected.count + ' titres' : 'Playlist Spotify']
                    .filter(Boolean)
                    .join(' · ')}
                </Copy>
              </View>
            </View>
            <Button
              highContrast
              arrow
              size="compact"
              title={
                connected && !controlReason(state, 'play') ? 'Lancer la playlist' : 'Ouvrir dans Spotify'
              }
              icon="play"
              onPress={() => {
                if (connected && !controlReason(state, 'play')) void music.playSelected();
                else open(selected);
              }}
            />
            {connected && (
              <View style={s.row}>
                <Copy variant="bodyCompact" style={{ flex: 1, fontSize: 12, color: colors.secondary }}>
                  Lancer avec la course
                </Copy>
                <Switch
                  accessibilityRole="switch"
                  trackColor={{ false: controlColors.switchTrackOff, true: colors.switchOn }}
                  accessibilityLabel="Lancer Spotify avec la course"
                  value={state.preferences.autoPlay}
                  disabled={state.busy || state.preferencesSaving}
                  onValueChange={(value) => void music.setAutoPlay(value)}
                />
              </View>
            )}
            <View style={s.row}>
              {connected && (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setTrackPlaylist(selected)}
                  style={{ minHeight: 44, justifyContent: 'center' }}
                >
                  <Copy variant="bodyCompact" style={{ fontSize: 12, color: colors.accentText }}>
                    Voir les morceaux
                  </Copy>
                </Pressable>
              )}
              <Pressable
                accessibilityRole="button"
                disabled={state.busy || state.preferencesSaving}
                onPress={() => void music.select(null)}
                style={{ minHeight: 44, justifyContent: 'center' }}
              >
                <Copy variant="bodyCompact" style={{ fontSize: 12, color: colors.secondary }}>
                  Partir sans playlist
                </Copy>
              </Pressable>
            </View>
          </Card>
        </View>
      )}

      {connected && state.playback?.track && (
        <Card contentStyle={{ gap: 15 }}>
          <View style={s.row}>
            <Label>EN ÉCOUTE</Label>
            <IconButton
              square
              icon="refresh-outline"
              label="Actualiser le lecteur Spotify"
              onPress={() => void music.refreshPlayback(true)}
              disabled={state.playerBusy}
            />
          </View>
          <View style={{ flexDirection: 'row', gap: 13, alignItems: 'center' }}>
            <Artwork image={state.playback.track.image} size={48} />
            <View style={{ flex: 1, gap: 2 }}>
              <Copy variant="bodyCompact" numberOfLines={1} style={{ fontSize: 14, fontWeight: '500' }}>
                {state.playback.track.title}
              </Copy>
              <Copy
                variant="bodyCompact"
                numberOfLines={1}
                style={{ fontSize: typography.small.fontSize, color: colors.secondary }}
              >
                {state.playback.track.artist}
              </Copy>
            </View>
          </View>
          <PlaybackControls state={state} />
          <Copy
            variant="bodyCompact"
            style={{
              fontSize: typography.small.fontSize,
              color: playback.fresh ? colors.text : colors.secondary,
              textAlign: 'center',
            }}
          >
            {playback.label}
          </Copy>
        </Card>
      )}

      {connected && (
        <View style={{ gap: 12 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: playerOptions }}
            onPress={() => setPlayerOptions(!playerOptions)}
            style={{ ...s.row, minHeight: 44 }}
          >
            <Copy variant="bodyCompact" style={{ fontSize: 12, color: colors.secondary }}>
              Options du lecteur
            </Copy>
            <Icon name={playerOptions ? 'chevron-up' : 'chevron-down'} size={16} color={colors.secondary} />
          </Pressable>
          {playerOptions && (
            <PlayerPanel state={state} openSpotify={() => openTrack(state.playback?.track ?? undefined)} />
          )}
        </View>
      )}

      <View style={{ gap: 13 }}>
        <View style={s.row}>
          <SectionLabel
            title="VOS PLAYLISTS"
            meta={playlists.length > 0 ? String(playlists.length).padStart(2, '0') : undefined}
          />
          {connected && (
            <IconButton
              square
              icon="refresh-outline"
              label="Actualiser mes playlists"
              onPress={() => void music.loadLibrary()}
              disabled={state.busy}
            />
          )}
        </View>
        {!state.ready ? (
          <ActivityIndicator color={colors.secondary} accessibilityLabel="Chargement des playlists" />
        ) : playlists.length ? (
          playlists.map((playlist) => {
            const chosen = selected?.id === playlist.id,
              saved = state.preferences.playlists.some((p) => p.id === playlist.id);
            return (
              <Card
                key={playlist.id}
                style={{
                  borderRadius: 12,
                  borderLeftWidth: 3,
                  borderLeftColor: chosen ? colors.accent : colors.line,
                }}
                contentStyle={{ padding: 11, flexDirection: 'row', gap: 8, alignItems: 'center' }}
              >
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={'Choisir ' + playlistTitle(playlist)}
                  accessibilityState={{ selected: chosen, disabled: state.busy }}
                  disabled={state.busy}
                  onPress={() => void music.select(playlist)}
                  style={({ pressed }) => ({
                    flex: 1,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                    opacity: pressed ? interaction.pressedOpacity : 1,
                    minHeight: 54,
                  })}
                >
                  <Artwork image={playlist.image} size={48} />
                  <View style={{ flex: 1, gap: 3 }}>
                    <Copy variant="bodyCompact" numberOfLines={1} style={{ fontSize: 13, fontWeight: '500' }}>
                      {playlistTitle(playlist)}
                    </Copy>
                    <Copy
                      variant="bodyCompact"
                      style={{
                        color: chosen ? colors.accentText : colors.secondary,
                        fontSize: typography.small.fontSize,
                      }}
                    >
                      {chosen ? 'Pour la prochaine course' : (playlist.owner ?? 'Enregistrée dans Sprinter')}
                    </Copy>
                  </View>
                  <Icon
                    name={chosen ? 'checkmark-circle' : 'radio-button-off-outline'}
                    color={chosen ? colors.accentText : colors.muted}
                    size={21}
                  />
                </Pressable>
                {connected && (
                  <IconButton
                    square
                    icon="list-outline"
                    label={'Voir les morceaux de ' + playlistTitle(playlist)}
                    onPress={() => setTrackPlaylist(playlist)}
                  />
                )}
                {saved && (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={'Retirer ' + playlistTitle(playlist) + ' de Sprinter'}
                    disabled={state.busy}
                    onPress={() => void music.remove(playlist.id)}
                    style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Icon name="close" color={colors.muted} size={16} />
                  </Pressable>
                )}
              </Card>
            );
          })
        ) : (
          <Card contentStyle={{ flexDirection: 'row', gap: 14, alignItems: 'center', paddingVertical: 23 }}>
            <Icon name="albums-outline" size={26} color={colors.secondary} />
            <View style={{ flex: 1, gap: 4 }}>
              <Copy variant="bodyCompact" style={{ fontSize: 14, fontWeight: '600' }}>
                Aucune playlist pour le moment
              </Copy>
              <Copy variant="bodyCompact" style={{ color: colors.secondary, fontSize: 12, lineHeight: 18 }}>
                Importez un lien ou retrouvez votre compte.
              </Copy>
            </View>
          </Card>
        )}
        {connected && state.nextOffset !== null && (
          <Button
            highContrast
            size="large"
            title={libraryBusy ? 'Chargement…' : 'Voir plus de playlists'}
            variant="secondary"
            disabled={libraryBusy}
            onPress={() => void loadMore()}
          />
        )}
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={connected ? 'Gérer le compte Spotify' : 'Connecter mon compte Spotify'}
        onPress={() => setConnection(true)}
        style={{
          minHeight: 58,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          borderTopWidth: 1,
          borderTopColor: colors.line,
        }}
      >
        <Image
          source={
            colors.dark
              ? require('../../assets/spotify/logo-white.png')
              : require('../../assets/spotify/logo-black.png')
          }
          resizeMode="contain"
          accessibilityLabel="Spotify"
          style={{ width: 84, height: 25, zIndex: 1 }}
        />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Copy
            variant="bodyCompact"
            style={{ color: colors.secondary, fontSize: typography.small.fontSize }}
          >
            {connected ? (state.profile?.name ?? 'Compte connecté') : 'Connecter mon compte'}
          </Copy>
          <Icon name="arrow-forward" color={colors.secondary} size={14} />
        </View>
      </Pressable>

      <Modal
        visible={active && connection}
        animationType={reduceMotion ? 'none' : 'slide'}
        presentationStyle="pageSheet"
        onRequestClose={() => setConnection(false)}
      >
        <View style={{ flex: 1, backgroundColor: colors.background }}>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{
              padding: 24,
              paddingTop: insets.top + 18,
              paddingBottom: insets.bottom + 24,
              gap: 24,
            }}
          >
            <View style={s.row}>
              <Copy variant="condensedTitle" style={{ fontSize: 32, lineHeight: 38 }}>
                VOTRE COMPTE
              </Copy>
              <IconButton
                square
                icon="close"
                label="Fermer les réglages Spotify"
                onPress={() => setConnection(false)}
              />
            </View>
            <ConnectionCard state={state} openExternal={openExternal} onMessage={setNotice} />
          </ScrollView>
        </View>
      </Modal>
      {active && trackPlaylist && connected && (
        <TrackSheet
          key={trackPlaylist.id}
          playlist={trackPlaylist}
          onClose={() => setTrackPlaylist(null)}
          onOpenPlaylist={() => open(trackPlaylist)}
          onOpenTrack={(track) => openTrack(track, trackPlaylist)}
        />
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
});
