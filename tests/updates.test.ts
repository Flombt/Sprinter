import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UpdateManager, type UpdateSafety } from '../src/services/updateManager';

function pending<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

function fixture() {
  const safety: UpdateSafety = {
    ready: true,
    loading: false,
    busy: false,
    run: null,
    foreground: true,
    online: true,
  };
  const check = vi.fn(async (): Promise<{ isAvailable: boolean; isRollBackToEmbedded?: boolean }> => ({
    isAvailable: true,
  }));
  const fetch = vi.fn(async (): Promise<{ isNew: boolean; isRollBackToEmbedded?: boolean }> => ({
    isNew: true,
  }));
  const report = vi.fn();
  const enabled = vi.fn(() => true);
  const manager = new UpdateManager({ enabled, safety: () => safety, check, fetch, report });
  return { manager, safety, check, fetch, report, enabled };
}

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('OTA conservatrices', () => {
  it('télécharge une version compatible sans recharger et la garde prête', async () => {
    const { manager, check, fetch } = fixture();
    const states: string[] = [];
    manager.subscribe(() => states.push(manager.getSnapshot().status));
    await manager.request();
    await manager.request();
    expect(states).toEqual(['checking', 'downloading', 'ready']);
    expect(check).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it.each([
    [{ ready: false }, 'startup'],
    [{ loading: true }, 'startup'],
    [{ run: { running: true } }, 'session'],
    [{ run: { running: false } }, 'session'],
    [{ run: { restored: true } }, 'session'],
    [{ recoveryBlocked: true }, 'session'],
    [{ busy: true }, 'storage'],
    [{ foreground: false }, 'background'],
    [{ online: false }, 'network'],
  ] as const)('reporte la recherche dans le contexte %j', async (patch, reason) => {
    const { manager, safety, check, fetch } = fixture();
    Object.assign(safety, patch);
    await manager.request();
    expect(manager.getSnapshot()).toMatchObject({ status: 'deferred', deferred: reason });
    expect(check).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
    Object.assign(safety, {
      ready: true,
      loading: false,
      run: null,
      recoveryBlocked: false,
      busy: false,
      foreground: true,
      online: true,
    });
    await manager.request();
    expect(manager.getSnapshot().status).toBe('ready');
  });

  it('reste inactif dans les clients sans OTA', async () => {
    const { manager, enabled, check } = fixture();
    enabled.mockReturnValue(false);
    await manager.request();
    expect(check).not.toHaveBeenCalled();
    expect(manager.getSnapshot().status).toBe('idle');
  });

  it('mutualise les demandes concurrentes, même depuis un observateur', async () => {
    const { manager, check, fetch } = fixture();
    const result = pending<{ isAvailable: boolean }>();
    check.mockReturnValue(result.promise);
    manager.subscribe(() => {
      void manager.request();
    });
    const first = manager.request();
    expect(manager.request()).toBe(first);
    await vi.advanceTimersByTimeAsync(0);
    expect(check).toHaveBeenCalledTimes(1);
    result.resolve({ isAvailable: true });
    await first;
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it.each([{ run: {} }, { busy: true }, { online: false }, { foreground: false }])(
    'revérifie la sécurité avant le téléchargement (%j)',
    async (patch) => {
      const { manager, safety, check, fetch } = fixture();
      const result = pending<{ isAvailable: boolean }>();
      check.mockReturnValue(result.promise);
      const task = manager.request();
      await vi.advanceTimersByTimeAsync(0);
      Object.assign(safety, patch);
      result.resolve({ isAvailable: true });
      await task;
      expect(fetch).not.toHaveBeenCalled();
      expect(manager.getSnapshot().status).toBe('deferred');
    },
  );

  it('laisse finir un téléchargement déjà engagé sans toucher à une nouvelle course', async () => {
    const { manager, safety, fetch } = fixture();
    const result = pending<{ isNew: boolean }>();
    fetch.mockReturnValue(result.promise);
    const task = manager.request();
    await vi.advanceTimersByTimeAsync(0);
    const run = { running: true };
    safety.run = run;
    result.resolve({ isNew: true });
    await task;
    expect(manager.getSnapshot().status).toBe('ready');
    expect(safety.run).toBe(run);
  });

  it('espace de six heures les recherches sans résultat, y compris incompatible', async () => {
    const { manager, check, fetch } = fixture();
    check.mockResolvedValue({ isAvailable: false });
    await manager.request();
    expect(manager.getSnapshot().status).toBe('idle');
    await vi.advanceTimersByTimeAsync(6 * 60 * 60 * 1000 - 1);
    await manager.request();
    expect(check).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    await manager.request();
    expect(check).toHaveBeenCalledTimes(2);
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each(['check', 'download'] as const)(
    'contient une erreur %s et réessaie après quinze minutes',
    async (stage) => {
      const { manager, check, fetch, report } = fixture();
      const operation = stage === 'check' ? check : fetch;
      operation.mockRejectedValueOnce(new Error('https://private.invalid?token=secret'));
      await manager.request();
      expect(manager.getSnapshot()).toMatchObject({ status: 'failed', error: stage });
      expect(report).toHaveBeenCalledExactlyOnceWith(stage);
      await manager.request();
      expect(check).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(15 * 60 * 1000);
      await manager.request();
      expect(manager.getSnapshot().status).toBe('ready');
    },
  );

  it('signale un délai dépassé sans lancer une seconde requête native ni télécharger tardivement', async () => {
    const { manager, check, fetch, report } = fixture();
    const result = pending<{ isAvailable: boolean }>();
    check.mockReturnValue(result.promise);
    const task = manager.request();
    await vi.advanceTimersByTimeAsync(30_000);
    expect(manager.getSnapshot()).toMatchObject({ status: 'failed', error: 'timeout' });
    expect(report).toHaveBeenCalledExactlyOnceWith('timeout');
    await vi.advanceTimersByTimeAsync(20 * 60 * 1000);
    expect(manager.request()).toBe(task);
    expect(check).toHaveBeenCalledTimes(1);
    result.resolve({ isAvailable: true });
    await task;
    expect(fetch).not.toHaveBeenCalled();
  });

  it('conserve le verrou après le délai de téléchargement et reconnaît un résultat tardif valide', async () => {
    const { manager, check, fetch } = fixture();
    const result = pending<{ isNew: boolean }>();
    fetch.mockReturnValue(result.promise);
    const task = manager.request();
    await vi.advanceTimersByTimeAsync(120_000);
    expect(manager.getSnapshot()).toMatchObject({ status: 'failed', error: 'timeout' });
    expect(manager.request()).toBe(task);
    expect(check).toHaveBeenCalledTimes(1);
    result.resolve({ isNew: true });
    await task;
    expect(manager.getSnapshot().status).toBe('ready');
  });

  it('traite aussi une directive Expo de retour au bundle embarqué', async () => {
    const { manager, check, fetch } = fixture();
    check.mockResolvedValue({ isAvailable: false, isRollBackToEmbedded: true });
    fetch.mockResolvedValue({ isNew: false, isRollBackToEmbedded: true });
    await manager.request();
    expect(fetch).toHaveBeenCalledOnce();
    expect(manager.getSnapshot().status).toBe('ready');
  });

  it('n’annonce pas une mise à jour prête si Expo ne la confirme pas', async () => {
    const { manager, fetch } = fixture();
    fetch.mockResolvedValue({ isNew: false });
    await manager.request();
    expect(manager.getSnapshot().status).toBe('idle');
  });
});
