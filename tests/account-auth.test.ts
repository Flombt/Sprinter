import { randomBytes, randomUUID } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createEncryptedSessionStorage, SESSION_PREFIX } from '../src/account/secureSession';
import { createMemoryKeyValueStore } from '../src/account/kvStore';
import {
  codeFailed, codeSent, EMPTY_OTP_GUARD, isLocked, OTP_LOCK_MS, OTP_RESEND_MS, secondsUntilResend, validCode, validEmail,
} from '../src/account/otpGuard';
import { AccountStore, lastAuthenticationAt, parseStoredSession, REAUTH_WINDOW_MS, type AccountDependencies } from '../src/account/accountStore';

const secrets = () => {
  const map = new Map<string, string>();
  return {
    map,
    async getItemAsync(key: string) { return map.get(key) ?? null; },
    async setItemAsync(key: string, value: string) { map.set(key, value); },
    async deleteItemAsync(key: string) { map.delete(key); },
  };
};
const random = (length: number) => new Uint8Array(randomBytes(length));
const b64 = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
const accessToken = (sub: string, authSecondsAgo: number, now = Date.now()) =>
  `x.${b64({ sub, amr: [{ method: 'otp', timestamp: Math.floor(now / 1000) - authSecondsAgo }] })}.y`;

describe('session chiffrée (§6.3)', () => {
  it('ne stocke jamais la session en clair et la relit avec la clé du trousseau', async () => {
    const kv = createMemoryKeyValueStore(), store = secrets();
    const storage = createEncryptedSessionStorage({ secrets: store, kv, random });
    const session = JSON.stringify({ access_token: 'secret-access', refresh_token: 'secret-refresh', user: { id: randomUUID() } });
    await storage.setItem('sprinter-auth', session);
    const sealed = kv.data.get(SESSION_PREFIX + 'sprinter-auth')!;
    expect(sealed).toMatch(/^v1:[0-9a-f]{32}:[0-9a-f]+$/);
    expect(sealed).not.toContain('secret');
    expect(store.map.size).toBe(1);
    expect(await storage.getItem('sprinter-auth')).toBe(session);
    // Une nouvelle instance (redémarrage de l'app) relit avec la même clé.
    expect(await createEncryptedSessionStorage({ secrets: store, kv, random }).getItem('sprinter-auth')).toBe(session);
  });

  it('sans clé ou après effacement, aucune session n’est restituée', async () => {
    const kv = createMemoryKeyValueStore(), store = secrets();
    const storage = createEncryptedSessionStorage({ secrets: store, kv, random });
    await storage.setItem('sprinter-auth', '{"user":{}}');
    store.map.clear();
    expect(await createEncryptedSessionStorage({ secrets: store, kv, random }).getItem('sprinter-auth')).toBeNull();
    await storage.clear();
    expect([...kv.data.keys()].some((key) => key.startsWith(SESSION_PREFIX))).toBe(false);
  });
});

describe('code e-mail (§6.1)', () => {
  it('renvoi après 60 s, 5 essais puis pause de 15 min', () => {
    let state = codeSent(EMPTY_OTP_GUARD, 'Coureur@Example.test', 1000);
    expect(state.email).toBe('coureur@example.test');
    expect(secondsUntilResend(state, 1000 + OTP_RESEND_MS - 1000)).toBe(1);
    expect(secondsUntilResend(state, 1000 + OTP_RESEND_MS)).toBe(0);
    for (let i = 0; i < 4; i++) state = codeFailed(state, 2000);
    expect(isLocked(state, 2000)).toBe(false);
    state = codeFailed(state, 2000);
    expect(isLocked(state, 2000)).toBe(true);
    expect(isLocked(state, 2000 + OTP_LOCK_MS)).toBe(false);
    expect(codeSent(state, 'autre@example.test', 3000).lockedUntil).toBeNull();
    expect(validCode('123456')).toBe(true);
    expect(validCode('12345a')).toBe(false);
    expect(validEmail('a@b.fr')).toBe(true);
    expect(validEmail('pas-un-email')).toBe(false);
  });
});

type Fake = ReturnType<typeof fakeClient>;
function fakeClient(userId: string) {
  const rpc = vi.fn(async (name: string, _args?: Record<string, unknown>) => {
    if (name === 'my_consents') return { data: { terms: null }, error: null };
    if (name === 'record_consent') return { data: { status: 'applied', effective: null }, error: null };
    return { data: { ok: true }, error: null };
  });
  const session = (id: string, ago = 0) => ({ access_token: accessToken(id, ago), user: { id, email: 'c@example.test', app_metadata: { providers: ['email'] } } });
  const auth = {
    verifyOtp: vi.fn(async ({ token }: { token: string }) => token === '123456'
      ? { data: { session: session(userId) }, error: null } : { data: { session: null }, error: { message: 'invalid' } }),
    signInWithOtp: vi.fn(async () => ({ error: null })),
    signInWithIdToken: vi.fn(async () => ({ data: { session: session(userId) }, error: null })),
    signOut: vi.fn(async () => ({ error: null })),
    onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe() {} } } })),
    getUserIdentities: vi.fn(async () => ({ data: { identities: [{ provider: 'email', identity_id: 'i1' }] }, error: null })),
    unlinkIdentity: vi.fn(async () => ({ error: null })),
    refreshSession: vi.fn(async () => ({})),
    getSession: vi.fn(async () => ({ data: { session: session(userId) } })),
  };
  return { rpc, auth, functions: { invoke: vi.fn(async () => ({})) }, session };
}

function store(options: { client: Fake; ephemeral?: Fake; now?: () => number }) {
  const kv = createMemoryKeyValueStore();
  const clearSession = vi.fn(async () => undefined);
  const deps: AccountDependencies = {
    loadClient: () => options.client as unknown as SupabaseClient,
    createEphemeralClient: () => (options.ephemeral ?? options.client) as unknown as SupabaseClient,
    clearSession, kv, apple: null, google: null,
    device: { id: async () => 'device-1', platform: () => 'ios', osVersion: () => '27.0', appVersion: () => '1.0.0', localDay: () => '2026-11-14' },
    functionsUrl: 'https://example.supabase.co/functions/v1', publishableKey: 'pk', download: async () => 'file://x', uuid: randomUUID,
    now: options.now,
  };
  return { account: new AccountStore(deps), kv, clearSession };
}

afterEach(() => { vi.unstubAllGlobals(); });

describe('compte facultatif', () => {
  it('restaure l’état connecté sans réseau à partir de la session conservée', async () => {
    const id = randomUUID();
    const { account } = store({ client: fakeClient(id) });
    await account.start(async () => JSON.stringify({ user: { id, email: 'c@example.test', app_metadata: { providers: ['apple'] } } }));
    expect(account.getSnapshot()).toMatchObject({ status: 'signedIn', userId: id, providers: ['apple'] });
    expect(parseStoredSession('{broken')).toBeNull();
    const { account: guest } = store({ client: fakeClient(id) });
    await guest.start(async () => null);
    expect(guest.getSnapshot().status).toBe('signedOut');
  });

  it('bloque après 5 codes faux et enregistre CGU + confidentialité à la première connexion', async () => {
    const id = randomUUID();
    const client = fakeClient(id);
    const { account } = store({ client });
    await account.start(async () => null);
    for (let i = 0; i < 4; i++) expect(await account.verifyEmailCode('c@example.test', '000000')).toBe(false);
    expect(account.getSnapshot().error).toMatch(/Dernier essai/);
    expect(await account.verifyEmailCode('c@example.test', '000000')).toBe(false);
    expect(account.getSnapshot().error).toMatch(/Trop d’essais/);
    expect(await account.verifyEmailCode('c@example.test', '123456')).toBe(false);
    expect(client.auth.verifyOtp).toHaveBeenCalledTimes(5);

    const fresh = fakeClient(id);
    const { account: other } = store({ client: fresh });
    await other.start(async () => null);
    expect(await other.verifyEmailCode('c@example.test', '123456')).toBe(true);
    expect(other.getSnapshot()).toMatchObject({ status: 'signedIn', firstSignIn: true });
    const purposes = fresh.rpc.mock.calls.filter(([name]) => name === 'record_consent').map(([, args]) => args?.p_purpose);
    expect(purposes).toEqual(['terms', 'privacy_policy']);
  });

  it('ré-authentification : même compte exigé, valable 5 minutes', async () => {
    let now = Date.now();
    const id = randomUUID();
    const intruder = fakeClient(randomUUID());
    const { account } = store({ client: fakeClient(id), ephemeral: intruder, now: () => now });
    await account.start(async () => JSON.stringify({ user: { id } }));
    expect(await account.reauthenticate('email', 'c@example.test', '123456')).toBe(false);
    expect(account.getSnapshot().error).toMatch(/autre compte/);
    expect(intruder.auth.signOut).toHaveBeenCalled();

    const same = store({ client: fakeClient(id), now: () => now });
    await same.account.start(async () => JSON.stringify({ user: { id } }));
    expect(await same.account.reauthenticate('email', 'c@example.test', '123456')).toBe(true);
    expect(same.account.recentlyAuthenticated()).toBe(true);
    now += REAUTH_WINDOW_MS + 1000;
    expect(same.account.recentlyAuthenticated()).toBe(false);
  });

  it('refuse de retirer la dernière méthode de connexion', async () => {
    const id = randomUUID();
    const client = fakeClient(id);
    const { account } = store({ client });
    await account.start(async () => JSON.stringify({ user: { id } }));
    await account.reauthenticate('email', 'c@example.test', '123456');
    expect(await account.unlink({ provider: 'email' } as never)).toBeNull();
    expect(account.getSnapshot().error).toMatch(/au moins une méthode/);
    expect(client.auth.unlinkIdentity).not.toHaveBeenCalled();
  });

  it('suppression : exige une ré-authentification, suit le nettoyage jusqu’à la fin', async () => {
    const id = randomUUID();
    const { account, kv, clearSession } = store({ client: fakeClient(id) });
    await account.start(async () => JSON.stringify({ user: { id } }));
    const fetchMock = vi.fn(async (url: string) => url.includes('?operation=')
      ? new Response(JSON.stringify({ status: 'done' }))
      : new Response(JSON.stringify({ status: 'pending', operation_id: 'op-1' }), { status: 202 }));
    vi.stubGlobal('fetch', fetchMock);
    expect(await account.deleteAccount()).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
    await account.reauthenticate('email', 'c@example.test', '123456');
    expect(await account.deleteAccount()).toBe('pending');
    expect(clearSession).toHaveBeenCalled();
    expect(account.getSnapshot()).toMatchObject({ status: 'signedOut', pendingDeletion: 'op-1' });
    expect(kv.data.get('deletion.operation.v1')).toBe('op-1');
    await account.refreshDeletion();
    expect(account.getSnapshot().pendingDeletion).toBeNull();
    expect(kv.data.has('deletion.operation.v1')).toBe(false);
  });

  it('lit la date d’authentification réelle dans le jeton', () => {
    const now = 1_900_000_000_000;
    expect(lastAuthenticationAt(accessToken('u', 120, now))).toBe(now - 120_000);
    expect(lastAuthenticationAt('pas-un-jeton')).toBeNull();
  });
});
