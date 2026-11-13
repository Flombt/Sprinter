import { describe, expect, it, vi } from 'vitest';
import { parsePlaylistInput, playlistFromAppLink, resolvePlaylist, spotifyContentUrl, spotifyImage } from '../src/spotify/links';

const id = 'A1b2C3d4E5f6G7h8I9j0K1';
describe('Spotify playlist link validation', () => {
  it('prefills only canonical Spotify playlists from a Sprinter app link', () => {
    expect(playlistFromAppLink(`sprinter://playlist/${id}`)).toBe(`https://open.spotify.com/playlist/${id}`);
    expect(playlistFromAppLink(`sprinter://playlist/${id}?url=https://example.org`)).toBeNull();
    expect(playlistFromAppLink('sprinter://run')).toBeNull();
  });
  it.each([`https://open.spotify.com/playlist/${id}`, `https://open.spotify.com/playlist/${id}?si=tracking`,
    `https://open.spotify.com/intl-fr/playlist/${id}`, `https://open.spotify.com/embed/playlist/${id}`,
    `spotify:playlist:${id}`, `spotify:user:user.name:playlist:${id}`])('imports and canonicalizes %s', input => {
    const result = parsePlaylistInput(input); expect(result.kind).toBe('playlist');
    if (result.kind === 'playlist') {
      expect(result.playlist.id).toBe(id); expect(result.playlist.url).toBe(`https://open.spotify.com/playlist/${id}`);
      expect(result.playlist.name).toBeNull(); expect(result.playlist.count).toBeNull();
    }
  });
  it.each(['', 'javascript:alert(1)', `http://open.spotify.com/playlist/${id}`, `https://open.spotify.com.evil.test/playlist/${id}`,
    `https://open.spotify.com@evil.test/playlist/${id}`, `https://evil.test/playlist/${id}`,
    `https://open.spotify.com/track/${id}`, `spotify:track:${id}`, `spotify:playlist:${id}/evil`,
    `https://open.spotify.com:8443/playlist/${id}`, `https://open.spotify.com/playlist/${id}/../other`,
    `https://open.spotify.com/playlist/${id}#evil`, 'spotify:playlist:short'])('rejects %s', input => {
    expect(() => parsePlaylistInput(input)).toThrow();
  });
  it('resolves official shortened links without fetching arbitrary user URLs', async () => {
    const resolve = vi.fn().mockResolvedValue(`https://open.spotify.com/playlist/${id}?si=ignored`);
    expect((await resolvePlaylist('https://spotify.link/abc123', resolve)).id).toBe(id);
    expect(resolve).toHaveBeenCalledWith('https://spotify.link/abc123');
    await expect(resolvePlaylist('https://evil.test/foo', resolve)).rejects.toThrow(); expect(resolve).toHaveBeenCalledTimes(1);
  });
  it('rejects shortened-link redirects to other hosts or another shortener', async () => {
    await expect(resolvePlaylist('https://spotify.link/abc123', async () => 'https://evil.test/')).rejects.toThrow();
    await expect(resolvePlaylist('https://spotify.link/abc123', async () => 'https://spotify.link/again')).rejects.toThrow();
  });
  it('allows only canonical attribution links and recognized artwork HTTPS hosts', () => {
    expect(spotifyContentUrl(`https://open.spotify.com/track/${id}`)).not.toBeNull();
    expect(spotifyContentUrl('https://evil.test/')).toBeNull();
    expect(spotifyImage('https://i.scdn.co/image/example')).not.toBeNull();
    expect(spotifyImage('http://i.scdn.co/image/example')).toBeNull();
    expect(spotifyImage('https://i.scdn.co.evil.test/image/example')).toBeNull();
  });
});
