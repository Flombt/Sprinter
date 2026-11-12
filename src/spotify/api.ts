import { HttpFetch, SpotifyAuth, SpotifyError, timedFetch } from './auth';
import { Playback, PlaylistReference, PlaylistTrack, RepeatMode, SpotifyProfile, SpotifyTrack } from './types';
import { playlistReference, spotifyContentUrl, spotifyImage, validPlaylistId } from './links';

type Json = Record<string, any>;
function safeText(value: unknown): string | null { return typeof value === 'string' && value.trim() ? value.slice(0, 1000) : null; }
export function parsePlaylist(value: Json, now = Date.now()): PlaylistReference {
  if (!validPlaylistId(value.id)) throw new SpotifyError('Référence de playlist Spotify invalide.');
  const reference = playlistReference(value.id, now);
  const total = value.items?.total ?? value.tracks?.total;
  return { ...reference, source: 'account', name: safeText(value.name), owner: safeText(value.owner?.display_name),
    image: spotifyImage(value.images?.[0]?.url), count: Number.isInteger(total) && total >= 0 ? total : null,
    fetchedAt: now, snapshotId: safeText(value.snapshot_id) };
}
export function parseTrack(value: Json | null | undefined): SpotifyTrack | null {
  if (!value || (value.type !== 'track' && value.type !== 'episode') || !safeText(value.name)) return null;
  return { id: typeof value.id === 'string' ? value.id : typeof value.uri === 'string' ? value.uri : '',
    title: value.name, artist: value.type === 'episode' ? safeText(value.show?.publisher) ?? safeText(value.show?.name) ?? ''
      : Array.isArray(value.artists) ? value.artists.map((a: Json) => safeText(a?.name)).filter(Boolean).join(', ') : '',
    image: spotifyImage(value.album?.images?.[0]?.url ?? value.images?.[0]?.url),
    url: spotifyContentUrl(value.external_urls?.spotify), durationMs: typeof value.duration_ms === 'number' ? Math.max(0, value.duration_ms) : 0,
    explicit: value.explicit === true, type: value.type };
}
export class SpotifyApi {
  retryAt = 0;
  publicRetryAt = 0;
  constructor(readonly auth: SpotifyAuth, private fetcher: HttpFetch = fetch, private now = Date.now) {}
  async request(path: string, method = 'GET', body?: unknown, retry401 = true): Promise<Json | null> {
    if (!path.startsWith('/') || path.startsWith('//')) throw new SpotifyError('Chemin API Spotify invalide.');
    const url = new URL(`https://api.spotify.com/v1${path}`);
    if (url.origin !== 'https://api.spotify.com' || !url.pathname.startsWith('/v1/')) throw new SpotifyError('Destination Spotify invalide.');
    if (this.now() < this.retryAt) throw new SpotifyError('Spotify limite les requêtes. Réessayez après le délai indiqué.', 429, this.retryAt);
    const session = this.auth.sessionVersion, token = await this.auth.accessToken();
    if (session !== this.auth.sessionVersion) throw new SpotifyError('La session Spotify a changé. Actualisez le lecteur.');
    const response = await timedFetch(this.fetcher, url.toString(), { method, headers: {
      Authorization: `Bearer ${token}`, ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
    if (session !== this.auth.sessionVersion) throw new SpotifyError('La session Spotify a changé. Actualisez le lecteur.');
    if (response.status === 401 && retry401) { await this.auth.accessToken(true); return this.request(path, method, body, false); }
    if (response.status === 204) return null;
    if (!response.ok) {
      let reason = '';
      try { const error = await response.json(); reason = typeof error?.error?.reason === 'string' ? error.error.reason : ''; } catch {}
      if (response.status === 401) { await this.auth.disconnect(); throw new SpotifyError('Votre connexion Spotify a expiré.', 401); }
      if (response.status === 429) {
        const seconds = Number(response.headers.get('Retry-After'));
        this.retryAt = this.now() + (Number.isFinite(seconds) && seconds > 0 ? Math.min(86400, seconds) : 60) * 1000;
        throw new SpotifyError('Spotify limite les requêtes. Le lecteur attend avant de réessayer.', 429, this.retryAt, reason);
      }
      if (response.status === 403) throw new SpotifyError(reason === 'PREMIUM_REQUIRED'
        ? 'Spotify Premium est requis pour cette commande.'
        : 'Spotify refuse cet accès. Vérifiez les permissions, le compte autorisé et les limites de votre application Spotify.', 403, 0, reason);
      if (response.status === 404) throw new SpotifyError('Playlist inaccessible ou aucun appareil Spotify actif. Ouvrez Spotify et lancez la lecture.', 404);
      throw new SpotifyError('Spotify est momentanément indisponible. La course peut continuer.', response.status);
    }
    return await response.json() as Json;
  }
  async profile(): Promise<SpotifyProfile> {
    const result = await this.request('/me');
    if (!result || typeof result.id !== 'string') throw new SpotifyError('Profil Spotify inaccessible.');
    return { id: result.id, name: safeText(result.display_name) ?? 'Compte Spotify', product: safeText(result.product) };
  }
  async playlists(offset = 0): Promise<{ playlists: PlaylistReference[]; nextOffset: number | null }> {
    const result = await this.request(`/me/playlists?limit=20&offset=${Math.max(0, Math.floor(offset))}`);
    const items: unknown[] = Array.isArray(result?.items) ? result.items : [];
    const playlists = items.flatMap(value => { try { return [parsePlaylist(value as Json, this.now())]; } catch { return []; } });
    let nextOffset: number | null = null;
    if (typeof result?.next === 'string') {
      const next = new URL(result.next);
      const value = Number(next.searchParams.get('offset'));
      if (next.origin === 'https://api.spotify.com' && next.pathname === '/v1/me/playlists' &&
          Number.isInteger(value) && value > offset && value <= 100000) nextOffset = value;
    }
    return { playlists, nextOffset };
  }
  async playlist(id: string) {
    if (!validPlaylistId(id)) throw new SpotifyError('Identifiant de playlist invalide.');
    const result = await this.request(`/playlists/${id}?fields=id,name,owner(display_name),images,snapshot_id,items(total)`);
    if (!result) throw new SpotifyError('Playlist inaccessible.');
    return parsePlaylist(result, this.now());
  }
  async publicPlaylist(id: string): Promise<Pick<PlaylistReference, 'name' | 'image' | 'fetchedAt'>> {
    const reference = playlistReference(id);
    if (this.now() < this.publicRetryAt) throw new SpotifyError('Lecteur temporairement limité.', 429, this.publicRetryAt);
    const response = await timedFetch(this.fetcher, `https://open.spotify.com/oembed?url=${encodeURIComponent(reference.url)}`, {
      credentials: 'omit',
    });
    if (response.status === 429) {
      const seconds = Number(response.headers.get('Retry-After'));
      this.publicRetryAt = this.now() + (seconds > 0 ? Math.min(86400, seconds) : 60) * 1000;
    }
    if (!response.ok) throw new SpotifyError('Informations publiques indisponibles.', response.status, this.publicRetryAt);
    const result = await response.json();
    const name = safeText(result?.title);
    if (!name) throw new SpotifyError('Titre de playlist indisponible.');
    return { name, image: spotifyImage(result?.thumbnail_url), fetchedAt: this.now() };
  }
  async playlistItems(id: string, offset = 0): Promise<{ tracks: PlaylistTrack[]; nextOffset: number | null; total: number | null }> {
    if (!validPlaylistId(id)) throw new SpotifyError('Identifiant de playlist invalide.');
    // 2026 endpoint. Never fall back to deprecated /tracks or scrape forbidden contents.
    const result = await this.request(`/playlists/${id}/items?limit=50&offset=${offset}&additional_types=track,episode`);
    if (!Array.isArray(result?.items)) throw new SpotifyError('Titres Spotify indisponibles.');
    const tracks = Array.isArray(result?.items) ? result.items.flatMap((row: Json, index: number) => {
      const raw = row?.item ?? row?.track;
      const item = parseTrack(raw);
      return item ? [{
        ...item, position: offset + index,
        playable: validPlaylistId(item.id) && row?.is_local !== true && raw.is_local !== true && raw.is_playable !== false,
      }] : [];
    }) : [];
    let nextOffset: number | null = null;
    if (typeof result?.next === 'string') {
      try {
        const next = new URL(result.next), value = Number(next.searchParams.get('offset'));
        if (next.origin === 'https://api.spotify.com' && next.pathname === `/v1/playlists/${id}/items` &&
            Number.isSafeInteger(value) && value > offset) nextOffset = value;
      } catch {}
    }
    if (result.next != null && nextOffset === null) throw new SpotifyError('Pagination Spotify invalide.');
    return { tracks, nextOffset, total: Number.isSafeInteger(result.total) && result.total >= 0 ? result.total : null };
  }
  async playback(): Promise<Playback | null> {
    const result = await this.request('/me/player'); if (!result) return null;
    return { track: parseTrack(result.item), playing: result.is_playing === true,
      progressMs: typeof result.progress_ms === 'number' ? Math.max(0, result.progress_ms) : null,
      shuffle: typeof result.shuffle_state === 'boolean' ? result.shuffle_state : null,
      deviceId: typeof result.device?.id === 'string' ? result.device.id : null,
      deviceName: safeText(result.device?.name), restricted: result.device?.is_restricted === true,
      advertisement: result.currently_playing_type === 'ad', disallows: result.actions?.disallows ?? {}, receivedAt: this.now(),
      contextUri: typeof result.context?.uri === 'string' ? result.context.uri : null,
      repeat: ['off', 'track', 'context'].includes(result.repeat_state) ? result.repeat_state : null };
  }
  async playPlaylist(id: string, deviceId?: string | null, trackUri?: string) {
    if (!validPlaylistId(id)) throw new SpotifyError('Playlist invalide.');
    if (trackUri !== undefined && !/^spotify:(track|episode):[A-Za-z0-9]{22}$/.test(trackUri)) {
      throw new SpotifyError('Identifiant du morceau invalide.');
    }
    await this.request(`/me/player/play${deviceId ? `?device_id=${encodeURIComponent(deviceId)}` : ''}`, 'PUT', {
      context_uri: `spotify:playlist:${id}`,
      ...(trackUri === undefined ? {} : { offset: { uri: trackUri } }),
    });
  }
  async command(command: 'play' | 'pause' | 'next' | 'previous' | 'shuffle', shuffle?: boolean, deviceId?: string | null) {
    let path = command === 'shuffle' ? `/me/player/shuffle?state=${shuffle ? 'true' : 'false'}` : `/me/player/${command}`;
    if (deviceId) path += `${path.includes('?') ? '&' : '?'}device_id=${encodeURIComponent(deviceId)}`;
    await this.request(path, command === 'next' || command === 'previous' ? 'POST' : 'PUT');
  }
  async setRepeat(mode: RepeatMode, deviceId?: string | null) {
    await this.request(`/me/player/repeat?state=${mode}${deviceId ? `&device_id=${encodeURIComponent(deviceId)}` : ''}`, 'PUT');
  }
  async seek(positionMs: number, deviceId?: string | null) { await this.request(`/me/player/seek?position_ms=${Math.max(0, Math.floor(positionMs))}${deviceId ? `&device_id=${encodeURIComponent(deviceId)}` : ''}`, 'PUT'); }
}
