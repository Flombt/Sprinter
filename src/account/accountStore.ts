import type { Session, SupabaseClient, UserIdentity } from '@supabase/supabase-js';
import type { KeyValueStore } from './kvStore';
import { CHOICE_VERSION, PRIVACY_VERSION, TERMS_VERSION, type ConsentPurpose, type ConsentResult, type Consents } from './consents';
import {
  codeFailed, codeSent, EMPTY_OTP_GUARD, isLocked, normalizeEmail, remainingAttempts, secondsUntilResend, validCode, validEmail,
  type OtpGuardState,
} from './otpGuard';

/**
 * État du compte facultatif (§6). Règles : le réseau ne bloque jamais le démarrage, une
 * session expirée laisse l'app fonctionner en local, et aucune action sensible (liaison,
 * suppression) n'est possible sans authentification réelle de moins de 5 minutes.
 */
export type AccountStatus = 'unavailable' | 'loading' | 'signedOut' | 'signedIn';
export type Provider = 'apple' | 'google' | 'email';

export interface AccountSnapshot {
  status: AccountStatus;
  userId: string | null;
  email: string | null;
  providers: Provider[];
  busy: boolean;
  error: string | null;
  notice: string | null;
  /** Première connexion de ce compte : proposer « Votre profil » puis la sauvegarde. */
  firstSignIn: boolean;
  /** Nom fourni par Apple à la première autorisation, proposé sans être enregistré. */
  proposedName: string | null;
  /** Suppression validée dont le nettoyage se termine côté serveur. */
  pendingDeletion: string | null;
  otp: OtpGuardState;
}

export interface AppleCredential { identityToken: string; rawNonce: string; authorizationCode: string | null; fullName: string | null }
export interface FreshAuthentication { userId: string; accessToken: string; at: number; release(): Promise<void> }
export interface Profile { display_name: string | null; country_code: string | null; city: string | null; age_band: string | null }

export interface AccountDependencies {
  loadClient(): SupabaseClient | null;
  /** Client éphémère (session en mémoire) pour une ré-authentification qui ne touche pas la session principale. */
  createEphemeralClient(): SupabaseClient;
  clearSession(): Promise<void>;
  kv: KeyValueStore;
  apple: (() => Promise<AppleCredential>) | null;
  google: (() => Promise<string>) | null;
  device: { id(): Promise<string>; platform(): 'ios' | 'android' | null; osVersion(): string; appVersion(): string; localDay(): string };
  functionsUrl: string;
  publishableKey: string;
  download(url: string, headers: Record<string, string>, fileName: string): Promise<string>;
  uuid(): string;
  now?: () => number;
}

export const REAUTH_WINDOW_MS = 5 * 60_000;
const OTP_KEY = 'otp.guard.v1';
const DELETION_KEY = 'deletion.operation.v1';
const ACTIVITY_KEY = 'activity.last-day.v1';

const MESSAGES = {
  network: 'Connexion au service impossible. Vérifiez votre réseau puis réessayez.',
  generic: 'L’opération n’a pas abouti. Réessayez dans un instant.',
  cancelled: null,
  codeInvalid: (left: number) => `Code incorrect ou expiré. ${left > 1 ? `Il vous reste ${left} essais.` : 'Dernier essai avant une pause de 15 minutes.'}`,
  locked: 'Trop d’essais. Patientez 15 minutes avant de demander un nouveau code.',
  lastMethod: 'Gardez au moins une méthode de connexion.',
  reauth: 'Confirmez votre identité pour continuer.',
  otherAccount: 'Cette identité correspond à un autre compte. Utilisez la méthode liée à ce compte.',
} as const;

class Cancelled extends Error {}
export const cancelled = () => new Cancelled('cancelled');

function providersOf(session: Session | null): Provider[] {
  const raw = (session?.user?.app_metadata?.providers as unknown[] | undefined) ?? [];
  return raw.filter((value): value is Provider => value === 'apple' || value === 'google' || value === 'email');
}

/** Lit la session conservée sans réseau (statut affiché même hors ligne ou jeton expiré). */
export function parseStoredSession(raw: string | null): { userId: string; email: string | null; providers: Provider[] } | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as { user?: { id?: unknown; email?: unknown; app_metadata?: { providers?: unknown } } };
    const id = value.user?.id;
    if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id)) return null;
    const providers = Array.isArray(value.user?.app_metadata?.providers) ? value.user!.app_metadata!.providers as unknown[] : [];
    return {
      userId: id,
      email: typeof value.user?.email === 'string' ? value.user.email : null,
      providers: providers.filter((p): p is Provider => p === 'apple' || p === 'google' || p === 'email'),
    };
  } catch { return null; }
}

/** Date (ms) de la dernière authentification réelle, d'après la claim `amr` du jeton d'accès. */
export function lastAuthenticationAt(accessToken: string | null | undefined): number | null {
  const part = accessToken?.split('.')[1];
  if (!part) return null;
  try {
    const base64 = part.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(part.length / 4) * 4, '=');
    const json = decodeURIComponent(Array.from(atob(base64), (c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0')).join(''));
    const amr = (JSON.parse(json) as { amr?: { timestamp?: number }[] }).amr ?? [];
    const latest = Math.max(...amr.map((entry) => entry.timestamp ?? 0));
    return latest > 0 ? latest * 1000 : null;
  } catch { return null; }
}

export class AccountStore {
  private value: AccountSnapshot = {
    status: 'unavailable', userId: null, email: null, providers: [], busy: false, error: null, notice: null,
    firstSignIn: false, proposedName: null, pendingDeletion: null, otp: EMPTY_OTP_GUARD,
  };
  private listeners = new Set<() => void>();
  private started: Promise<void> | null = null;
  private fresh: FreshAuthentication | null = null;
  constructor(private deps: AccountDependencies) {}

  getSnapshot = () => this.value;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private emit(patch: Partial<AccountSnapshot>) {
    this.value = { ...this.value, ...patch };
    for (const listener of [...this.listeners]) { try { listener(); } catch { /* observateur facultatif */ } }
  }
  private now() { return (this.deps.now ?? Date.now)(); }
  private client(): SupabaseClient {
    const client = this.deps.loadClient();
    if (!client) throw new Error('unavailable');
    return client;
  }
  private fail(error: unknown) {
    if (error instanceof Cancelled) { this.emit({ busy: false }); return; }
    const message = error instanceof Error && /network|fetch|timeout/i.test(error.message) ? MESSAGES.network
      : error instanceof Error && error.message === 'other_account' ? MESSAGES.otherAccount
      : error instanceof Error && error.message === 'last_method' ? MESSAGES.lastMethod
      : error instanceof Error && error.message === 'reauth_required' ? MESSAGES.reauth
      : MESSAGES.generic;
    this.emit({ busy: false, error: message });
  }
  private async run<T>(task: () => Promise<T>): Promise<T | null> {
    this.emit({ busy: true, error: null, notice: null });
    try { const result = await task(); this.emit({ busy: false }); return result; }
    catch (error) { this.fail(error); return null; }
  }

  /** Restaure l'état sans attendre le réseau. Ne lève jamais. */
  start(readStoredSession: () => Promise<string | null>): Promise<void> {
    this.started ??= (async () => {
      const client = this.deps.loadClient();
      if (!client) return;
      this.emit({ status: 'loading' });
      try {
        const [raw, otp, pendingDeletion] = await Promise.all([
          readStoredSession(), this.deps.kv.get(OTP_KEY), this.deps.kv.get(DELETION_KEY),
        ]);
        const stored = parseStoredSession(raw);
        this.emit({
          status: stored ? 'signedIn' : 'signedOut',
          userId: stored?.userId ?? null, email: stored?.email ?? null, providers: stored?.providers ?? [],
          otp: otp ? { ...EMPTY_OTP_GUARD, ...JSON.parse(otp) } : EMPTY_OTP_GUARD,
          pendingDeletion,
        });
      } catch { this.emit({ status: 'signedOut' }); }
      client.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_OUT') this.emit({ status: 'signedOut', userId: null, email: null, providers: [] });
        else if (session?.user) this.emit({ status: 'signedIn', userId: session.user.id, email: session.user.email ?? null, providers: providersOf(session) });
      });
      if (this.value.status === 'signedIn') void this.touch();
      if (this.value.pendingDeletion) void this.refreshDeletion();
    })();
    return this.started;
  }

  // ---------------------------------------------------------------------- Connexion
  signInWithApple() {
    return this.run(async () => {
      if (!this.deps.apple) throw new Error('unavailable');
      const credential = await this.deps.apple();
      const { data, error } = await this.client().auth.signInWithIdToken({ provider: 'apple', token: credential.identityToken, nonce: credential.rawNonce });
      if (error || !data.session) throw new Error(error?.message ?? 'apple_sign_in');
      await this.afterSignIn(data.session, { appleCode: credential.authorizationCode, proposedName: credential.fullName });
      return true;
    });
  }
  signInWithGoogle() {
    return this.run(async () => {
      if (!this.deps.google) throw new Error('unavailable');
      const token = await this.deps.google();
      const { data, error } = await this.client().auth.signInWithIdToken({ provider: 'google', token });
      if (error || !data.session) throw new Error(error?.message ?? 'google_sign_in');
      await this.afterSignIn(data.session, {});
      return true;
    });
  }
  resendDelay() { return secondsUntilResend(this.value.otp, this.now()); }
  private async saveOtp(otp: OtpGuardState) { this.emit({ otp }); await this.deps.kv.set(OTP_KEY, JSON.stringify(otp)); }
  async requestEmailCode(email: string, createUser = true): Promise<boolean> {
    if (!validEmail(email)) { this.emit({ error: 'Saisissez une adresse e-mail valide.' }); return false; }
    if (isLocked(this.value.otp, this.now())) { this.emit({ error: MESSAGES.locked }); return false; }
    if (this.value.otp.email === normalizeEmail(email) && this.resendDelay() > 0) {
      this.emit({ error: `Nouveau code possible dans ${this.resendDelay()} s.` }); return false;
    }
    const sent = await this.run(async () => {
      const { error } = await this.client().auth.signInWithOtp({ email: normalizeEmail(email), options: { shouldCreateUser: createUser } });
      if (error) throw new Error(error.message);
      return true;
    });
    if (sent) await this.saveOtp(codeSent(this.value.otp, email, this.now()));
    return sent === true;
  }
  async verifyEmailCode(email: string, code: string): Promise<boolean> {
    if (isLocked(this.value.otp, this.now())) { this.emit({ error: MESSAGES.locked }); return false; }
    if (!validCode(code)) { this.emit({ error: 'Le code comporte 6 chiffres.' }); return false; }
    this.emit({ busy: true, error: null });
    try {
      const { data, error } = await this.client().auth.verifyOtp({ email: normalizeEmail(email), token: code, type: 'email' });
      if (error || !data.session) {
        const otp = codeFailed(this.value.otp, this.now());
        await this.saveOtp(otp);
        this.emit({ busy: false, error: isLocked(otp, this.now()) ? MESSAGES.locked : MESSAGES.codeInvalid(remainingAttempts(otp)) });
        return false;
      }
      await this.saveOtp(EMPTY_OTP_GUARD);
      await this.afterSignIn(data.session, {});
      this.emit({ busy: false });
      return true;
    } catch (error) { this.fail(error); return false; }
  }

  private async afterSignIn(session: Session, extra: { appleCode?: string | null; proposedName?: string | null }) {
    const client = this.client();
    this.emit({ status: 'signedIn', userId: session.user.id, email: session.user.email ?? null, providers: providersOf(session), proposedName: extra.proposedName ?? null });
    // Acceptations versionnées enregistrées une seule fois (case 16 ans + CGU cochées avant la connexion).
    const consents = await this.consents().catch(() => null);
    const firstSignIn = !consents?.terms?.granted;
    if (firstSignIn) {
      await this.recordConsent('terms', true, TERMS_VERSION).catch(() => undefined);
      await this.recordConsent('privacy_policy', true, PRIVACY_VERSION).catch(() => undefined);
    }
    this.emit({ firstSignIn });
    void this.registerDevice();
    void this.touch(true);
    if (extra.appleCode) void client.functions.invoke('apple-link', { body: { authorizationCode: extra.appleCode } }).catch(() => undefined);
  }
  private async registerDevice() {
    const platform = this.deps.device.platform();
    if (!platform) return;
    try {
      await this.client().rpc('register_device', {
        p_device_id: await this.deps.device.id(), p_platform: platform, p_os_version: this.deps.device.osVersion(), p_app_version: this.deps.device.appVersion(),
      });
    } catch { /* réessayé à la prochaine ouverture */ }
  }
  /** Mesure d'usage minimale : au plus un appel par jour local. */
  async touch(force = false) {
    if (this.value.status !== 'signedIn') return;
    const day = this.deps.device.localDay();
    if (!force && (await this.deps.kv.get(ACTIVITY_KEY)) === `${this.value.userId}:${day}`) return;
    try {
      await this.client().rpc('touch_activity', { p_day: day, p_device_id: await this.deps.device.id() });
      await this.deps.kv.set(ACTIVITY_KEY, `${this.value.userId}:${day}`);
    } catch { /* hors ligne : réessayé plus tard */ }
  }

  // ---------------------------------------------------------------------- Choix
  async consents(): Promise<Consents> {
    const { data, error } = await this.client().rpc('my_consents');
    if (error) throw new Error(error.message);
    return (data ?? {}) as Consents;
  }
  async recordConsent(purpose: ConsentPurpose, value: boolean, version = CHOICE_VERSION, eventId?: string): Promise<ConsentResult> {
    const { data, error } = await this.client().rpc('record_consent', {
      p_purpose: purpose, p_version: version, p_granted: value,
      p_client_event_id: eventId ?? this.deps.uuid(), p_client_at: new Date(this.now()).toISOString(),
    });
    if (error) throw new Error(error.message);
    return data as ConsentResult;
  }

  // ---------------------------------------------------------------------- Profil et données
  async loadProfile(): Promise<Profile | null> {
    if (!this.value.userId) return null;
    const { data, error } = await this.client().from('profiles').select('display_name,country_code,city,age_band').eq('user_id', this.value.userId).maybeSingle();
    if (error) throw new Error(error.message);
    return data as Profile | null;
  }
  saveProfile(profile: Profile) {
    return this.run(async () => {
      const clean = (value: string | null, max: number) => (value && value.trim() ? value.trim().slice(0, max) : null);
      const { error } = await this.client().from('profiles').update({
        display_name: clean(profile.display_name, 50), country_code: profile.country_code, city: clean(profile.city, 80), age_band: profile.age_band,
      }).eq('user_id', this.value.userId!);
      if (error) throw new Error(error.message);
      this.emit({ notice: 'Profil enregistré.', proposedName: null });
      return true;
    });
  }
  async summary() {
    const { data, error } = await this.client().rpc('my_data_summary');
    if (error) throw new Error(error.message);
    return data as {
      runs: number; routes: number; online_bytes: number; support_requests: number;
      devices: { device_id: string; platform: string; os_version: string | null; app_version: string | null; last_seen_at: string; last_sync_at: string | null; last_sync_status: string | null; current: boolean }[];
      consents: { purpose: ConsentPurpose; granted: boolean; version: string; at: string }[];
    };
  }
  disconnectDevice(id: string) {
    return this.run(async () => {
      const { error } = await this.client().rpc('disconnect_device', { p_device_id: id });
      if (error) throw new Error(error.message);
      return true;
    });
  }
  exportData() {
    return this.run(async () => {
      const { data } = await this.client().auth.getSession();
      if (!data.session) throw new Error('reauth_required');
      const day = new Date(this.now()).toISOString().slice(0, 10);
      return this.deps.download(`${this.deps.functionsUrl}/export-my-data`, {
        Authorization: `Bearer ${data.session.access_token}`, apikey: this.deps.publishableKey,
      }, `sprinter-export-${day}.zip`);
    });
  }

  // ---------------------------------------------------------------------- Méthodes de connexion
  async identities(): Promise<UserIdentity[]> {
    const { data, error } = await this.client().auth.getUserIdentities();
    if (error) throw new Error(error.message);
    return data?.identities ?? [];
  }
  /** Ré-authentification réelle sur un client éphémère, pour le même compte uniquement. */
  reauthenticate(method: Provider, email?: string, code?: string): Promise<boolean> {
    return this.run(async () => {
      const ephemeral = this.deps.createEphemeralClient();
      let session: Session | null = null;
      if (method === 'apple') {
        if (!this.deps.apple) throw new Error('unavailable');
        const credential = await this.deps.apple();
        session = (await ephemeral.auth.signInWithIdToken({ provider: 'apple', token: credential.identityToken, nonce: credential.rawNonce })).data.session;
      } else if (method === 'google') {
        if (!this.deps.google) throw new Error('unavailable');
        session = (await ephemeral.auth.signInWithIdToken({ provider: 'google', token: await this.deps.google() })).data.session;
      } else {
        if (!email || !code || !validCode(code)) throw new Error('reauth_required');
        session = (await ephemeral.auth.verifyOtp({ email: normalizeEmail(email), token: code, type: 'email' })).data.session;
      }
      if (!session) throw new Error('reauth_required');
      if (session.user.id !== this.value.userId) {
        await ephemeral.auth.signOut({ scope: 'local' }).catch(() => undefined);
        throw new Error('other_account');
      }
      await this.fresh?.release();
      this.fresh = {
        userId: session.user.id, accessToken: session.access_token, at: lastAuthenticationAt(session.access_token) ?? this.now(),
        release: async () => { await ephemeral.auth.signOut({ scope: 'local' }).catch(() => undefined); },
      };
      return true;
    }).then((value) => value === true);
  }
  /** Envoie le code de ré-authentification par e-mail sans créer de compte. */
  async requestReauthCode(email: string) {
    return this.run(async () => {
      const { error } = await this.deps.createEphemeralClient().auth.signInWithOtp({ email: normalizeEmail(email), options: { shouldCreateUser: false } });
      if (error) throw new Error(error.message);
      return true;
    });
  }
  recentlyAuthenticated() {
    return !!this.fresh && this.fresh.userId === this.value.userId && this.now() - this.fresh.at <= REAUTH_WINDOW_MS;
  }
  linkProvider(provider: 'apple' | 'google') {
    return this.run(async () => {
      if (!this.recentlyAuthenticated()) throw new Error('reauth_required');
      const auth = this.client().auth;
      if (provider === 'apple') {
        if (!this.deps.apple) throw new Error('unavailable');
        const credential = await this.deps.apple();
        const { error } = await auth.linkIdentity({ provider: 'apple', token: credential.identityToken, nonce: credential.rawNonce });
        if (error) throw new Error(/already/i.test(error.message) ? 'other_account' : error.message);
        if (credential.authorizationCode) void this.client().functions.invoke('apple-link', { body: { authorizationCode: credential.authorizationCode } }).catch(() => undefined);
      } else {
        if (!this.deps.google) throw new Error('unavailable');
        const { error } = await auth.linkIdentity({ provider: 'google', token: await this.deps.google() });
        if (error) throw new Error(/already/i.test(error.message) ? 'other_account' : error.message);
      }
      await auth.refreshSession().catch(() => undefined);
      this.emit({ notice: 'Méthode de connexion ajoutée.' });
      return true;
    });
  }
  /** Ajoute ou remplace l'adresse e-mail (code envoyé à la nouvelle adresse, et à l'ancienne si elle existe). */
  requestEmailLink(email: string) {
    return this.run(async () => {
      if (!this.recentlyAuthenticated()) throw new Error('reauth_required');
      if (!validEmail(email)) throw new Error('invalid_email');
      const { error } = await this.client().auth.updateUser({ email: normalizeEmail(email) });
      if (error) throw new Error(error.message);
      return true;
    });
  }
  confirmEmailLink(email: string, code: string) {
    return this.run(async () => {
      const { error } = await this.client().auth.verifyOtp({ email: normalizeEmail(email), token: code, type: 'email_change' });
      if (error) throw new Error(error.message);
      await this.client().auth.refreshSession().catch(() => undefined);
      return true;
    });
  }
  unlink(identity: UserIdentity) {
    return this.run(async () => {
      if ((await this.identities()).length <= 1) throw new Error('last_method');
      if (!this.recentlyAuthenticated()) throw new Error('reauth_required');
      const { error } = await this.client().auth.unlinkIdentity(identity);
      if (error) throw new Error(error.message);
      await this.client().auth.refreshSession().catch(() => undefined);
      this.emit({ notice: 'Méthode de connexion retirée.' });
      return true;
    });
  }

  // ---------------------------------------------------------------------- Sortie
  /** Déconnexion : les données restent sur l'appareil (§7.8). */
  async signOut() {
    this.emit({ busy: true, error: null });
    try { await this.client().auth.signOut({ scope: 'local' }); } catch { /* hors ligne : session locale effacée quand même */ }
    await this.deps.clearSession();
    await this.fresh?.release(); this.fresh = null;
    await this.deps.kv.remove(ACTIVITY_KEY);
    this.emit({ busy: false, status: 'signedOut', userId: null, email: null, providers: [], firstSignIn: false, proposedName: null });
  }
  /** Suppression du compte (§6.6) avec le jeton issu d'une ré-authentification récente. */
  deleteAccount(): Promise<'done' | 'pending' | null> {
    return this.run(async () => {
      if (!this.recentlyAuthenticated() || !this.fresh) throw new Error('reauth_required');
      const response = await fetch(`${this.deps.functionsUrl}/delete-account`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.fresh.accessToken}`, apikey: this.deps.publishableKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: 'app' }),
      });
      if (response.status === 403) throw new Error('reauth_required');
      if (!response.ok && response.status !== 202) throw new Error(`delete_${response.status}`);
      const result = await response.json() as { status: 'done' | 'pending'; operation_id: string };
      this.fresh = null;
      await this.deps.clearSession();
      await this.deps.kv.remove(ACTIVITY_KEY);
      if (result.status === 'pending') await this.deps.kv.set(DELETION_KEY, result.operation_id);
      this.emit({
        status: 'signedOut', userId: null, email: null, providers: [],
        pendingDeletion: result.status === 'pending' ? result.operation_id : null,
        notice: result.status === 'done' ? 'Votre compte et vos données en ligne ont été supprimés.' : 'Suppression validée. Le nettoyage se termine sur nos serveurs.',
      });
      return result.status;
    });
  }
  /** Suit une suppression validée jusqu'à sa confirmation (sans session). */
  async refreshDeletion() {
    const operation = this.value.pendingDeletion;
    if (!operation) return;
    try {
      const response = await fetch(`${this.deps.functionsUrl}/delete-account?operation=${encodeURIComponent(operation)}`, { headers: { apikey: this.deps.publishableKey } });
      const result = await response.json() as { status: string };
      if (result.status === 'done' || result.status === 'unknown') {
        await this.deps.kv.remove(DELETION_KEY);
        this.emit({ pendingDeletion: null, notice: result.status === 'done' ? 'La suppression de votre compte est terminée.' : null });
      }
    } catch { /* réessayé au prochain lancement */ }
  }
  clearNotice() { this.emit({ notice: null, error: null }); }
}

