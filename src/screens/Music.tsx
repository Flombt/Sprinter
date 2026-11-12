import { useEffect, useRef, useState } from 'react';
import { BackHandler, Pressable, StyleSheet, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import {
  Artwork,
  confirmSpotifySwitch,
  MusicDock,
  PlayerPanel,
  SpotifyBrand,
  useMusic,
} from '../spotify/components';
import { ConnectionCard } from '../spotify/ConnectionCard';
import { music } from '../spotify/device';
import { playlistTitle } from '../spotify/presentation';
import { TrackSheet } from '../spotify/TrackSheet';
import { Button, Card, Copy, Header, Icon, IconButton, Screen } from '../ui/components';
import { confirm } from '../ui/confirm';
import { Switch, TextField } from '../ui/controls';
import { spacing } from '../ui/tokens';
import { useTheme } from '../ui/theme';

type Page = { name: 'library' | 'import' | 'account' | 'player' } | { name: 'playlist'; id: string };
const library: Page = { name: 'library' };

export default function Music({
  onClose,
  foregroundOnlyRun = false,
  active = true,
  playlistImport,
  onPlaylistImportRead,
  initialPlayer = false,
}: {
  onClose?: () => void;
  foregroundOnlyRun?: boolean;
  active?: boolean;
  playlistImport?: string;
  onPlaylistImportRead?: () => void;
  initialPlayer?: boolean;
}) {
  const state = useMusic();
  const { colors } = useTheme();
  const [page, setPage] = useState<Page>(initialPlayer ? { name: 'player' } : library);
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const inputRevision = useRef(0);
  const playlists = state.preferences.playlists;
  const selected = page.name === 'playlist' ? playlists.find((playlist) => playlist.id === page.id) : null;
  const openExternal = (action: () => void) => confirmSpotifySwitch(foregroundOnlyRun, action);
  const goBack = () => {
    if (page.name === 'player' && initialPlayer && onClose) onClose();
    else setPage(library);
  };

  useEffect(() => {
    const revision = inputRevision;
    void music.initialize();
    return () => {
      revision.current++;
    };
  }, []);
  useEffect(() => {
    if (!active) return;
    void music.initialize().then(() => music.syncSaved());
    return music.watchPlayback();
  }, [active]);

  useEffect(() => {
    if (!active || !playlistImport) return;
    inputRevision.current++;
    setInput(playlistImport);
    setError(null);
    setPage({ name: 'import' });
    onPlaylistImportRead?.();
  }, [active, onPlaylistImportRead, playlistImport]);

  useEffect(() => {
    if (!active || page.name === 'library') return;
    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (page.name === 'import') inputRevision.current++;
      if (initialPlayer && page.name === 'player' && onClose) onClose();
      else setPage(library);
      return true;
    });
    return () => handler.remove();
  }, [active, initialPlayer, onClose, page.name]);

  const importPlaylist = async () => {
    if (!input.trim() || state.busy || !state.ready) return;
    const revision = ++inputRevision.current;
    setError(null);
    const added = await music.importPlaylist(input);
    if (revision !== inputRevision.current) return;
    if (!added) {
      setError(music.getSnapshot().message ?? 'Impossible d’enregistrer la playlist.');
      return;
    }
    setInput('');
    const id = music.getSnapshot().preferences.selectedId;
    setPage(id ? { name: 'playlist', id } : library);
  };

  const paste = async () => {
    const revision = ++inputRevision.current;
    try {
      const value = await Clipboard.getStringAsync();
      if (revision === inputRevision.current) setInput(value);
    } catch {
      if (revision === inputRevision.current) setError('Collez le lien directement dans le champ.');
    }
  };

  const refresh = async () => {
    setRefreshing(true);
    try {
      await music.syncSaved(true);
    } finally {
      setRefreshing(false);
    }
  };

  const currentTrack = state.playback?.track;
  const openPlayerSource = () =>
    openExternal(() => {
      if (currentTrack?.url) {
        void music.platform
          .openSpotify(`spotify:${currentTrack.type}:${currentTrack.id}`, currentTrack.url)
          .catch(() => music.openPlaylist());
      } else void music.openPlaylist();
    });

  if (selected) {
    return (
      <View style={{ flex: 1 }}>
        <TrackSheet
          key={selected.id}
          playlist={selected}
          active={active}
          onBack={goBack}
          onAccount={() => setPage({ name: 'account' })}
          openExternal={openExternal}
        />
        {onClose && <MusicDock onExpand={() => setPage({ name: 'player' })} />}
      </View>
    );
  }

  if (page.name === 'import') {
    return (
      <Screen gap={spacing.lg}>
        <Header
          title="Ajouter une playlist"
          onBack={() => {
            inputRevision.current++;
            goBack();
          }}
        />
        <Copy variant="caption" muted>
          Dans Spotify, choisissez Partager puis Copier le lien.
        </Copy>
        <TextField
          label="Lien de playlist Spotify"
          value={input}
          placeholder="https://open.spotify.com/playlist/…"
          onChangeText={(value) => {
            inputRevision.current++;
            setInput(value);
            setError(null);
          }}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          maxLength={2048}
          editable={!state.busy}
        />
        <Button
          title="Coller le lien"
          icon="clipboard-outline"
          variant="secondary"
          onPress={() => void paste()}
          disabled={state.busy}
        />
        <Button
          title={state.busy ? 'Enregistrement…' : 'Importer la playlist'}
          icon="add"
          disabled={!input.trim() || state.busy || !state.ready}
          onPress={() => void importPlaylist()}
        />
        {error && (
          <Copy variant="caption" accessibilityRole="alert" style={{ color: colors.danger }}>
            {error}
          </Copy>
        )}
      </Screen>
    );
  }

  if (page.name === 'account') {
    return (
      <Screen gap={spacing.lg}>
        <Header title="Compte Spotify" onBack={goBack} />
        <ConnectionCard state={state} openExternal={openExternal} onMessage={setError} />
        {(error || state.message) && (
          <Copy variant="caption" accessibilityRole="alert" muted>
            {error || state.message}
          </Copy>
        )}
        {state.status === 'connected' && (
          <View style={styles.row}>
            <Copy variant="caption" style={{ flex: 1 }}>
              Lancer ma playlist au départ
            </Copy>
            <Switch
              accessibilityLabel="Lancer Spotify au départ"
              value={state.preferences.autoPlay}
              disabled={state.busy || state.preferencesSaving}
              onValueChange={(value) => void music.setAutoPlay(value)}
            />
          </View>
        )}
      </Screen>
    );
  }

  if (page.name === 'player') {
    return (
      <Screen gap={spacing.lg}>
        <Header title="En écoute" onBack={goBack} />
        <PlayerPanel state={state} openSpotify={openPlayerSource} />
        {state.status !== 'connected' && music.platform.canAuthenticate && (
          <Button
            title="Connecter Spotify"
            variant="secondary"
            onPress={() => setPage({ name: 'account' })}
          />
        )}
      </Screen>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <Screen gap={spacing.lg}>
        <View style={styles.row}>
          <SpotifyBrand />
          <View style={styles.actions}>
            <IconButton
              icon="person-outline"
              label="Compte Spotify"
              onPress={() => {
                setError(null);
                setPage({ name: 'account' });
              }}
            />
            {onClose && <IconButton icon="close" label="Fermer la musique" onPress={onClose} />}
          </View>
        </View>
        <Header
          title="Ma bibliothèque"
          right={
            <IconButton
              square
              icon="add"
              label="Ajouter une playlist"
              onPress={() => {
                setError(null);
                setPage({ name: 'import' });
              }}
            />
          }
        />
        {!!playlists.length && (
          <View style={styles.row}>
            <Copy variant="caption" muted>
              {playlists.length} {playlists.length === 1 ? 'playlist enregistrée' : 'playlists enregistrées'}
            </Copy>
            <IconButton
              quiet
              icon="refresh-outline"
              label={refreshing ? 'Actualisation en cours' : 'Actualiser les playlists'}
              disabled={refreshing}
              onPress={() => void refresh()}
            />
          </View>
        )}
        {playlists.map((playlist) => {
          const chosen = playlist.id === state.preferences.selectedId;
          const details = [playlist.owner, playlist.count === null ? null : `${playlist.count} titres`]
            .filter(Boolean)
            .join(' · ');
          return (
            <Card key={playlist.id} contentStyle={[styles.row, { padding: spacing.sm }]}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Ouvrir ${playlistTitle(playlist)}`}
                onPress={() => setPage({ name: 'playlist', id: playlist.id })}
                style={styles.playlist}
              >
                <Artwork image={playlist.image} size={64} />
                <View style={{ flex: 1, gap: 3 }}>
                  <Copy variant="emphasis" numberOfLines={2}>
                    {playlistTitle(playlist)}
                  </Copy>
                  {!!details && (
                    <Copy variant="small" muted numberOfLines={2}>
                      {details}
                    </Copy>
                  )}
                  {chosen && (
                    <Copy variant="small" style={{ color: colors.accentText }}>
                      Pour la prochaine course
                    </Copy>
                  )}
                </View>
                <Icon name="chevron-forward" size={16} color={colors.secondary} />
              </Pressable>
              <IconButton
                quiet
                icon="ellipsis-horizontal"
                label={`Retirer ${playlistTitle(playlist)} de Sprinter`}
                onPress={() =>
                  confirm(
                    'Retirer de Sprinter ?',
                    'La playlist reste disponible dans Spotify.',
                    'Retirer',
                    () => void music.remove(playlist.id),
                  )
                }
              />
            </Card>
          );
        })}
        {state.ready && !playlists.length && (
          <Card contentStyle={{ gap: spacing.md }}>
            <Icon name="albums-outline" color={colors.secondary} size={30} />
            <Copy variant="emphasis">Aucune playlist enregistrée</Copy>
            <Button title="Importer un lien Spotify" icon="add" onPress={() => setPage({ name: 'import' })} />
          </Card>
        )}
        {state.message && (
          <Copy variant="caption" muted accessibilityRole="alert">
            {state.message}
          </Copy>
        )}
      </Screen>
      {onClose && <MusicDock onExpand={() => setPage({ name: 'player' })} />}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  actions: { flexDirection: 'row', gap: 6 },
  playlist: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64 },
});
