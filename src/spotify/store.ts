import { SpotifyApi } from './api';
import { SpotifyAuth, SpotifyError, SPOTIFY_SCOPES, validClientId, validSpotifyRedirect } from './auth';
import { playlistReference, resolvePlaylist, spotifyImage, validPlaylistId } from './links';
import { EMPTY_MUSIC, MusicPersistence, MusicState, PlayerCommand, PlaylistReference, SpotifyPlatform, SpotifyPreferences } from './types';

export const selectedPlaylist = (state: MusicState) => state.preferences.playlists.find(p => p.id === state.preferences.selectedId) ?? null;
export function controlReason(state: MusicState, command: PlayerCommand, now = Date.now()): string | null {
  if (state.status !== 'connected') return 'Connectez Spotify pour contrôler la lecture.';
  if (state.busy) return 'Connexion ou configuration Spotify en cours.';
  if (state.grantedScopes && (!state.grantedScopes.includes('user-modify-playback-state') || !state.grantedScopes.includes('user-read-playback-state'))) return 'Réautorisez Spotify pour accorder les commandes et la lecture de l’état du lecteur.';
  if (state.profile?.product === 'free' || state.profile?.product === 'open') return 'Ces commandes nécessitent Spotify Premium.';
  if (now < state.retryAt) return 'Spotify limite temporairement les requêtes.';
  if (state.controlBlocked) return 'Spotify a refusé les commandes. Vérifiez vos droits puis actualisez ou reconnectez-vous.';
  if (state.playerBusy) return 'Commande en cours…';
  if (state.stale || !state.playback || now - state.playback.receivedAt > 15000) return 'Actualisez le lecteur ou lancez une lecture dans Spotify.';
  if (!state.playback.deviceId || state.playback.restricted) return 'Ouvrez Spotify sur un appareil permettant le contrôle.';
  const disallow: Record<PlayerCommand, string> = { play: 'resuming', pause: 'pausing', next: 'skipping_next', previous: 'skipping_prev', shuffle: 'toggling_shuffle', seek: 'seeking' };
  if (state.playback.disallows[disallow[command]] || (state.playback.advertisement && ['next', 'previous', 'seek', 'shuffle'].includes(command))) {
    return 'Cette commande est indisponible pour la lecture en cours.';
  }
  if (command === 'shuffle' && state.playback.shuffle === null) return 'Le mode aléatoire n’est pas disponible.';
  return null;
}
export function cleanPreferences(value: SpotifyPreferences, now = Date.now()): SpotifyPreferences {
  const playlists = Array.isArray(value?.playlists) ? value.playlists.flatMap(p => {
    if (!validPlaylistId(p?.id)) return [];
    const base = playlistReference(p.id, Number.isFinite(p.savedAt) ? p.savedAt : now);
    // Artwork URLs expire. Do not pretend old cached metadata is current indefinitely.
    const fresh = Number.isFinite(p.fetchedAt) && p.fetchedAt !== null && now - p.fetchedAt < 86400000 && now >= p.fetchedAt;
    return [{ ...base, ...(fresh ? { name: typeof p.name === 'string' ? p.name.slice(0, 1000) : null,
      image: spotifyImage(p.image), owner: typeof p.owner === 'string' ? p.owner.slice(0, 1000) : null,
      count: Number.isInteger(p.count) && p.count !== null && p.count >= 0 ? p.count : null, fetchedAt: p.fetchedAt } : {}), source: p.source === 'account' ? 'account' as const : 'link' as const }];
  }) : [];
  const unique = [...new Map(playlists.map(p => [p.id, p])).values()];
  return { version: 1, clientId: typeof value?.clientId === 'string' && validClientId(value.clientId) ? value.clientId : '',
    redirectUri: validSpotifyRedirect(value?.redirectUri) ? value.redirectUri : '',
    autoPlay: value?.autoPlay !== false, selectedId: unique.some(p => p.id === value?.selectedId) ? value.selectedId : null, playlists: unique };
}
export class SpotifyStore {
  private value: MusicState = { ready: false, busy: false, playerBusy: false, status: 'disconnected',
    preferences: { ...EMPTY_MUSIC, playlists: [] }, profile: null, library: [], nextOffset: null, playback: null,
    stale: true, message: null, controlBlocked: false, retryAt: 0, grantedScopes: [] };
  private listeners = new Set<() => void>();
  private generation = 0;
  private initialized: Promise<void> | null = null;
  private viewers = 0;
  private foreground = true;
  private poll: ReturnType<typeof setInterval> | null = null;
  private refreshing: Promise<void> | null = null;
  private preferenceWrites: Promise<void> = Promise.resolve();
  private playbackRevision = 0;
  private networkFailures = 0;
  constructor(readonly auth: SpotifyAuth, readonly api: SpotifyApi, private persistence: MusicPersistence,
              readonly platform: SpotifyPlatform, private now = Date.now) {}
  getSnapshot = () => this.value;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private emit(patch: Partial<MusicState>) { this.value = { ...this.value, ...patch }; this.listeners.forEach(l => l()); }
  clearMessage = () => this.emit({ message: null });
  private failure(error: unknown, controls = false) {
    if (error instanceof SpotifyError) {
      if (error.status === 401) { this.stopPoll(); this.emit({ status: 'expired', playback: null, stale: true }); }
      this.emit({ retryAt: error.retryAt || this.api.retryAt, ...(controls && error.status === 403 ? { controlBlocked: true } : {}) });
    }
    this.emit({ message: error instanceof SpotifyError ? error.message : 'Connexion à Spotify indisponible. Votre course peut continuer.' });
  }
  initialize = (): Promise<void> => {
    if (this.value.ready) return Promise.resolve();
    return this.initialized ??= this.initializeInternal().finally(() => { this.initialized = null; });
  };
  private async initializeInternal() {
    const generation = this.generation;
    try {
      const preferences = cleanPreferences(await this.persistence.load(), this.now());
      if (generation !== this.generation) { this.emit({ ready: true }); return; }
      this.emit({ preferences });
      const connected = preferences.clientId && this.platform.canAuthenticate ? await this.auth.restore(preferences.clientId) : false;
      if (generation !== this.generation) { this.emit({ ready: true }); return; }
      this.emit({ ready: true, preferences, status: connected ? 'connected' : 'disconnected', grantedScopes: connected ? [...this.auth.scopes] : [] });
      if (connected) { void this.loadProfile(); this.startPoll(); }
    } catch { this.emit({ ready: true, message: 'La configuration musicale n’a pas pu être chargée. Les courses restent disponibles.' }); }
  }
  private async save(preferences: SpotifyPreferences) {
    // Reflect the latest selection immediately and serialize disk writes in intent order.
    this.emit({ preferences });
    const task = this.preferenceWrites.then(() => this.persistence.save(preferences));
    this.preferenceWrites = task.catch(() => undefined); await task;
  }
  async configure(clientId: string, redirectUri = this.value.preferences.redirectUri ?? '') {
    await this.initialize();
    const value = clientId.trim();
    const callback = redirectUri.trim();
    if (callback && !validSpotifyRedirect(callback)) { this.emit({ message: 'Indiquez une adresse HTTPS de retour, sans paramètres, fragment ni identifiants.' }); return false; }
    if (value && !validClientId(value)) { this.emit({ message: 'Le Client ID public Spotify contient 32 caractères hexadécimaux.' }); return false; }
    if (this.value.busy) return false;
    this.emit({ busy: true });
    try {
      if (value !== this.value.preferences.clientId || callback !== (this.value.preferences.redirectUri ?? '')) await this.disconnect();
      await this.save({ ...this.value.preferences, clientId: value, redirectUri: callback });
      this.emit({ message: value ? callback ? 'Configuration enregistrée. Déclarez exactement cette adresse HTTPS dans Spotify Developer et hébergez la page de retour.' : 'Client ID enregistré. Renseignez aussi votre page de retour HTTPS.' : 'Configuration Spotify retirée.' });
      return true;
    } catch (error) { this.failure(error); return false; }
    finally { this.emit({ busy: false }); }
  }
  async connect() {
    if (this.value.busy) return;
    if (!this.platform.canAuthenticate) { this.emit({ message: 'La connexion Spotify nécessite une version de développement installée, avec son URI de retour. L’importation de liens reste disponible.' }); return; }
    const { clientId } = this.value.preferences;
    if (!validClientId(clientId)) { this.emit({ message: 'Renseignez d’abord le Client ID public de votre application Spotify.' }); return; }
    const redirectUri = this.value.preferences.redirectUri;
    if (!validSpotifyRedirect(redirectUri)) { this.emit({ message: 'Configurez une page de retour HTTPS déclarée dans Spotify Developer avant la connexion.' }); return; }
    const generation = ++this.generation;
    this.stopPoll(); this.playbackRevision++;
    this.emit({ busy: true, message: null, stale: true });
    try {
      const authorization = await this.platform.authorize(clientId, SPOTIFY_SCOPES, redirectUri);
      if (generation !== this.generation) return;
      await this.auth.exchange(clientId, authorization);
      if (generation !== this.generation) return;
      this.networkFailures = 0;
      this.emit({ status: 'connected', controlBlocked: false, retryAt: 0, grantedScopes: [...this.auth.scopes] });
      await this.loadProfile(); await this.loadLibrary(); this.startPoll();
    } catch (error) { if (generation === this.generation) this.failure(error); }
    finally { this.emit({ busy: false }); this.startPoll(); }
  }
  private async loadProfile() {
    const generation = this.generation;
    try { const profile = await this.api.profile(); if (generation === this.generation) this.emit({ profile }); }
    catch (error) { if (generation === this.generation) this.failure(error); }
  }
  async disconnect() {
    this.generation++; this.playbackRevision++; this.networkFailures = 0; this.stopPoll();
    this.emit({ status: 'disconnected', profile: null, library: [], nextOffset: null, playback: null, stale: true, controlBlocked: false, retryAt: 0, grantedScopes: [] });
    await this.auth.disconnect();
    // Preserve explicit references, but remove account metadata on disconnect.
    await this.save({ ...this.value.preferences, playlists: this.value.preferences.playlists.map(p => playlistReference(p.id, p.savedAt)) });
  }
  disconnectSafely = async () => {
    if (this.value.busy) return;
    this.emit({ busy: true });
    try { await this.disconnect(); this.emit({ message: 'Compte déconnecté sur cet appareil. Spotify peut continuer à jouer ; votre course continue.' }); }
    catch { this.emit({ message: 'Le stockage sécurisé n’a pas pu être nettoyé. Réessayez la déconnexion.' }); }
    finally { this.emit({ busy: false }); }
  };
  async importPlaylist(input: string): Promise<boolean> {
    await this.initialize();
    if (this.value.busy) return false;
    this.emit({ busy: true, message: null });
    const generation = this.generation;
    try {
      let playlist = await resolvePlaylist(input, url => this.platform.resolveShortLink(url));
      if (generation !== this.generation) return false;
      const existing = this.value.preferences.playlists.find(p => p.id === playlist.id);
      playlist = existing ?? playlist;
      await this.save({ ...this.value.preferences, selectedId: playlist.id,
        playlists: [...this.value.preferences.playlists.filter(p => p.id !== playlist.id), playlist] });
      if (this.auth.connected) {
        try {
          const metadata = await this.api.playlist(playlist.id);
          if (generation === this.generation) await this.save({ ...this.value.preferences,
            playlists: this.value.preferences.playlists.map(p => p.id === metadata.id ? { ...metadata, savedAt: p.savedAt, source: p.source } : p) });
        } catch (error) { if (generation === this.generation) this.failure(error); }
      } else this.emit({ message: 'Référence enregistrée et sélectionnée. Ouvrez-la dans Spotify pour écouter ; les détails nécessitent une connexion autorisée.' });
      return true;
    } catch (error) { this.emit({ message: error instanceof Error ? error.message : 'Lien Spotify invalide.' }); return false; }
    finally { this.emit({ busy: false }); }
  }
  async select(playlist: PlaylistReference | null) {
    await this.initialize();
    try {
      const playlists = playlist && !this.value.preferences.playlists.some(p => p.id === playlist.id)
        ? [...this.value.preferences.playlists, playlist] : this.value.preferences.playlists;
      await this.save({ ...this.value.preferences, playlists, selectedId: playlist?.id ?? null });
    } catch (error) { this.failure(error); }
  }
  async remove(id: string) {
    try { await this.save({ ...this.value.preferences, selectedId: this.value.preferences.selectedId === id ? null : this.value.preferences.selectedId,
      playlists: this.value.preferences.playlists.filter(p => p.id !== id) }); } catch (error) { this.failure(error); }
  }
  async setAutoPlay(autoPlay: boolean) { try { await this.save({ ...this.value.preferences, autoPlay }); } catch (error) { this.failure(error); } }
  async loadLibrary(more = false) {
    if (!this.auth.connected) { this.emit({ message: 'Connectez Spotify pour consulter vos playlists.' }); return; }
    const generation = this.generation;
    try {
      const result = await this.api.playlists(more ? this.value.nextOffset ?? 0 : 0);
      if (generation !== this.generation) return;
      const library = [...new Map([...(more ? this.value.library : []), ...result.playlists].map(p => [p.id, p])).values()];
      this.emit({ library, nextOffset: result.nextOffset });
    } catch (error) { if (generation === this.generation) this.failure(error); }
  }
  async tracks(id: string, offset = 0) {
    const generation = this.generation;
    const result = await this.api.playlistItems(id, offset);
    if (generation !== this.generation || !this.auth.connected) throw new SpotifyError('Compte Spotify déconnecté.', 401);
    return result;
  }
  refreshPlayback = async (force = false): Promise<void> => {
    if (this.refreshing) { await this.refreshing; if (force) await this.refreshPlayback(); return; }
    if (!this.auth.connected || !this.foreground) return;
    if (!this.auth.scopes.includes('user-read-playback-state')) { this.stopPoll(); this.emit({ stale: true, message: 'L’autorisation de lire le lecteur manque. Réautorisez votre compte Spotify.' }); return; }
    if (!force && this.now() < this.value.retryAt) return;
    const generation = this.generation, revision = this.playbackRevision;
    const task = (async () => {
      try {
        const playback = await this.api.playback();
        if (generation === this.generation && revision === this.playbackRevision && this.foreground) {
          this.networkFailures = 0; this.emit({ playback, stale: false, retryAt: this.api.retryAt, grantedScopes: [...this.auth.scopes] });
        }
      } catch (error) { if (generation === this.generation && revision === this.playbackRevision) {
        this.emit({ stale: true, grantedScopes: [...this.auth.scopes] }); this.failure(error, true);
        if (error instanceof SpotifyError && [401, 403].includes(error.status)) this.stopPoll();
        else { this.networkFailures = Math.min(5, this.networkFailures + 1);
          this.emit({ retryAt: Math.max(this.api.retryAt, this.value.retryAt, this.now() + Math.min(60000, 5000 * 2 ** this.networkFailures)) }); }
      } }
    })();
    this.refreshing = task;
    try { await task; } finally { if (this.refreshing === task) this.refreshing = null; }
  };
  retryPlayback = async () => { this.emit({ controlBlocked: false, message: null }); await this.refreshPlayback(true); this.startPoll(); };
  async command(command: Exclude<PlayerCommand, 'seek'>) {
    const reason = controlReason(this.value, command, this.now());
    if (reason) { this.emit({ message: reason }); return; }
    const generation = this.generation;
    const playback = this.value.playback;
    this.playbackRevision++; this.emit({ playerBusy: true, message: null, stale: true });
    try {
      await this.api.command(command, !playback?.shuffle, playback?.deviceId);
      if (generation === this.generation) await this.refreshPlayback(true);
    } catch (error) { if (generation === this.generation) this.failure(error, true); }
    finally { this.emit({ playerBusy: false }); }
  }
  async seek(positionMs: number) {
    const reason = controlReason(this.value, 'seek', this.now()); if (reason) { this.emit({ message: reason }); return; }
    if (!Number.isFinite(positionMs)) return;
    const generation = this.generation, deviceId = this.value.playback?.deviceId; this.playbackRevision++; this.emit({ playerBusy: true, stale: true });
    try { await this.api.seek(positionMs, deviceId); if (generation === this.generation) await this.refreshPlayback(true); }
    catch (error) { if (generation === this.generation) this.failure(error, true); }
    finally { this.emit({ playerBusy: false }); }
  }
  async playSelected() {
    const playlist = selectedPlaylist(this.value); if (!playlist) return;
    const reason = controlReason(this.value, 'play', this.now());
    if (reason) { this.emit({ message: reason }); return; }
    const generation = this.generation, deviceId = this.value.playback?.deviceId; this.playbackRevision++; this.emit({ playerBusy: true, message: null, stale: true });
    try { await this.api.playPlaylist(playlist.id, deviceId); if (generation === this.generation) await this.refreshPlayback(true); }
    catch (error) { if (generation === this.generation) this.failure(error, true); }
    finally { this.emit({ playerBusy: false }); }
  }
  async onRunStarted() {
    // No app switch, no await by the running engine, and no dependency on a successful music command.
    if (this.value.preferences.autoPlay && selectedPlaylist(this.value) && this.auth.connected) {
      try {
        await this.refreshPlayback(true);
        const playback = this.value.playback, selected = selectedPlaylist(this.value);
        if (!this.value.stale && playback?.playing && playback.contextUri === selected?.uri) return;
        await this.playSelected();
      } catch (error) { this.failure(error, true); }
    }
  }
  async openPlaylist(playlist?: PlaylistReference | null) {
    const chosen = playlist ?? selectedPlaylist(this.value);
    try { await this.platform.openSpotify(chosen?.uri ?? 'spotify:', chosen?.url ?? 'https://open.spotify.com/'); }
    catch { this.emit({ message: 'Spotify n’a pas pu être ouvert. Installez Spotify ou ouvrez le lien dans votre navigateur.' }); }
  }
  watchPlayback = () => {
    this.viewers++; this.startPoll();
    return () => { this.viewers = Math.max(0, this.viewers - 1); if (!this.viewers) this.stopPoll(); };
  };
  setForeground(active: boolean) {
    if (this.foreground !== active) this.playbackRevision++;
    this.foreground = active;
    if (active) this.startPoll(); else { this.stopPoll(); this.emit({ stale: true }); }
  }
  private startPoll() {
    if (this.poll || !this.foreground || !this.viewers || !this.auth.connected || !this.auth.scopes.includes('user-read-playback-state')) return;
    void this.refreshPlayback();
    this.poll = setInterval(() => { if (this.now() >= Math.max(this.api.retryAt, this.value.retryAt)) void this.refreshPlayback(); }, 5000);
  }
  private stopPoll() { if (this.poll) clearInterval(this.poll); this.poll = null; }
}
