export interface PlaylistReference {
  id: string; uri: string; url: string; savedAt: number;
  name: string | null; image: string | null; owner: string | null; count: number | null;
  fetchedAt: number | null; source: 'link' | 'account';
}
export interface SpotifyPreferences {
  version: 1; clientId: string; selectedId: string | null; autoPlay: boolean; playlists: PlaylistReference[];
  redirectUri?: string;
}
export const EMPTY_MUSIC: SpotifyPreferences = { version: 1, clientId: '', selectedId: null, autoPlay: true, playlists: [] };
export interface SpotifyTokens {
  clientId: string; accessToken: string; refreshToken: string; expiresAt: number; scopes: string[];
}
export interface SpotifyProfile { id: string; name: string; product: string | null }
export interface SpotifyTrack {
  id: string; title: string; artist: string; image: string | null; url: string | null;
  durationMs: number; explicit: boolean; type: 'track' | 'episode';
}
export interface Playback {
  track: SpotifyTrack | null; playing: boolean; progressMs: number | null; shuffle: boolean | null;
  deviceId: string | null; deviceName: string | null; restricted: boolean; advertisement: boolean;
  disallows: Record<string, boolean>; receivedAt: number;
  contextUri?: string | null;
}
export type PlayerCommand = 'play' | 'pause' | 'next' | 'previous' | 'shuffle' | 'seek';
export interface MusicState {
  ready: boolean; busy: boolean; playerBusy: boolean; status: 'disconnected' | 'connected' | 'expired';
  preferences: SpotifyPreferences; profile: SpotifyProfile | null;
  library: PlaylistReference[]; nextOffset: number | null; playback: Playback | null;
  stale: boolean; message: string | null; controlBlocked: boolean; retryAt: number;
  grantedScopes?: string[];
}
export interface MusicPersistence { load(): Promise<SpotifyPreferences>; save(value: SpotifyPreferences): Promise<void> }
export interface TokenVault { read(): Promise<SpotifyTokens | null>; write(value: SpotifyTokens): Promise<void>; clear(): Promise<void> }
export interface SpotifyAuthorization { code: string; verifier: string; redirectUri: string }
export interface SpotifyPlatform {
  canAuthenticate: boolean;
  redirectUri: string;
  authorize(clientId: string, scopes: string[], redirectUri?: string): Promise<SpotifyAuthorization>;
  resolveShortLink(url: string): Promise<string>;
  openSpotify(uri: string, url: string): Promise<void>;
}
