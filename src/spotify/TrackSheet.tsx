import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { FeedbackPressable } from '../ui/FeedbackPressable';
import { music } from './device';
import { SpotifyError } from './auth';
import { Artwork } from './components';
import { playlistTitle } from './presentation';
import type { PlaylistReference, SpotifyTrack } from './types';
import { ActionButton, ActionIcon, BodyText, useDesign, DisplayText, Surface } from '../ui/design';
import { ScreenList } from '../ui/components';
import { spacing, fontSizes, fontWeights } from '../ui/tokens';

export function TrackSheet({ playlist, onClose, onOpenTrack, onOpenPlaylist }: {
  playlist: PlaylistReference; onClose: () => void;
  onOpenTrack: (track: SpotifyTrack) => void; onOpenPlaylist: () => void;
}) {
  const design = useDesign();
  const [tracks, setTracks] = useState<SpotifyTrack[]>([]), [next, setNext] = useState<number | null>(null);
  const [busy, setBusy] = useState(true), [error, setError] = useState<string | null>(null);
  const request = useRef(0), active = useRef(false), loading = useRef(false);
  const load = useCallback(async (offset = 0) => {
    if (loading.current) return;
    loading.current = true;
    const revision = ++request.current;
    setBusy(true); setError(null);
    const current = () => active.current && revision === request.current && music.getSnapshot().status === 'connected';
    try {
      const result = await music.tracks(playlist.id, offset);
      if (!current()) return;
      setTracks(old => offset ? [...old, ...result.tracks] : result.tracks); setNext(result.nextOffset);
    } catch (cause) {
      if (!current()) return;
      setNext(offset || null);
      setError(cause instanceof SpotifyError && cause.status === 403
        ? 'Spotify ne donne pas accès à ces morceaux. La playlist reste disponible dans Spotify.'
        : cause instanceof Error ? cause.message : 'Les morceaux sont momentanément indisponibles.');
    } finally {
      if (revision === request.current) { loading.current = false; if (active.current) setBusy(false); }
    }
  }, [playlist.id]);
  useEffect(() => {
    active.current = true; void load();
    return () => { active.current = false; request.current++; loading.current = false; };
  }, [load]);
  return <ScreenList data={tracks} keyExtractor={(track, index) => track.id + '-' + index}
    onEndReached={() => { if (tracks.length && next !== null && !busy && !error) void load(next); }} onEndReachedThreshold={.4}
    ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
    ListHeaderComponent={<View style={{ gap: spacing.lg, paddingBottom: spacing.lg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <DisplayText style={{ flex: 1, fontSize: fontSizes.metric, lineHeight: 35 }}>LES MORCEAUX.</DisplayText>
          <ActionIcon icon="close" label="Fermer les morceaux" onPress={onClose} />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <Artwork image={playlist.image} size={64} />
          <BodyText style={{ flex: 1, fontSize: fontSizes.section, fontWeight: fontWeights.semibold }}>{playlistTitle(playlist)}</BodyText>
        </View>
        <ActionButton title="Ouvrir dans Spotify" secondary compact icon="open-outline" onPress={onOpenPlaylist} />
        {error && <BodyText accessibilityRole="alert" style={{ fontSize: fontSizes.caption, color: design.danger }}>{error}</BodyText>}
    </View>}
    renderItem={({ item: track }) => <FeedbackPressable accessibilityRole="link"
          accessibilityLabel={track.title + ', ' + track.artist + (track.explicit ? ', contenu explicite' : '') + '. Ouvrir dans Spotify.'}
          accessibilityState={{ disabled: !track.url }} disabled={!track.url} onPress={() => onOpenTrack(track)}>
          <Surface contentStyle={{ padding: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <Artwork image={track.image} size={44} /><View style={{ flex: 1, gap: 3 }}>
              <BodyText style={{ fontSize: fontSizes.caption, fontWeight: fontWeights.medium }}>{track.title}</BodyText>
              <BodyText style={{ fontSize: fontSizes.small, color: design.secondary }}>{track.artist}{track.explicit ? ' · E' : ''}</BodyText>
            </View>
          </Surface>
        </FeedbackPressable>}
    ListFooterComponent={<View style={{ paddingTop: spacing.lg }}>
        {busy ? <ActivityIndicator color={design.accent} accessibilityLabel="Chargement des morceaux" />
          : next !== null || error ? <ActionButton secondary title={error ? 'Réessayer' : 'Voir plus de morceaux'} onPress={() => void load(next ?? 0)} />
          : !tracks.length && <BodyText style={{ color: design.secondary }}>Aucun morceau accessible dans cette playlist.</BodyText>}
    </View>} />;
}
