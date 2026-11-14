// Clients Supabase des Edge Functions. La clé serveur ne quitte jamais cet environnement.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { DeletionDeps } from './deletion.ts';
import { decryptSecret } from './crypto.ts';
import { appleConfigFromEnv, revokeRefreshToken } from './apple.ts';
import { logEvent } from './http.ts';

const env = (name: string) => Deno.env.get(name)?.trim() || undefined;

function firstKey(json: string | undefined): string | undefined {
  if (!json) return undefined;
  try {
    const parsed = JSON.parse(json) as Record<string, string>;
    return parsed.default ?? Object.values(parsed)[0];
  } catch { return undefined; }
}

export function supabaseUrl(): string {
  const url = env('SUPABASE_URL');
  if (!url) throw new Error('missing_supabase_url');
  return url;
}

/** Clé serveur : variable historique ou nouveau format de clés secrètes. */
function serverKey(): string {
  const key = env('SUPABASE_SERVICE_ROLE_KEY') ?? firstKey(env('SUPABASE_SECRET_KEYS'));
  if (!key) throw new Error('missing_server_key');
  return key;
}

function publicKey(): string {
  const key = env('SUPABASE_ANON_KEY') ?? firstKey(env('SUPABASE_PUBLISHABLE_KEYS'));
  if (!key) throw new Error('missing_public_key');
  return key;
}

const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };

export function serverClient(): SupabaseClient {
  return createClient(supabaseUrl(), serverKey(), options);
}

/** Client agissant avec les droits de l'utilisateur (RLS) : sert à l'export et aux RPC admin. */
export function userClient(token: string): SupabaseClient {
  return createClient(supabaseUrl(), publicKey(), { ...options, global: { headers: { Authorization: `Bearer ${token}` } } });
}

export async function rpcOrThrow<T>(client: SupabaseClient, name: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await client.rpc(name, args);
  if (error) throw new Error(error.message || error.code || 'rpc_failed');
  return data as T;
}

/** Liste récursive des objets d'un utilisateur dans un bucket (dossier `<uid>/`). */
export async function listUserObjects(client: SupabaseClient, bucket: string, prefix: string): Promise<string[]> {
  const paths: string[] = [];
  const walk = async (folder: string) => {
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await client.storage.from(bucket).list(folder, { limit: 1000, offset });
      if (error) {
        if (/not.?found/i.test(error.message)) return;
        throw new Error(`storage_list:${error.message}`);
      }
      for (const entry of data ?? []) {
        const path = `${folder}/${entry.name}`;
        if (entry.id === null) await walk(path); else paths.push(path);
      }
      if (!data || data.length < 1000) return;
    }
  };
  await walk(prefix);
  return paths;
}

export function deletionDeps(client: SupabaseClient): DeletionDeps {
  const apple = appleConfigFromEnv(env);
  const tokenKey = env('APPLE_TOKEN_KEY');
  return {
    rpc: (name, args) => rpcOrThrow(client, name, args),
    async providers(userId) {
      const { data, error } = await client.auth.admin.getUserById(userId);
      if (error) {
        if (/not.?found/i.test(error.message) || error.status === 404) return null;
        throw new Error('auth_lookup');
      }
      return (data.user?.identities ?? []).map((identity) => identity.provider);
    },
    async banUser(userId) {
      const { error } = await client.auth.admin.updateUserById(userId, { ban_duration: '876000h' });
      if (error && !/not.?found/i.test(error.message)) throw new Error('auth_ban');
    },
    async deleteAuthUser(userId) {
      const { error } = await client.auth.admin.deleteUser(userId);
      if (error && !/not.?found/i.test(error.message)) throw new Error('auth_delete');
    },
    listUserObjects: (bucket, userId) => listUserObjects(client, bucket, userId),
    async removeObjects(bucket, paths) {
      const { error } = await client.storage.from(bucket).remove(paths);
      if (error) throw new Error('storage_remove');
    },
    revokeApple: apple && tokenKey
      ? async (ciphertext) => revokeRefreshToken(apple, await decryptSecret(ciphertext, tokenKey))
      : null,
    log: logEvent,
  };
}
