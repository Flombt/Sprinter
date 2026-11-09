import { AppState, Linking, Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as SQLite from 'expo-sqlite';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { IS_EXPO_GO } from '../services/capabilities';
import { SpotifyAuth, SpotifyError, timedFetch, validSpotifyRedirect } from './auth';
import { SpotifyApi } from './api';
import { SpotifyStore } from './store';
import { EMPTY_MUSIC, MusicPersistence, SpotifyPlatform, SpotifyTokens, TokenVault } from './types';

WebBrowser.maybeCompleteAuthSession();
export const SPOTIFY_REDIRECT = 'app.sprinter.running://spotify-callback';
const DISCOVERY = { authorizationEndpoint: 'https://accounts.spotify.com/authorize', tokenEndpoint: 'https://accounts.spotify.com/api/token' };
const VAULT_KEY = 'sprinter.spotify.tokens.v1';
const vault: TokenVault = {
  async read() { const raw = await SecureStore.getItemAsync(VAULT_KEY); return raw ? JSON.parse(raw) as SpotifyTokens : null; },
  async write(tokens) { await SecureStore.setItemAsync(VAULT_KEY, JSON.stringify(tokens), { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY }); },
  async clear() { await SecureStore.deleteItemAsync(VAULT_KEY); },
};
let database: Promise<SQLite.SQLiteDatabase> | null = null;
async function db() {
  database ??= SQLite.openDatabaseAsync('sprinter-music-v1.db').then(async value => {
    const version = await value.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
    if ((version?.user_version ?? 0) > 1) throw new Error('Configuration musicale plus récente. Données conservées.');
    await value.execAsync('PRAGMA journal_mode = WAL; CREATE TABLE IF NOT EXISTS music (slot INTEGER PRIMARY KEY CHECK(slot=1), payload TEXT NOT NULL); PRAGMA user_version=1;'); return value;
  });
  return database;
}
const persistence: MusicPersistence = {
  async load() { const row = await (await db()).getFirstAsync<{ payload: string }>('SELECT payload FROM music WHERE slot=1'); return row ? JSON.parse(row.payload) : { ...EMPTY_MUSIC, playlists: [] }; },
  async save(value) { await (await db()).runAsync('INSERT INTO music VALUES (1, ?) ON CONFLICT(slot) DO UPDATE SET payload=excluded.payload', JSON.stringify(value)); },
};
const platform: SpotifyPlatform = {
  canAuthenticate: !IS_EXPO_GO && Platform.OS !== 'web', redirectUri: SPOTIFY_REDIRECT,
  async authorize(clientId, scopes, redirectUri) {
    if (!platform.canAuthenticate) throw new SpotifyError('Connexion Spotify indisponible dans Expo Go.');
    if (!validSpotifyRedirect(redirectUri)) throw new SpotifyError('Configurez la page de retour HTTPS de Spotify.');
    const request = new AuthSession.AuthRequest({ clientId, redirectUri,
      responseType: AuthSession.ResponseType.Code, usePKCE: true, codeChallengeMethod: AuthSession.CodeChallengeMethod.S256, scopes });
    const url = await request.makeAuthUrlAsync(DISCOVERY);
    // Spotify returns to HTTPS; our static page relays code/state to the native auth session.
    const browserResult = await WebBrowser.openAuthSessionAsync(url, SPOTIFY_REDIRECT);
    if (browserResult.type === 'cancel' || browserResult.type === 'dismiss') throw new SpotifyError('Connexion Spotify annulée.');
    if (browserResult.type !== 'success' || browserResult.url.split(/[?#]/)[0] !== SPOTIFY_REDIRECT) throw new SpotifyError('Retour de connexion Spotify invalide.');
    const result = request.parseReturnUrl(browserResult.url);
    if (result.type !== 'success' || result.params.state !== request.state || !result.params.code || !request.codeVerifier) {
      throw new SpotifyError('Autorisation Spotify refusée ou retour de connexion invalide.');
    }
    return { code: result.params.code, verifier: request.codeVerifier, redirectUri };
  },
  async resolveShortLink(url) {
    // Resolve only the official short URL supplied by links.ts. No auth headers, HTML parsing or scraping.
    const response = await timedFetch(fetch, url, { method: 'HEAD', redirect: 'follow', credentials: 'omit' });
    if (!response.url || !response.ok) throw new SpotifyError('Lien abrégé inaccessible. Copiez le lien complet open.spotify.com depuis Spotify.');
    return response.url;
  },
  async openSpotify(uri, url) {
    if (await Linking.canOpenURL(uri)) { try { await Linking.openURL(uri); return; } catch {} }
    await Linking.openURL(url);
  },
};
const auth = new SpotifyAuth(vault);
export const music = new SpotifyStore(auth, new SpotifyApi(auth), persistence, platform);
music.setForeground(AppState.currentState === 'active');
AppState.addEventListener('change', value => music.setForeground(value === 'active'));
