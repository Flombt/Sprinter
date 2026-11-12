import { afterEach, describe, expect, it, vi } from 'vitest';
import { SpotifyStore, cleanPreferences, controlReason, selectedPlaylist } from '../src/spotify/store';
import { SpotifyAuth, SPOTIFY_SCOPES } from '../src/spotify/auth';
import { SpotifyApi } from '../src/spotify/api';
import { EMPTY_MUSIC, MusicPersistence, SpotifyPlatform, SpotifyPreferences, SpotifyTokens, TokenVault } from '../src/spotify/types';
import { playlistReference } from '../src/spotify/links';
import { RunEngine } from '../src/core/engine';
import { DEFAULT_TARGET } from '../src/core/types';

const id = 'A'.repeat(22), other = 'B'.repeat(22), clientId = 'a'.repeat(32);
const redirectUri = 'https://sprinter.example/spotify-callback/';
const stores: SpotifyStore[] = [];
function setup({ connected = false, canAuthenticate = true, prefs = {} as Partial<SpotifyPreferences> } = {}) {
  let saved: SpotifyPreferences = { ...EMPTY_MUSIC, clientId: connected ? clientId : '', redirectUri, playlists: [], ...prefs };
  let token: SpotifyTokens | null = connected ? { clientId, accessToken: 'access', refreshToken: 'refresh', expiresAt: Date.now() + 3600000, scopes: SPOTIFY_SCOPES } : null;
  const persistence: MusicPersistence = { async load() { return structuredClone(saved); }, save: vi.fn(async value => { saved = structuredClone(value); }) };
  const vault: TokenVault = { async read() { return token; }, async write(value) { token = value; }, clear: vi.fn(async () => { token = null; }) };
  const platform: SpotifyPlatform = { canAuthenticate, redirectUri: 'app.sprinter.running://spotify-callback',
    authorize: vi.fn().mockResolvedValue({ code: 'code', verifier: 'verifier', redirectUri }),
    resolveShortLink: vi.fn(), openSpotify: vi.fn().mockResolvedValue(undefined) };
  let disallows: Record<string, boolean> = {};
  const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
    if (url.includes('/api/token')) return new Response(JSON.stringify({ access_token: 'access', refresh_token: 'refresh', expires_in: 3600, scope: SPOTIFY_SCOPES.join(' ') }));
    if (url.endsWith('/me')) return new Response(JSON.stringify({ id: 'runner', display_name: 'Runner' }));
    if (url.includes('/me/playlists')) return new Response(JSON.stringify({ items: [{ id, name: 'Owned playlist', items: { total: 2 } }], next: null }));
    if (url.includes(`/playlists/${id}`)) return new Response(JSON.stringify({ id, name: 'Accessible playlist', items: { total: 2 } }));
    if (url.endsWith('/me/player') && (!init?.method || init.method === 'GET')) return new Response(JSON.stringify({ is_playing: true, progress_ms: 1000, shuffle_state: false,
      device: { id: 'iphone', name: 'iPhone', is_restricted: false }, actions: { disallows }, item: { type: 'track', id: other, name: 'Test track', artists: [{ name: 'Test artist' }], duration_ms: 200000 } }));
    return new Response(null, { status: 204 });
  });
  const auth = new SpotifyAuth(vault, fetcher), api = new SpotifyApi(auth, fetcher);
  const store = new SpotifyStore(auth, api, persistence, platform); stores.push(store);
  return { store, fetcher, auth, api, persistence, platform, vault, saved: () => saved, restrict: (value: Record<string, boolean>) => { disallows = value; } };
}
afterEach(() => { stores.splice(0).forEach(store => store.setForeground(false)); vi.useRealTimers(); });
describe('Spotify module, independent of sport recording', () => {
  it('imports, deduplicates, selects and persists an offline reference without fabricating metadata', async () => {
    const { store, fetcher, saved } = setup(); await store.initialize();
    expect(await store.importPlaylist(`spotify:playlist:${id}`)).toBe(true);
    expect(await store.importPlaylist(`https://open.spotify.com/playlist/${id}?si=tracking`)).toBe(true);
    expect(saved().playlists).toHaveLength(1); expect(saved().selectedId).toBe(id);
    expect(selectedPlaylist(store.getSnapshot())?.name).toBeNull(); expect(fetcher).not.toHaveBeenCalled();
  });
  it('does not change selection after an invalid link', async () => {
    const { store, saved } = setup(); await store.initialize(); await store.importPlaylist(`spotify:playlist:${id}`);
    expect(await store.importPlaylist('https://evil.test/playlist/whatever')).toBe(false); expect(saved().selectedId).toBe(id);
  });
  it('connects through the injected authorization adapter and loads permitted playlists', async () => {
    const { store, platform } = setup({ prefs: { clientId } }); await store.initialize(); await store.connect();
    expect(platform.authorize).toHaveBeenCalledWith(clientId, SPOTIFY_SCOPES, redirectUri);
    expect(store.getSnapshot().status).toBe('connected'); expect(store.getSnapshot().library[0]?.name).toBe('Owned playlist');
  });
  it('does not pretend OAuth works inside Expo Go', async () => {
    const { store, platform } = setup({ canAuthenticate: false, prefs: { clientId } }); await store.initialize(); await store.connect();
    expect(platform.authorize).not.toHaveBeenCalled(); expect(store.getSnapshot().status).toBe('disconnected');
    expect(store.getSnapshot().message).toContain('version de développement');
  });
  it('restores the last selected reference without starting playback', async () => {
    const { store, platform } = setup({ prefs: { selectedId: id, playlists: [playlistReference(id)] } });
    await store.initialize(); expect(selectedPlaylist(store.getSnapshot())?.id).toBe(id); expect(platform.openSpotify).not.toHaveBeenCalled();
  });
  it('refreshes and sends actual control commands without inventing a player state', async () => {
    const { store, fetcher } = setup({ connected: true }); await store.initialize(); await store.refreshPlayback();
    expect(controlReason(store.getSnapshot(), 'next')).toBeNull(); await store.command('next');
    expect(fetcher.mock.calls.some(([url, init]) => new URL(url).pathname === '/v1/me/player/next' && init?.method === 'POST' && new URL(url).searchParams.get('device_id') === 'iphone')).toBe(true);
    expect(store.getSnapshot().playback?.track?.title).toBe('Test track');
  });
  it('respects per-action restrictions, Free accounts, and stale player data', async () => {
    const { store, restrict } = setup({ connected: true }); await store.initialize(); restrict({ skipping_next: true }); await store.refreshPlayback();
    expect(controlReason(store.getSnapshot(), 'next')).toContain('indisponible');
    expect(controlReason({ ...store.getSnapshot(), profile: { id: 'free', name: 'Free', product: 'free' } }, 'play')).toContain('Premium');
    expect(controlReason({ ...store.getSnapshot(), stale: true }, 'pause')).toContain('Actualisez');
  });
  it('starts the selected playlist remotely with the run and never switches applications automatically', async () => {
    const { store, fetcher, platform } = setup({ connected: true, prefs: { selectedId: id, playlists: [playlistReference(id)] } });
    await store.initialize(); await store.onRunStarted();
    const call = fetcher.mock.calls.find(([url, init]) => new URL(url).pathname === '/v1/me/player/play' && !!init?.body);
    expect(new URL(call![0]).searchParams.get('device_id')).toBe('iphone');
    expect(JSON.parse(String(call?.[1]?.body))).toEqual({ context_uri: `spotify:playlist:${id}` });
    expect(platform.openSpotify).not.toHaveBeenCalled();
  });
  it('keeps a selected reference and a running GPS engine when Spotify disconnects', async () => {
    const reference = { ...playlistReference(id), name: 'Private name', fetchedAt: Date.now() };
    const { store, vault } = setup({ connected: true, prefs: { selectedId: id, playlists: [reference] } });
    const run = new RunEngine(DEFAULT_TARGET, undefined, 0); await store.initialize(); await store.disconnectSafely(); run.tick(20, Date.now());
    expect(run.running).toBe(true); expect(run.record.activeSeconds).toBe(20);
    expect(vault.clear).toHaveBeenCalled(); expect(selectedPlaylist(store.getSnapshot())?.id).toBe(id);
    expect(selectedPlaylist(store.getSnapshot())?.name).toBeNull(); expect(store.getSnapshot().library).toEqual([]);
  });
  it('never prevents the running clock or coach because Spotify playback failed', async () => {
    const { store, fetcher } = setup({ connected: true, prefs: { selectedId: id, playlists: [playlistReference(id)] } });
    await store.initialize(); fetcher.mockRejectedValue(new Error('Network unavailable'));
    const run = new RunEngine(DEFAULT_TARGET, undefined, 0); await store.onRunStarted(); run.tick(25, Date.now());
    expect(run.running).toBe(true); expect(run.record.activeSeconds).toBe(25); expect(store.getSnapshot().message).not.toBeNull();
  });
  it('stops polling in the background and resynchronizes when foregrounded', async () => {
    vi.useFakeTimers(); const { store, fetcher } = setup({ connected: true }); await store.initialize();
    const stop = store.watchPlayback(); await vi.advanceTimersByTimeAsync(6000);
    store.setForeground(false); const count = fetcher.mock.calls.length;
    await vi.advanceTimersByTimeAsync(20000); expect(fetcher).toHaveBeenCalledTimes(count); expect(store.getSnapshot().stale).toBe(true);
    store.setForeground(true); await vi.advanceTimersByTimeAsync(1); expect(fetcher.mock.calls.length).toBeGreaterThan(count); stop();
  });
  it('saves rapid playlist choices in order, preserving the last intent', async () => {
    const { store, saved } = setup(); await store.initialize();
    await Promise.all([store.select(playlistReference(id)), store.select(playlistReference(other))]);
    expect(saved().selectedId).toBe(other); expect(store.getSnapshot().preferences.selectedId).toBe(other);
  });
  it('does not present a playlist choice as saved before the write completes', async () => {
    const { store, persistence, saved } = setup(); await store.initialize();
    let release!: () => void;
    const waiting = new Promise<void>(resolve => { release = resolve; });
    const write = vi.mocked(persistence.save).getMockImplementation()!;
    vi.mocked(persistence.save).mockImplementationOnce(async preferences => { await waiting; await write(preferences); });
    const selecting = store.select(playlistReference(id));
    await vi.waitFor(() => expect(store.getSnapshot().preferencesSaving).toBe(true));
    expect(selectedPlaylist(store.getSnapshot())).toBeNull(); expect(saved().selectedId).toBeNull();
    release(); await selecting;
    expect(selectedPlaylist(store.getSnapshot())?.id).toBe(id); expect(store.getSnapshot().preferencesSaving).toBe(false);
  });
  it('keeps the last durable selection when saving a new choice fails', async () => {
    const { store, persistence, saved } = setup(); await store.initialize(); await store.select(playlistReference(id));
    vi.mocked(persistence.save).mockRejectedValueOnce(new Error('Disk full'));
    await store.select(playlistReference(other));
    expect(store.getSnapshot().preferences.selectedId).toBe(id); expect(saved().selectedId).toBe(id);
    expect(store.getSnapshot().message).toContain('pas été enregistrées');
    expect(store.getSnapshot().preferencesSaving).toBe(false);
  });
  it('allows a newer choice to succeed after an earlier queued write fails', async () => {
    const { store, persistence, saved } = setup(); await store.initialize();
    vi.mocked(persistence.save).mockRejectedValueOnce(new Error('Temporary write failure'));
    await Promise.all([store.select(playlistReference(id)), store.select(playlistReference(other))]);
    expect(store.getSnapshot().preferences.selectedId).toBe(other); expect(saved().selectedId).toBe(other);
    expect(store.getSnapshot().message).toBeNull();
  });
  it('clears expired artwork metadata and rejects restored external image hosts', () => {
    const reference = { ...playlistReference(id), name: 'Old metadata', image: 'https://evil.test/image', fetchedAt: 1 };
    const expired = cleanPreferences({ ...EMPTY_MUSIC, playlists: [reference], selectedId: id }, 86400002);
    expect(expired.playlists[0]?.name).toBeNull(); expect(expired.playlists[0]?.image).toBeNull(); expect(expired.selectedId).toBe(id);
    const fresh = cleanPreferences({ ...EMPTY_MUSIC, playlists: [reference] }, 1000); expect(fresh.playlists[0]?.image).toBeNull();
  });
});
