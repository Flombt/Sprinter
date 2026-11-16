import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
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
import { selectedPlaylist } from '../spotify/store';
import { TrackSheet } from '../spotify/TrackSheet';
import {
  Button,
  Copy,
  EmptyState,
  Header,
  Icon,
  IconButton,
  Label,
  Screen,
  SectionHeading,
} from '../ui/components';
import { confirm } from '../ui/confirm';
import { Switch, TextField } from '../ui/controls';
import { editorial, interaction, radii, spacing } from '../ui/tokens';
import { InstrumentTheme, useAdaptiveLayout, useTheme } from '../ui/theme';

type Page = { name: 'library' | 'import' | 'account' | 'player' } | { name: 'playlist'; id: string };
const library: Page = { name: 'library' };

export default function Music({
  onClose,
  foregroundOnlyRun = false,
  active = true,
  playlistImport,
  onPlaylistImportRead,
  initialPlayer = false,
  onNestedChange,
}: {
  onClose?: () => void;
  foregroundOnlyRun?: boolean;
  active?: boolean;
  playlistImport?: string;
  onPlaylistImportRead?: () => void;
  initialPlayer?: boolean;
  onNestedChange?: (nested: boolean) => void;
}) {
  const state = useMusic();
  const { colors } = useTheme();
  const { compact, largeText } = useAdaptiveLayout();
  const [pages, setPages] = useState<Page[]>(() => [initialPlayer ? { name: 'player' } : library]);
  const page = pages.at(-1) ?? library;
  const open = (next: Page) => setPages((stack) => [...stack, next]);
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const inputRevision = useRef(0);
  const playlists = state.preferences.playlists;
  const chosen = selectedPlaylist(state);
  const featured = chosen ?? playlists[0];
  const selected = page.name === 'playlist' ? playlists.find((playlist) => playlist.id === page.id) : null;
  const openExternal = (action: () => void) => confirmSpotifySwitch(foregroundOnlyRun, action);
  const nested = pages.length > 1;
  const goBack = useCallback(() => {
    if (!nested) {
      onClose?.();
      return;
    }
    if (page.name === 'import') inputRevision.current++;
    setPages((stack) => stack.slice(0, -1));
  }, [nested, onClose, page.name]);

  useEffect(() => onNestedChange?.(nested), [nested, onNestedChange]);

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
    setPages([library, { name: 'import' }]);
    onPlaylistImportRead?.();
  }, [active, onPlaylistImportRead, playlistImport]);

  useEffect(() => {
    if (!active || !nested) return;
    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      goBack();
      return true;
    });
    return () => handler.remove();
  }, [active, goBack, nested]);

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
    setPages((stack) => (id ? [...stack.slice(0, -1), { name: 'playlist', id }] : [library]));
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

  let secondary: ReactNode;
  if (selected) {
    secondary = (
      <View style={{ flex: 1 }}>
        <TrackSheet
          key={selected.id}
          playlist={selected}
          active={active}
          onBack={goBack}
          onAccount={() => open({ name: 'account' })}
          openExternal={openExternal}
        />
        <MusicDock active={active} observe={false} safe onExpand={() => open({ name: 'player' })} />
      </View>
    );
  } else if (page.name === 'import') {
    secondary = (
      <Screen gap={spacing.lg}>
        <Header editorial title="Ajouter une playlist" onBack={goBack} />
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
  } else if (page.name === 'account') {
    secondary = (
      <Screen gap={spacing.lg}>
        <Header editorial title="Compte Spotify" onBack={goBack} />
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
  } else if (page.name === 'player') {
    secondary = (
      <Screen gap={spacing.lg}>
        <Header editorial title="En écoute" subtitle="Spotify" onBack={goBack} />
        <PlayerPanel state={state} openSpotify={openPlayerSource} />
        {state.status !== 'connected' && music.platform.canAuthenticate && (
          <Button title="Connecter Spotify" variant="secondary" onPress={() => open({ name: 'account' })} />
        )}
      </Screen>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      {(!initialPlayer || pages[0]?.name === 'library') && (
        <View
          style={{ flex: 1, display: secondary ? 'none' : 'flex' }}
          accessibilityElementsHidden={!!secondary}
          importantForAccessibility={secondary ? 'no-hide-descendants' : 'auto'}
        >
          <Screen gap={spacing.xl}>
            <Header
              editorial
              title="Musique"
              subtitle="Spotify"
              onBack={onClose}
              right={
                <IconButton
                  square
                  icon="person-outline"
                  label="Compte Spotify"
                  onPress={() => {
                    setError(null);
                    open({ name: 'account' });
                  }}
                />
              }
            />
            {featured && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  chosen
                    ? `Ouvrir le lecteur, ${playlistTitle(featured)}`
                    : `Voir la playlist, ${playlistTitle(featured)}`
                }
                onPress={() => open(chosen ? { name: 'player' } : { name: 'playlist', id: featured.id })}
                style={({ pressed }) => [
                  styles.feature,
                  {
                    flexDirection: largeText ? 'column-reverse' : 'row',
                    backgroundColor: editorial.surface,
                    opacity: pressed ? interaction.pressedOpacity : 1,
                  },
                ]}
              >
                <View style={{ flex: largeText ? undefined : 1, gap: spacing.xs, minWidth: 0 }}>
                  <Label style={{ color: editorial.secondary }}>
                    {chosen ? 'Playlist pour la sortie' : 'À écouter'}
                  </Label>
                  <Copy variant="title" style={{ color: editorial.ink }}>
                    {playlistTitle(featured)}
                  </Copy>
                  <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
                    <Copy variant="caption" style={{ color: editorial.graph, flexShrink: 1 }}>
                      {chosen ? 'Ouvrir le lecteur' : 'Voir la playlist'}
                    </Copy>
                    <Icon name="arrow-forward" size={16} color={editorial.graph} />
                  </View>
                </View>
                <InstrumentTheme>
                  <Artwork image={featured.image} size={compact ? 82 : 104} />
                </InstrumentTheme>
              </Pressable>
            )}
            {!!playlists.length && (
              <View>
                <SectionHeading
                  editorial
                  title="Ma bibliothèque"
                  action="Importer"
                  onPress={() => {
                    setError(null);
                    open({ name: 'import' });
                  }}
                />
                {playlists.map((playlist) => {
                  const isChosen = playlist.id === state.preferences.selectedId;
                  const details = [
                    playlist.owner,
                    playlist.count === null ? null : `${playlist.count} titres`,
                  ]
                    .filter(Boolean)
                    .join(' · ');
                  return (
                    <View
                      key={playlist.id}
                      style={[styles.row, styles.listItem, { borderColor: colors.line }]}
                    >
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Ouvrir ${playlistTitle(playlist)}`}
                        accessibilityState={{ selected: isChosen }}
                        onPress={() => open({ name: 'playlist', id: playlist.id })}
                        style={({ pressed }) => [
                          styles.playlist,
                          pressed && { opacity: interaction.pressedOpacity },
                        ]}
                      >
                        <Artwork image={playlist.image} size={64} />
                        <View style={{ flex: 1, gap: 3 }}>
                          <Copy variant="emphasis" numberOfLines={largeText ? undefined : 2}>
                            {playlistTitle(playlist)}
                          </Copy>
                          {!!details && (
                            <Copy variant="small" muted numberOfLines={largeText ? undefined : 2}>
                              {details}
                            </Copy>
                          )}
                          {isChosen && (
                            <Copy variant="small" style={{ color: colors.accentText }}>
                              Pour la prochaine course
                            </Copy>
                          )}
                        </View>
                        <Icon
                          name={isChosen ? 'checkmark' : 'chevron-forward'}
                          size={16}
                          color={isChosen ? colors.accentText : colors.secondary}
                        />
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
                    </View>
                  );
                })}
                <View style={styles.row}>
                  <SpotifyBrand />
                  <IconButton
                    quiet
                    icon="refresh-outline"
                    label={refreshing ? 'Actualisation en cours' : 'Actualiser les playlists'}
                    disabled={refreshing}
                    onPress={() => void refresh()}
                  />
                </View>
              </View>
            )}
            {state.ready && !playlists.length && (
              <EmptyState
                icon="musical-notes-outline"
                title="Aucune playlist enregistrée"
                body="Importe un lien Spotify pour retrouver ta playlist avant le départ."
                action={
                  <Button
                    title="Importer un lien Spotify"
                    icon="add"
                    onPress={() => open({ name: 'import' })}
                  />
                }
              />
            )}
            {!state.ready && (
              <View
                accessibilityRole="progressbar"
                accessibilityLabel="Chargement de la bibliothèque"
                style={{ backgroundColor: colors.raised, borderRadius: radii.hero, height: 152 }}
              />
            )}
            {state.message && (
              <Copy variant="caption" muted accessibilityRole="alert">
                {state.message}
              </Copy>
            )}
          </Screen>
          <MusicDock
            active={active && !secondary}
            observe={false}
            safe
            onExpand={() => open({ name: 'player' })}
          />
        </View>
      )}
      {secondary}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  feature: {
    borderRadius: radii.hero,
    minHeight: 152,
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.xl,
  },
  listItem: { borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: spacing.sm },
  playlist: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 64 },
});
