import type { MusicState, PlaylistReference } from './types';

/** Presentation only: permissions and command availability remain in the store. */
export function playbackPresentation(state: MusicState, now = Date.now()) {
  const playback = state.playback;
  const fresh = state.status === 'connected' && !state.stale && !!playback
    && Number.isFinite(playback.receivedAt) && now >= playback.receivedAt && now - playback.receivedAt <= 15000;
  if (!state.ready) return { kind: 'loading', label: 'Chargement…', fresh: false } as const;
  if (state.status !== 'connected') return { kind: 'disconnected', label: state.status === 'expired' ? 'À reconnecter' : 'Non connecté', fresh: false } as const;
  if (state.playerBusy) return { kind: 'updating', label: 'Commande en cours…', fresh: false } as const;
  if (!playback && !state.stale) return { kind: 'inactive', label: 'Lecture inactive', fresh: false } as const;
  if (!fresh) return { kind: 'unknown', label: playback ? 'État à actualiser' : 'Lecture non synchronisée', fresh: false } as const;
  if (playback.advertisement) return { kind: 'advertisement', label: 'Publicité Spotify', fresh } as const;
  if (playback.playing) return { kind: 'playing', label: 'Lecture en cours', fresh } as const;
  return { kind: 'paused', label: playback.track ? 'En pause' : 'Lecture inactive', fresh } as const;
}

export const playlistTitle = (playlist: PlaylistReference) => playlist.name ?? `Playlist Spotify · …${playlist.id.slice(-6)}`;
export function playlistDetails(playlist: PlaylistReference) {
  return [playlist.owner, playlist.count === null ? null : `${playlist.count} élément${playlist.count === 1 ? '' : 's'}`].filter(Boolean).join(' · ')
    || 'Lien enregistré · détails disponibles après connexion';
}

/** A selection for a future run never establishes the current Spotify context. */
export function selectedPlaybackLabel(state: MusicState, playlist: PlaylistReference) {
  const view = playbackPresentation(state);
  if (!view.fresh || state.playback?.contextUri !== playlist.uri) return null;
  if (view.kind === 'playing') return 'Cette playlist est en cours dans Spotify';
  if (view.kind === 'paused' && state.playback?.track) return 'Cette playlist est en pause dans Spotify';
  return null;
}
