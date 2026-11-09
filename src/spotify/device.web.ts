import { EMPTY_MUSIC, MusicPersistence, SpotifyPlatform, TokenVault } from './types';
import { SpotifyAuth, SpotifyError, timedFetch } from './auth';
import { SpotifyApi } from './api';
import { SpotifyStore } from './store';

export const SPOTIFY_REDIRECT = 'app.sprinter.running://spotify-callback';
const persistence: MusicPersistence = {
  async load() { const raw = localStorage.getItem('sprinter.music.v1'); return raw ? JSON.parse(raw) : { ...EMPTY_MUSIC, playlists: [] }; },
  async save(value) { localStorage.setItem('sprinter.music.v1', JSON.stringify(value)); },
};
// No browser localStorage/sessionStorage token persistence. Native account connection uses Keychain.
const vault: TokenVault = { async read() { return null; }, async write() { throw new SpotifyError('Connexion disponible dans la version iPhone installée.'); }, async clear() {} };
const platform: SpotifyPlatform = {
  canAuthenticate: false, redirectUri: SPOTIFY_REDIRECT,
  async authorize() { throw new SpotifyError('Utilisez la version iPhone installée pour connecter Spotify.'); },
  async resolveShortLink(url) {
    try { const response = await timedFetch(fetch, url, { method: 'HEAD', redirect: 'follow', credentials: 'omit' }); return response.url; }
    catch { throw new SpotifyError('Le navigateur ne peut pas résoudre ce lien abrégé. Copiez le lien open.spotify.com complet.'); }
  },
  async openSpotify(_uri, url) { window.open(url, '_blank', 'noopener,noreferrer'); },
};
const auth = new SpotifyAuth(vault);
export const music = new SpotifyStore(auth, new SpotifyApi(auth), persistence, platform);
document.addEventListener('visibilitychange', () => music.setForeground(!document.hidden));
