// Suppression de compte (§6.6), rejouable : chaque étape tolère qu'elle ait déjà eu lieu.
// 1. validation (accès retirés, sessions révoquées) · 2. blocage de connexion
// 3. révocation du jeton Apple · 4. fichiers Storage · 5. suppression Auth (cascades) · 6. audit.

export const USER_BUCKETS = ['run-tracks', 'profile-media'] as const;

export interface DeletionDeps {
  rpc<T = unknown>(name: string, args: Record<string, unknown>): Promise<T>;
  /** Fournisseurs liés au compte, ou null si le compte Auth n'existe plus. */
  providers(userId: string): Promise<string[] | null>;
  banUser(userId: string): Promise<void>;
  deleteAuthUser(userId: string): Promise<void>;
  listUserObjects(bucket: string, userId: string): Promise<string[]>;
  removeObjects(bucket: string, paths: string[]): Promise<void>;
  /** null si la révocation Apple n'est pas configurée (secrets absents). */
  revokeApple: ((ciphertext: string, keyVersion: number) => Promise<void>) | null;
  log(event: string, data?: Record<string, unknown>): void;
}

export type DeletionResult =
  | { status: 'done'; operation_id: string }
  | { status: 'not_found' }
  | { status: 'pending'; operation_id: string; step: string };

export async function processDeletion(deps: DeletionDeps, userId: string, operationId: string, source: 'app' | 'web' | 'admin'): Promise<DeletionResult> {
  const begin = await deps.rpc<{ status: string; operation_id?: string }>('service_begin_account_deletion', {
    p_user_id: userId, p_source: source, p_operation_id: operationId,
  });
  if (begin.status === 'not_found') return { status: 'not_found' };
  const operation = begin.operation_id ?? operationId;
  if (begin.status === 'done') return { status: 'done', operation_id: operation };

  let step = 'ban';
  try {
    const providers = await deps.providers(userId);
    if (providers) await deps.banUser(userId);

    step = 'apple';
    if (providers?.includes('apple')) {
      const tokens = await deps.rpc<{ ciphertext: string; key_version: number }[]>('service_get_apple_token', { p_user_id: userId });
      const token = tokens?.[0];
      if (token) {
        if (!deps.revokeApple) throw new Error('apple_not_configured');
        await deps.revokeApple(token.ciphertext, token.key_version);
      } else {
        // Sans jeton conservé, la révocation reste possible depuis les réglages de l'identifiant Apple.
        deps.log('deletion.apple_token_missing', { operation_id: operation });
      }
    }

    step = 'storage';
    for (const bucket of USER_BUCKETS) {
      const paths = await deps.listUserObjects(bucket, userId);
      for (let index = 0; index < paths.length; index += 100) await deps.removeObjects(bucket, paths.slice(index, index + 100));
    }

    step = 'auth';
    if (providers) await deps.deleteAuthUser(userId);

    step = 'finish';
    await deps.rpc('service_finish_account_deletion', { p_user_id: userId, p_operation_id: operation });
    deps.log('deletion.done', { operation_id: operation });
    return { status: 'done', operation_id: operation };
  } catch (error) {
    const code = `${step}:${error instanceof Error ? error.message : 'unknown'}`.slice(0, 120);
    deps.log('deletion.pending', { operation_id: operation, step, code });
    try { await deps.rpc('service_fail_account_deletion', { p_user_id: userId, p_error: code }); } catch { /* reprise planifiée */ }
    return { status: 'pending', operation_id: operation, step };
  }
}
