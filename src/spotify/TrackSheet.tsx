import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { music } from './device';
import { SpotifyError } from './auth';
import { Artwork } from './components';
import { playlistTitle } from './presentation';
import type { PlaylistReference, SpotifyTrack } from './types';
import { ActionButton, ActionIcon, BodyText, useDesign, DisplayText, Surface } from '../ui/design';
import { useTheme } from '../ui/theme';

export function TrackSheet({ playlist, onClose, onOpenTrack, onOpenPlaylist }: {
  playlist: PlaylistReference; onClose: () => void;
  onOpenTrack: (track: SpotifyTrack) => void; onOpenPlaylist: () => void;
}) {
  const design = useDesign();
  const [tracks, setTracks] = useState<SpotifyTrack[]>([]), [next, setNext] = useState<number | null>(null);
  const [busy, setBusy] = useState(true), [error, setError] = useState<string | null>(null);
  const request = useRef(0), active = useRef(false), loading = useRef(false);
  const { reduceMotion } = useTheme(), insets = useSafeAreaInsets();
  const load = async (offset = 0) => {
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
  };
  useEffect(() => {
    active.current = true; void load();
    return () => { active.current = false; request.current++; loading.current = false; };
  }, [playlist.id]);
  return <Modal visible animationType={reduceMotion ? 'none' : 'slide'} presentationStyle="pageSheet" onRequestClose={onClose}>
    <View style={{ flex: 1, backgroundColor: design.background }}>
      <ScrollView contentContainerStyle={{ padding: 22, paddingTop: insets.top + 18, paddingBottom: insets.bottom + 28, gap: 18 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <DisplayText style={{ flex: 1, fontSize: 30, lineHeight: 35 }}>LES MORCEAUX.</DisplayText>
          <ActionIcon icon="close" label="Fermer les morceaux" onPress={onClose} />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <Artwork image={playlist.image} size={64} />
          <BodyText style={{ flex: 1, fontSize: 18, fontWeight: '600' }}>{playlistTitle(playlist)}</BodyText>
        </View>
        <ActionButton title="Ouvrir dans Spotify" secondary compact icon="open-outline" onPress={onOpenPlaylist} />
        {error && <BodyText accessibilityRole="alert" style={{ fontSize: 13, color: design.danger }}>{error}</BodyText>}
        <View style={{ gap: 8 }}>{tracks.map((track, index) => <Pressable key={track.id + '-' + index} accessibilityRole="link"
          accessibilityLabel={track.title + ', ' + track.artist + (track.explicit ? ', contenu explicite' : '') + '. Ouvrir dans Spotify.'}
          accessibilityState={{ disabled: !track.url }} disabled={!track.url} onPress={() => onOpenTrack(track)}>
          <Surface contentStyle={{ padding: 10, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Artwork image={track.image} size={44} /><View style={{ flex: 1, gap: 3 }}>
              <BodyText style={{ fontSize: 13, fontWeight: '500' }}>{track.title}</BodyText>
              <BodyText style={{ fontSize: 11, color: design.secondary }}>{track.artist}{track.explicit ? ' · E' : ''}</BodyText>
            </View>
          </Surface>
        </Pressable>)}</View>
        {busy ? <ActivityIndicator color={design.accent} accessibilityLabel="Chargement des morceaux" />
          : next !== null || error ? <ActionButton secondary title={error ? 'Réessayer' : 'Voir plus de morceaux'} onPress={() => void load(next ?? 0)} />
          : !tracks.length && <BodyText style={{ color: design.secondary }}>Aucun morceau accessible dans cette playlist.</BodyText>}
      </ScrollView>
    </View>
  </Modal>;
}
