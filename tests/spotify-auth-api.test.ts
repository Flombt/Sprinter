import { describe, expect, it, vi } from 'vitest';
import { SpotifyAuth, SPOTIFY_SCOPES, TOKEN_ENDPOINT, SpotifyError } from '../src/spotify/auth';
import { SpotifyApi, parsePlaylist } from '../src/spotify/api';
import { SpotifyTokens, TokenVault } from '../src/spotify/types';

const clientId = 'a'.repeat(32), id = 'A'.repeat(22);
const tokens = (expiry = 3600000): SpotifyTokens => ({ clientId, accessToken: 'old-access', refreshToken: 'refresh', expiresAt: expiry, scopes: SPOTIFY_SCOPES });
function vault(initial: SpotifyTokens | null = tokens()) {
  let value = initial;
  const store: TokenVault = { async read() { return value; }, async write(next) { value = next; }, async clear() { value = null; } };
  return { store, value: () => value };
}
const json = (value: unknown, status = 200, headers?: Record<string, string>) => new Response(JSON.stringify(value), { status, headers });
describe('Spotify PKCE token lifecycle', () => {
  it('exchanges an authorization code with its PKCE verifier, without any client secret', async () => {
    const memory = vault(null), fetcher = vi.fn().mockResolvedValue(json({ access_token: 'access', refresh_token: 'refresh', expires_in: 3600, scope: SPOTIFY_SCOPES.join(' ') }));
    const auth = new SpotifyAuth(memory.store, fetcher, () => 1000);
    await auth.exchange(clientId, { code: 'test-code', verifier: 'test-verifier', redirectUri: 'app.sprinter.running://spotify-callback' });
    const body = new URLSearchParams(fetcher.mock.calls[0]![1].body);
    expect(fetcher.mock.calls[0]![0]).toBe(TOKEN_ENDPOINT); expect(body.get('code_verifier')).toBe('test-verifier');
    expect(body.get('grant_type')).toBe('authorization_code'); expect(body.has('client_secret')).toBe(false);
    expect(memory.value()?.expiresAt).toBe(3601000);
  });
  it('restores only the matching client and uses a still-valid access token', async () => {
    const memory = vault(), fetcher = vi.fn(), auth = new SpotifyAuth(memory.store, fetcher, () => 0);
    expect(await auth.restore('b'.repeat(32))).toBe(false); expect(await auth.restore(clientId)).toBe(true);
    expect(await auth.accessToken()).toBe('old-access'); expect(fetcher).not.toHaveBeenCalled();
  });
  it('refreshes concurrent expired requests once and retains an unrotated refresh token', async () => {
    const memory = vault(tokens(1));
    const fetcher = vi.fn().mockResolvedValue(json({ access_token: 'new-access', expires_in: 3600 }));
    const auth = new SpotifyAuth(memory.store, fetcher, () => 100000); await auth.restore(clientId);
    expect(await Promise.all([auth.accessToken(), auth.accessToken(), auth.accessToken()])).toEqual(['new-access', 'new-access', 'new-access']);
    expect(fetcher).toHaveBeenCalledOnce(); expect(memory.value()?.refreshToken).toBe('refresh');
  });
  it('clears invalid authorization and asks for reconnection', async () => {
    const memory = vault(tokens(1)), auth = new SpotifyAuth(memory.store, async () => json({ error: 'invalid_grant' }, 400), () => 100000);
    await auth.restore(clientId); await expect(auth.accessToken()).rejects.toMatchObject({ status: 401 });
    expect(memory.value()).toBeNull(); expect(auth.connected).toBe(false);
  });
  it('does not resurrect credentials if disconnected during refresh', async () => {
    const memory = vault(tokens(1)); let release!: (value: Response) => void;
    const response = new Promise<Response>(resolve => { release = resolve; });
    const auth = new SpotifyAuth(memory.store, async () => response, () => 100000); await auth.restore(clientId);
    const pending = auth.accessToken(); const caught = expect(pending).rejects.toBeInstanceOf(SpotifyError);
    await auth.disconnect(); release(json({ access_token: 'late', expires_in: 3600 })); await caught;
    expect(auth.connected).toBe(false); expect(memory.value()).toBeNull();
  });
  it('respects a token endpoint rate limit without exposing token payloads', async () => {
    const memory = vault(tokens(1)), auth = new SpotifyAuth(memory.store, async () => json({ error: 'too_many_requests' }, 429, { 'Retry-After': '20' }), () => 1000);
    await auth.restore(clientId); await expect(auth.accessToken()).rejects.toMatchObject({ status: 429, retryAt: 21000 });
  });
});
describe('Spotify official Web API', () => {
  it('refreshes once on 401 then retries with the new bearer token', async () => {
    const memory = vault(), calls: { url: string; authorization?: string }[] = [];
    const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
      const authorization = (init?.headers as Record<string, string> | undefined)?.Authorization;
      calls.push({ url, authorization });
      if (url === TOKEN_ENDPOINT) return json({ access_token: 'new-access', expires_in: 3600 });
      return authorization === 'Bearer old-access' ? json({}, 401) : json({ id: 'user', display_name: 'Runner' });
    });
    const auth = new SpotifyAuth(memory.store, fetcher, () => 0); await auth.restore(clientId);
    const api = new SpotifyApi(auth, fetcher, () => 0);
    expect((await api.profile()).name).toBe('Runner'); expect(calls.filter(c => c.url === TOKEN_ENDPOINT)).toHaveLength(1);
    expect(calls.at(-1)?.authorization).toBe('Bearer new-access');
  });
  it('does not invent Premium when the 2026 profile has no product field', async () => {
    const memory = vault(), auth = new SpotifyAuth(memory.store, fetch, () => 0); await auth.restore(clientId);
    const api = new SpotifyApi(auth, async () => json({ id: 'user', display_name: 'Runner' }), () => 0);
    expect((await api.profile()).product).toBeNull();
  });
  it('backs off globally after 429, including requests for a different endpoint', async () => {
    let time = 1000; const memory = vault(), auth = new SpotifyAuth(memory.store, fetch, () => time); await auth.restore(clientId);
    const fetcher = vi.fn().mockResolvedValueOnce(json({ error: { reason: 'QUOTA_EXCEEDED' } }, 429, { 'Retry-After': '30' })).mockResolvedValue(new Response(null, { status: 204 }));
    const api = new SpotifyApi(auth, fetcher, () => time);
    await expect(api.playback()).rejects.toMatchObject({ status: 429, retryAt: 31000 });
    await expect(api.playlists()).rejects.toMatchObject({ status: 429 }); expect(fetcher).toHaveBeenCalledOnce();
    time = 32000; expect(await api.playback()).toBeNull(); expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it('uses /items in 2026 and never falls back to scraping or deprecated /tracks after 403', async () => {
    const memory = vault(), auth = new SpotifyAuth(memory.store, fetch, () => 0); await auth.restore(clientId);
    const fetcher = vi.fn().mockResolvedValue(json({}, 403)), api = new SpotifyApi(auth, fetcher, () => 0);
    await expect(api.playlistItems(id)).rejects.toMatchObject({ status: 403 });
    expect(fetcher).toHaveBeenCalledOnce(); expect(fetcher.mock.calls[0]![0]).toContain(`/playlists/${id}/items?`);
  });
  it('returns no fabricated track or device for 204', async () => {
    const memory = vault(), auth = new SpotifyAuth(memory.store, fetch, () => 0); await auth.restore(clientId);
    const api = new SpotifyApi(auth, async () => new Response(null, { status: 204 }), () => 0);
    expect(await api.playback()).toBeNull();
  });
  it('accepts metadata without counts and both old/new total fields', () => {
    expect(parsePlaylist({ id, name: 'Playlist' }).count).toBeNull();
    expect(parsePlaylist({ id, items: { total: 12 } }).count).toBe(12);
    expect(parsePlaylist({ id, tracks: { total: 8 } }).count).toBe(8);
  });
  it('never sends bearer credentials to a pagination URL from another host', async () => {
    const memory = vault(), auth = new SpotifyAuth(memory.store, fetch, () => 0); await auth.restore(clientId);
    const fetcher = vi.fn().mockResolvedValue(json({ items: [{ id }], next: 'https://evil.test/v1/me/playlists?offset=20' }));
    const api = new SpotifyApi(auth, fetcher, () => 0); const page = await api.playlists();
    expect(page.nextOffset).toBeNull(); expect(page.playlists).toHaveLength(1); expect(fetcher).toHaveBeenCalledOnce();
    await expect(api.request('//evil.test/')).rejects.toThrow();
  });
  it('sends actual playback commands and a playlist context, without audio files', async () => {
    const memory = vault(), auth = new SpotifyAuth(memory.store, fetch, () => 0); await auth.restore(clientId);
    const fetcher = vi.fn().mockImplementation(async () => new Response(null, { status: 204 })); const api = new SpotifyApi(auth, fetcher, () => 0);
    await api.playPlaylist(id); await api.command('pause'); await api.command('next'); await api.command('previous'); await api.command('shuffle', true);
    expect(JSON.parse(fetcher.mock.calls[0]![1].body)).toEqual({ context_uri: `spotify:playlist:${id}` });
    expect(fetcher.mock.calls[1]![1].method).toBe('PUT'); expect(fetcher.mock.calls[2]![1].method).toBe('POST');
    expect(fetcher.mock.calls[3]![0]).toContain('/previous'); expect(fetcher.mock.calls[4]![0]).toContain('shuffle?state=true');
  });
});
