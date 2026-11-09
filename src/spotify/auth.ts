import { SpotifyAuthorization, SpotifyTokens, TokenVault } from './types';

export const SPOTIFY_SCOPES = ['playlist-read-private', 'playlist-read-collaborative',
  'user-read-playback-state', 'user-modify-playback-state', 'user-read-private'];
export const TOKEN_ENDPOINT = 'https://accounts.spotify.com/api/token';
export class SpotifyError extends Error {
  constructor(message: string, readonly status = 0, readonly retryAt = 0, readonly reason = '') { super(message); this.name = 'SpotifyError'; }
}
export const validClientId = (value: string) => /^[a-fA-F0-9]{32}$/.test(value);
export function validSpotifyRedirect(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 2048 || /[\s\u0000-\u001f]/.test(value)) return false;
  try { const url = new URL(value); return url.protocol === 'https:' && !!url.hostname && url.hostname !== 'localhost' && !url.username && !url.password && !url.hash && !url.search; }
  catch { return false; }
}
export type HttpFetch = (url: string, init?: RequestInit) => Promise<Response>;
export async function timedFetch(fetcher: HttpFetch, url: string, init: RequestInit = {}): Promise<Response> {
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetcher(url, { ...init, signal: controller.signal });
    if (init.method?.toUpperCase() === 'HEAD') return response;
    // A fetch promise resolves at the headers. Keep the deadline through body consumption.
    const text = await response.text();
    const buffered = new Response([204, 205, 304].includes(response.status) ? null : text,
      { status: response.status, statusText: response.statusText, headers: response.headers });
    Object.defineProperty(buffered, 'url', { value: response.url });
    return buffered;
  }
  finally { clearTimeout(timer); }
}
export class SpotifyAuth {
  private tokens: SpotifyTokens | null = null;
  private refresh: Promise<string> | null = null;
  private generation = 0;
  private writes: Promise<unknown> = Promise.resolve();
  constructor(private vault: TokenVault, private fetcher: HttpFetch = fetch, private now = Date.now) {}
  private store(operation: () => Promise<void>) {
    const result = this.writes.then(operation); this.writes = result.catch(() => undefined); return result;
  }
  async restore(clientId: string): Promise<boolean> {
    const generation = this.generation;
    const saved = await this.vault.read();
    if (generation !== this.generation) return false;
    if (saved && saved.clientId === clientId && saved.accessToken && saved.refreshToken &&
      Number.isFinite(saved.expiresAt) && Array.isArray(saved.scopes)) { this.tokens = saved; return true; }
    return false;
  }
  get connected() { return this.tokens !== null; }
  get scopes() { return this.tokens?.scopes ?? []; }
  get sessionVersion() { return this.generation; }
  async exchange(clientId: string, authorization: SpotifyAuthorization): Promise<void> {
    if (!validClientId(clientId)) throw new SpotifyError('Le Client ID Spotify doit contenir 32 caractères hexadécimaux.');
    const generation = ++this.generation; this.refresh = null;
    const parameters = new URLSearchParams({ grant_type: 'authorization_code', client_id: clientId,
      code: authorization.code, code_verifier: authorization.verifier, redirect_uri: authorization.redirectUri });
    const next = await this.requestTokens(parameters, clientId);
    if (generation !== this.generation) throw new SpotifyError('Connexion annulée.');
    await this.store(() => this.vault.write(next));
    if (generation !== this.generation) throw new SpotifyError('Connexion annulée.');
    this.tokens = next;
  }
  async disconnect() {
    this.generation++; this.tokens = null; this.refresh = null;
    await this.store(() => this.vault.clear());
  }
  async accessToken(forceRefresh = false): Promise<string> {
    if (!this.tokens) throw new SpotifyError('Connectez votre compte Spotify.', 401);
    if (!forceRefresh && this.tokens.expiresAt - this.now() > 60000) return this.tokens.accessToken;
    if (this.refresh) return this.refresh;
    const generation = this.generation, previous = this.tokens;
    const task = (async () => {
      try {
        const next = await this.requestTokens(new URLSearchParams({ grant_type: 'refresh_token',
          client_id: previous.clientId, refresh_token: previous.refreshToken }), previous.clientId, previous);
        if (generation !== this.generation) throw new SpotifyError('Session Spotify déconnectée.', 401);
        await this.store(() => this.vault.write(next));
        if (generation !== this.generation) throw new SpotifyError('Session Spotify déconnectée.', 401);
        this.tokens = next; return next.accessToken;
      } catch (error) {
        if (error instanceof SpotifyError && error.status === 401 && generation === this.generation) await this.disconnect();
        throw error;
      }
    })();
    this.refresh = task;
    try { return await task; } finally { if (this.refresh === task) this.refresh = null; }
  }
  private async requestTokens(parameters: URLSearchParams, clientId: string, previous?: SpotifyTokens): Promise<SpotifyTokens> {
    const response = await timedFetch(this.fetcher, TOKEN_ENDPOINT, { method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: parameters.toString() });
    const body = await response.json() as Record<string, unknown>;
    if (!response.ok) {
      if (response.status === 429) {
        const delay = Number(response.headers.get('Retry-After'));
        throw new SpotifyError('Spotify limite temporairement les connexions. Patientez avant de réessayer.', 429,
          this.now() + (Number.isFinite(delay) && delay > 0 ? Math.min(86400, delay) : 60) * 1000);
      }
      // Never echo token endpoint response bodies, codes, or refresh tokens to the UI/logs.
      const expired = body.error === 'invalid_grant' || response.status === 401;
      throw new SpotifyError(expired ? 'L’autorisation Spotify a expiré. Reconnectez votre compte.'
        : 'Spotify a refusé la connexion. Vérifiez le Client ID et l’URI de redirection enregistrée.', expired ? 401 : response.status);
    }
    const refreshToken = typeof body.refresh_token === 'string' ? body.refresh_token : previous?.refreshToken;
    if (typeof body.access_token !== 'string' || !refreshToken || typeof body.expires_in !== 'number' || body.expires_in <= 0) {
      throw new SpotifyError('Réponse d’authentification Spotify incomplète.');
    }
    return { clientId, accessToken: body.access_token, refreshToken, expiresAt: this.now() + body.expires_in * 1000,
      scopes: typeof body.scope === 'string' ? body.scope.split(' ').filter(Boolean) : previous?.scopes ?? SPOTIFY_SCOPES };
  }
}
