import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { duration } from '../core/format';
import { Button, Copy, Header, Icon, IconButton } from '../ui/components';
import { useBottomBarInset } from '../ui/layout';
import { ScreenEntrance } from '../ui/motion';
import { interaction, layout, spacing } from '../ui/tokens';
import { useTheme } from '../ui/theme';
import { Artwork, PlaybackControls, SpotifyBrand, useMusic } from './components';
import { music } from './device';
import { PlaylistEmbed } from './PlaylistEmbed';
import { playbackPresentation, playlistTitle } from './presentation';
import { controlReason } from './store';
import type { PlaylistReference, PlaylistTrack } from './types';

const emptyTracks: PlaylistTrack[] = [];

export function TrackSheet({
  playlist,
  active,
  onBack,
  onAccount,
  openExternal,
}: {
  playlist: PlaylistReference;
  active: boolean;
  onBack: () => void;
  onAccount: () => void;
  openExternal: (action: () => void) => void;
}) {
  const state = useMusic();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const dock = useBottomBarInset();
  const { width } = useWindowDimensions();
  const [preview, setPreview] = useState(false);
  const connected = state.status === 'connected';
  const contents = state.playlistContents?.[playlist.id];
  const tracks = contents?.tracks ?? emptyTracks;
  const count = contents?.total ?? playlist.count;
  const totalDuration = useMemo(() => {
    if (!tracks.length || (count !== null && count !== tracks.length)) return null;
    if (tracks.some((track) => !Number.isFinite(track.durationMs) || track.durationMs <= 0)) return null;
    return duration(tracks.reduce((total, track) => total + track.durationMs, 0) / 1000);
  }, [count, tracks]);
  const title = playlistTitle(playlist);
  const isCurrent = state.playback?.contextUri === playlist.uri;
  const currentTrack = isCurrent ? state.playback?.track : null;
  const playing = isCurrent && state.playback?.playing === true;
  const activeTrack = playbackPresentation(state).fresh ? currentTrack : null;
  const chosen = state.preferences.selectedId === playlist.id;
  const reason = controlReason(state, playing ? 'pause' : 'play');
  const canShowPreview = !connected || contents?.error === 'restricted';
  const openSpotify = () => openExternal(() => void music.openPlaylist(playlist));
  const details = [
    playlist.owner,
    count !== null ? `${count} ${count === 1 ? 'titre' : 'titres'}` : null,
    totalDuration,
  ]
    .filter(Boolean)
    .join(' · ');
  const page = {
    width: '100%' as const,
    maxWidth: layout.contentWidth,
    alignSelf: 'center' as const,
    paddingHorizontal: Math.max(spacing.lg, insets.left, insets.right),
    paddingTop: insets.top + spacing.md,
    paddingBottom: Math.max(insets.bottom, dock) + spacing.md,
  };

  useEffect(() => {
    if (active) return music.watchPlaylist(playlist.id);
  }, [active, playlist.id]);

  if (preview) {
    return (
      <ScreenEntrance>
        <View style={[page, { flex: 1, gap: spacing.md }]}>
          <Header title={title} subtitle="Lecteur Spotify" onBack={() => setPreview(false)} />
          <PlaylistEmbed id={playlist.id} title={title} />
          <Button
            variant="quiet"
            size="compact"
            title="Ouvrir dans Spotify"
            icon="open-outline"
            onPress={openSpotify}
          />
        </View>
      </ScreenEntrance>
    );
  }

  const listHeader = (
    <View style={{ gap: spacing.md, paddingBottom: spacing.md }}>
      <View style={styles.row}>
        <IconButton icon="chevron-back" label="Retour à la bibliothèque" onPress={onBack} />
        <SpotifyBrand onPress={openSpotify} />
        <IconButton
          quiet
          icon="refresh-outline"
          label="Actualiser la playlist"
          disabled={contents?.refreshing}
          onPress={() => void music.refreshPlaylist(playlist.id, 'manual')}
        />
      </View>
      <View style={{ alignItems: 'center', paddingVertical: spacing.sm }}>
        <Artwork image={playlist.image} size={Math.min(216, Math.max(138, width * 0.54))} />
      </View>
      <Copy variant="condensedTitle" accessibilityRole="header">
        {title}
      </Copy>
      {!!details && (
        <Copy variant="caption" muted>
          {details}
        </Copy>
      )}
      <Button
        title={
          connected
            ? playing
              ? 'Mettre en pause'
              : currentTrack
                ? 'Reprendre la lecture'
                : 'Lire la playlist'
            : 'Écouter les extraits'
        }
        icon={playing ? 'pause' : 'play'}
        disabled={connected && !!reason}
        hint={connected ? (reason ?? undefined) : undefined}
        onPress={() => {
          if (!connected) setPreview(true);
          else if (currentTrack) void music.command(playing ? 'pause' : 'play');
          else void music.playPlaylist(playlist);
        }}
      />
      {connected && isCurrent && <PlaybackControls state={state} />}
      {connected && reason && !state.playerBusy && (
        <Copy variant="small" muted>
          {reason}
        </Copy>
      )}
      {connected && state.message && (
        <Copy variant="small" muted accessibilityRole="alert">
          {state.message}
        </Copy>
      )}
      <View style={styles.row}>
        <Button
          variant="quiet"
          size="compact"
          title={chosen ? 'Prévue pour la course' : 'Choisir pour la course'}
          icon={chosen ? 'checkmark-circle-outline' : 'add-circle-outline'}
          hint={chosen ? 'Touchez pour retirer cette playlist de la prochaine course.' : undefined}
          disabled={state.busy || state.preferencesSaving}
          onPress={() => void music.select(chosen ? null : playlist)}
        />
        <IconButton quiet icon="open-outline" label="Ouvrir la playlist dans Spotify" onPress={openSpotify} />
      </View>
      {contents?.refreshing && !contents.tracks && (
        <ActivityIndicator color={colors.accentText} accessibilityLabel="Synchronisation des titres" />
      )}
      {contents?.error === 'network' && (
        <Copy variant="caption" muted accessibilityRole="alert">
          {tracks.length
            ? 'Derniers titres consultés. La synchronisation a échoué.'
            : 'Synchronisation indisponible. Touchez Actualiser pour réessayer.'}
        </Copy>
      )}
      {contents?.error === 'limited' && (
        <Copy variant="caption" muted>
          Spotify limite temporairement les requêtes. Réessayez dans un instant.
        </Copy>
      )}
      {canShowPreview && (
        <View style={{ gap: spacing.sm }}>
          <Copy variant="caption" muted>
            {connected
              ? 'Spotify réserve la liste complète aux propriétaires et collaborateurs de la playlist.'
              : 'Connectez le compte qui possède cette playlist ou qui y collabore pour afficher tous les titres.'}
          </Copy>
          {connected && (
            <Button title="Écouter les extraits" variant="secondary" onPress={() => setPreview(true)} />
          )}
          {!connected && music.platform.canAuthenticate && (
            <Button title="Connecter Spotify" variant="secondary" onPress={onAccount} />
          )}
        </View>
      )}
      {contents?.tracks && !tracks.length && (
        <Copy variant="caption" muted>
          Aucun titre disponible.
        </Copy>
      )}
    </View>
  );

  return (
    <ScreenEntrance>
      <FlatList
        data={tracks}
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={page}
        ListHeaderComponent={listHeader}
        keyExtractor={(track) => String(track.position)}
        initialNumToRender={12}
        maxToRenderPerBatch={16}
        windowSize={7}
        refreshControl={
          <RefreshControl
            refreshing={!!contents?.refreshing}
            onRefresh={() => void music.refreshPlaylist(playlist.id, 'manual')}
            tintColor={colors.accentText}
          />
        }
        renderItem={({ item }) => {
          const selected = activeTrack?.id === item.id;
          const disabled = !item.playable || !!controlReason(state, 'play');
          const itemUrl = item.url;
          return (
            <View
              style={[
                styles.track,
                {
                  borderBottomColor: colors.line,
                  backgroundColor: selected ? colors.accentSoft : colors.background,
                },
              ]}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Lire ${item.title}, ${item.artist}`}
                accessibilityState={{ disabled, selected }}
                disabled={disabled}
                onPress={() => void music.playPlaylist(playlist, `spotify:${item.type}:${item.id}`)}
                style={({ pressed }) => [
                  styles.trackButton,
                  { opacity: pressed ? interaction.pressedOpacity : 1 },
                ]}
              >
                <Artwork image={item.image} size={44} />
                <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                  <Copy
                    variant="bodyCompact"
                    numberOfLines={2}
                    style={{ color: selected ? colors.accentText : colors.text }}
                  >
                    {item.title}
                  </Copy>
                  <Copy variant="small" muted numberOfLines={1}>
                    {item.artist}
                    {item.explicit ? ' · E' : ''}
                  </Copy>
                </View>
                {selected && (
                  <Icon
                    name={playing ? 'volume-medium-outline' : 'pause-outline'}
                    size={18}
                    color={colors.accentText}
                  />
                )}
                <Copy variant="small" muted>
                  {item.durationMs ? duration(item.durationMs / 1000) : '—'}
                </Copy>
              </Pressable>
              {itemUrl && (
                <IconButton
                  quiet
                  icon="open-outline"
                  label={`Ouvrir ${item.title} dans Spotify`}
                  onPress={() =>
                    openExternal(
                      () =>
                        void music.platform
                          .openSpotify(`spotify:${item.type}:${item.id}`, itemUrl)
                          .catch(() => music.openPlaylist(playlist)),
                    )
                  }
                />
              )}
            </View>
          );
        }}
      />
    </ScreenEntrance>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 6,
  },
  track: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth },
  trackButton: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 60,
    paddingVertical: 6,
  },
});
