import { PlaylistReference } from './types';

const ID = /^[A-Za-z0-9]{22}$/;
export const validPlaylistId = (value: unknown): value is string => typeof value === 'string' && ID.test(value);
const invalid = () => new Error('Collez un lien de playlist open.spotify.com ou une URI spotify:playlist valide.');
export function playlistReference(id: string, savedAt = Date.now()): PlaylistReference {
  if (!validPlaylistId(id)) throw invalid();
  return { id, uri: `spotify:playlist:${id}`, url: `https://open.spotify.com/playlist/${id}`, savedAt,
    name: null, image: null, owner: null, count: null, fetchedAt: null, source: 'link' };
}
export function playlistFromAppLink(url: string | null | undefined): string | null {
  const id = /^sprinter:\/\/playlist\/([A-Za-z0-9]{22})\/?$/.exec(url ?? '')?.[1];
  return id ? playlistReference(id).url : null;
}
export type ParsedPlaylist = { kind: 'playlist'; playlist: PlaylistReference } | { kind: 'short'; url: string };
export function parsePlaylistInput(input: string): ParsedPlaylist {
  const value = input.trim();
  if (!value || value.length > 2048 || /[\s\u0000-\u001f]/.test(value)) throw invalid();
  const uri = /^spotify:playlist:([A-Za-z0-9]{22})$/.exec(value)
    ?? /^spotify:user:[A-Za-z0-9_.%-]+:playlist:([A-Za-z0-9]{22})$/.exec(value);
  if (uri?.[1]) return { kind: 'playlist', playlist: playlistReference(uri[1]) };
  let url: URL;
  try { url = new URL(value); } catch { throw invalid(); }
  if (url.protocol !== 'https:' || url.username || url.password || url.port || url.hash) throw invalid();
  if (url.hostname === 'spotify.link' || url.hostname === 'spotify.app.link') {
    if (!/^\/[A-Za-z0-9_-]{3,200}\/?$/.test(url.pathname)) throw invalid();
    return { kind: 'short', url: url.toString() };
  }
  if (url.hostname !== 'open.spotify.com') throw invalid();
  const match = /^\/(?:(?:intl-[a-z]{2}(?:-[a-z]{2})?|embed)\/)?playlist\/([A-Za-z0-9]{22})\/?$/.exec(url.pathname);
  if (!match?.[1]) throw invalid();
  return { kind: 'playlist', playlist: playlistReference(match[1]) };
}
export async function resolvePlaylist(input: string, resolve: (url: string) => Promise<string>): Promise<PlaylistReference> {
  const parsed = parsePlaylistInput(input);
  if (parsed.kind === 'playlist') return parsed.playlist;
  const result = parsePlaylistInput(await resolve(parsed.url));
  if (result.kind !== 'playlist') throw new Error('Lien abrégé non résolu. Copiez le lien complet depuis Spotify.');
  return result.playlist;
}

/** External metadata links are never allowed to substitute an arbitrary URL. */
export function spotifyContentUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    return url.origin === 'https://open.spotify.com' && !url.username && !url.password &&
      /^\/(?:track|episode|album|artist|playlist)\/[A-Za-z0-9]{22}$/.test(url.pathname) ? url.toString() : null;
  } catch { return null; }
}
export function spotifyImage(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !url.port &&
      ['i.scdn.co', 'mosaic.scdn.co', 'image-cdn-ak.spotifycdn.com', 'image-cdn-fa.spotifycdn.com'].includes(url.hostname) ? value : null;
  } catch { return null; }
}
