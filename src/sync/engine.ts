import type { Settings } from '../core/types';
import type { LocalRunForPush, SyncLocalStore } from './localStore';
import { mergePortable, portableSettings, PORTABLE_KEYS, settingsHash } from './settings';
import { SyncError, type BackupState, type Cursor, type PushItem, type SyncRemote, type SyncStatus } from './types';

/**
 * Moteur de synchronisation (§7.4). Jamais bloquant pour l'interface : il s'exécute en
 * arrière-plan, s'interrompt dès qu'une course démarre et reprend là où il s'était arrêté
 * (outbox et curseur persistants). Un seul passage à la fois.
 */
export interface SyncHost {
  enabled(): boolean;
  userId(): string | null;
  runActive(): boolean;
  /** Rafraîchit le jeton une seule fois ; faux si une reconnexion est nécessaire. */
  refreshAuth(): Promise<boolean>;
  localSettings(): Settings;
  applyRemoteSettings(patch: Partial<Settings>): Promise<void>;
  historyChanged(): Promise<void>;
  recordBackupChoice(on: boolean, eventId: string, at: string): Promise<{ status: 'applied' | 'duplicate' | 'stale'; granted: boolean | null }>;
  platform(): 'ios' | 'android' | null;
  appVersion(): string;
  timeZone(): string | null;
  uuid(): string;
  now(): number;
  /** Rend la main à l'interface entre deux lots (aucune image gelée). */
  yieldToUi(): Promise<void>;
}

export const PULL_OVERLAP_MS = 5 * 60_000;
export const RECONCILE_AFTER_MS = 60 * 24 * 3600_000;
export const PUSH_BATCH = 20;
export const MAX_BATCHES_PER_PASS = 50;
const MAX_PULL_PAGES = 100;

export function backoffMs(attempts: number, random = Math.random()) {
  return Math.round(Math.min(15 * 60_000, 5000 * 2 ** attempts) * (0.5 + random));
}

/** Synchronisations complémentaires exécutées après les courses quand la sauvegarde est active (2b, tracés…). */
export interface SyncExtension { name: string; run(context: { routesOn: boolean; guard(): void }): Promise<void> }

const INITIAL: SyncStatus = {
  phase: 'disabled', backup: 'unset', routes: 'unset', lastSuccessAt: null, pending: 0, blocked: 0, deletedElsewhere: [], importing: false, message: null,
};

class Interrupted extends Error {}

export class SyncEngine {
  private value: SyncStatus = INITIAL;
  private listeners = new Set<() => void>();
  private inFlight: Promise<SyncStatus> | null = null;
  private syncUserId: string | null = null;
  private resetting = false;
  private notBefore = 0;
  private reconcileRequested = false;
  constructor(private local: SyncLocalStore, private remote: SyncRemote, private host: SyncHost, private extensions: SyncExtension[] = []) {}
  addExtension(extension: SyncExtension) { this.extensions.push(extension); }
  activeUser = () => this.syncUserId;

  getSnapshot = () => this.value;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private emit(patch: Partial<SyncStatus>) {
    this.value = { ...this.value, ...patch };
    for (const listener of [...this.listeners]) { try { listener(); } catch { /* observateur facultatif */ } }
  }
  private guard() {
    if (this.host.runActive() || !this.host.enabled() || this.host.userId() !== this.syncUserId) throw new Interrupted();
  }

  async refreshCounts() {
    const [counts, backup, last, pendingChoice] = await Promise.all([
      this.local.counts(), this.local.getState('backup_runs'), this.local.getState('last_success_at'), this.local.getState('pending_reconcile'),
    ]);
    this.emit({
      ...counts, backup: (backup as BackupState | null) ?? 'unset', lastSuccessAt: last ? Number(last) : null,
      deletedElsewhere: pendingChoice ? JSON.parse(pendingChoice) as string[] : [],
    });
  }

  /** Point d'entrée unique (premier plan, fin de course, retour du réseau, « Réessayer »). */
  sync(trigger: string): Promise<SyncStatus> {
    if (this.resetting) return Promise.resolve(this.value);
    if (!this.host.enabled() || !this.host.userId()) { this.emit({ phase: 'disabled' }); return Promise.resolve(this.value); }
    if (this.host.runActive()) return Promise.resolve(this.value);
    if (trigger !== 'manual' && this.host.now() < this.notBefore) return Promise.resolve(this.value);
    this.inFlight ??= this.pass().finally(() => {
      const accountChanged = this.host.userId() !== this.syncUserId;
      this.syncUserId = null;
      this.inFlight = null;
      if (accountChanged) void this.sync('manual');
    });
    return this.inFlight;
  }

  async resetForAccount(userId: string, clearDevice: () => Promise<boolean>): Promise<boolean> {
    if (this.resetting || !this.host.enabled()) return false;
    this.resetting = true;
    try {
      await this.inFlight;
      if (this.host.userId() !== userId || this.host.runActive()) return false;
      if (!await clearDevice()) return false;
      this.notBefore = 0;
      this.reconcileRequested = false;
      this.emit({ ...INITIAL, phase: 'idle' });
      return true;
    } finally { this.resetting = false; }
  }

  /** Choix explicite de sauvegarde des courses (§6.5). La désactivation s'applique tout de suite sur cet appareil. */
  async chooseBackup(on: boolean): Promise<BackupState> {
    const userId = this.host.userId();
    if (this.resetting || !this.host.enabled() || !userId) return this.value.backup;
    const eventId = this.host.uuid();
    const event = { id: eventId, at: new Date(this.host.now()).toISOString(), on };
    if (!await this.local.recordBackupChoice(userId, event)) {
      await this.sync('manual');
      return 'unset';
    }
    this.emit({ backup: on ? 'pending_on' : 'pending_off' });
    await this.sync('manual');
    return this.value.backup;
  }

  async resolveDeletedElsewhere(choice: 'delete' | 'keep') {
    const ids = this.value.deletedElsewhere;
    if (choice === 'delete') await this.local.deleteLocal(ids); else await this.local.keepLocalOnly(ids);
    await this.local.setState('pending_reconcile', null);
    this.emit({ deletedElsewhere: [] });
    if (choice === 'delete') await this.host.historyChanged();
  }

  async retryBlocked() {
    await this.local.retryBlocked();
    this.notBefore = 0;
    return this.sync('manual');
  }
  requestReconciliation() { this.reconcileRequested = true; return this.sync('manual'); }

  private async pass(): Promise<SyncStatus> {
    const userId = this.host.userId()!;
    this.syncUserId = userId;
    this.emit({ phase: 'running', message: null });
    let refreshed = false, partial = false;
    const attempt = async <T>(step: () => Promise<T>): Promise<T> => {
      this.guard();
      try { return await step(); }
      catch (error) {
        this.guard();
        if (error instanceof SyncError && error.kind === 'auth' && !refreshed) {
          refreshed = true;
          if (await this.host.refreshAuth()) { this.guard(); return step(); }
        }
        throw error;
      }
    };
    try {
      const binding = await this.local.bind(userId);
      this.guard();
      if (binding === 'other') {
        this.emit({ phase: 'bound_other', message: 'Cet appareil contient les données d’un autre compte. Pour continuer, effacez-les ou annulez.' });
        return this.value;
      }
      this.guard();
      await attempt(() => this.syncSettings());
      this.guard();
      const backup = await attempt(() => this.resolveBackup());
      if (backup === 'on') {
        await this.prepareImport();
        await attempt(() => this.reconcileIfNeeded());
        this.guard();
        partial = await attempt(() => this.pushRuns());
        this.guard();
        await attempt(() => this.pull());
        const routesChoice = (await attempt(() => this.remote.backupChoices())).routes;
        this.emit({ routes: routesChoice === null ? 'unset' : routesChoice ? 'on' : 'off' });
        const routesOn = routesChoice === true;
        for (const extension of this.extensions) {
          this.guard();
          await attempt(() => extension.run({ routesOn, guard: () => this.guard() }));
        }
      }
      this.guard();
      await this.local.setState('last_success_at', String(this.host.now()));
      this.guard();
      await this.remote.reportSync(partial ? 'partial' : 'ok', partial ? 'rejected_items' : null).catch(() => undefined);
      await this.refreshCounts();
      this.emit({ phase: 'idle', importing: false });
    } catch (error) {
      await this.refreshCounts().catch(() => undefined);
      if (error instanceof Interrupted || this.host.userId() !== userId) { this.emit({ phase: 'idle', importing: false }); return this.value; }
      const kind = error instanceof SyncError ? error.kind : 'server';
      if (kind === 'rate') this.notBefore = this.host.now() + ((error as SyncError).retryAfterMs ?? 60_000);
      const phase = kind === 'network' ? 'offline' : kind === 'auth' ? 'reauth' : kind === 'rate' ? 'paused' : 'error';
      const message = phase === 'offline' ? 'Hors connexion : la synchronisation reprendra automatiquement.'
        : phase === 'reauth' ? 'Reconnectez-vous pour reprendre la synchronisation. Vos données restent sur cet appareil.'
        : phase === 'paused' ? 'Synchronisation suspendue quelques instants.'
        : 'La synchronisation a échoué. Vos données restent sur cet appareil.';
      this.emit({ phase, message, importing: false });
      if (kind !== 'network') await this.remote.reportSync('error', (error as SyncError).code ?? kind).catch(() => undefined);
    }
    return this.value;
  }

  // ------------------------------------------------------------------ Choix de sauvegarde
  private async resolveBackup(): Promise<BackupState> {
    let state = ((await this.local.getState('backup_runs')) as BackupState | null) ?? 'unset';
    if (state === 'pending_on' || state === 'pending_off') {
      const event = JSON.parse((await this.local.getState('backup_event')) ?? 'null') as { id: string; at: string; on: boolean } | null;
      if (event) {
        this.guard();
        const result = await this.host.recordBackupChoice(event.on, event.id, event.at);
        this.guard();
        // Une décision plus récente ailleurs l'emporte : le titulaire devra choisir à nouveau.
        state = result.status === 'stale' ? (result.granted ? 'on' : result.granted === false ? 'off' : 'unset') : event.on ? 'on' : 'off';
        await this.local.setState('backup_event', null);
      }
    } else {
      this.guard();
      const choices = await this.remote.backupChoices();
      this.guard();
      state = choices.runs === null ? 'unset' : choices.runs ? 'on' : 'off';
    }
    await this.local.setState('backup_runs', state);
    this.emit({ backup: state });
    return state;
  }
  private async prepareImport() {
    if (!(await this.local.getState('local_backup_at'))) await this.local.backupBeforeImport();
    const added = await this.local.enqueueUnsynced(this.host.now());
    if (added > 0) this.emit({ importing: true });
  }

  // ------------------------------------------------------------------ Réglages portables
  private async syncSettings() {
    const [entry] = await this.local.dueOutbox(this.host.now(), 1, 'settings');
    const localPortable = portableSettings(this.host.localSettings());
    const localHash = settingsHash(localPortable);
    const lastHash = await this.local.getState('settings_hash');
    if (entry) {
      if (localHash === lastHash) { await this.local.complete(entry, {}); return; }
      this.guard();
      const result = await this.remote.pushPreferences(localPortable as Record<string, unknown>, new Date(entry.createdAt).toISOString());
      this.guard();
      if (result.status === 'ignored_stale') await this.applySettings(result.data);
      else await this.local.setState('settings_hash', localHash);
      await this.local.complete(entry, {});
      return;
    }
    this.guard();
    const remote = await this.remote.getPreferences();
    this.guard();
    if (!remote) {
      if (lastHash !== localHash) {
        await this.remote.pushPreferences(localPortable as Record<string, unknown>, new Date(this.host.now()).toISOString());
        await this.local.setState('settings_hash', localHash);
      }
      return;
    }
    const remoteHash = settingsHash(pick(remote.data));
    if (remoteHash !== lastHash && remoteHash !== localHash) await this.applySettings(remote.data);
    else if (remoteHash !== lastHash) await this.local.setState('settings_hash', remoteHash);
  }
  private async applySettings(data: Record<string, unknown>) {
    const patch = mergePortable(this.host.localSettings(), pick(data));
    await this.local.setState('settings_hash', settingsHash(pick(data)));
    await this.host.applyRemoteSettings(patch);
  }

  // ------------------------------------------------------------------ Réconciliation (§7.7)
  private async reconcileIfNeeded() {
    const last = Number((await this.local.getState('last_success_at')) ?? 0);
    const due = this.reconcileRequested || (last > 0 && this.host.now() - last > RECONCILE_AFTER_MS);
    if (!due) return;
    const remoteIds = new Set<string>();
    for (let after: string | null = null, pages = 0; pages < 200; pages++) {
      this.guard();
      const page = await this.remote.listIds(after, 1000);
      page.ids.forEach((id) => remoteIds.add(id));
      if (!page.next) break;
      after = page.next;
    }
    const synced = await this.local.syncedRunIds();
    const localIds = new Set(await this.local.localRunIds());
    const missing = synced.filter((id) => localIds.has(id) && !remoteIds.has(id));
    await this.local.park(missing);
    if (missing.length > 10 || (synced.length > 0 && missing.length > 0.2 * synced.length)) {
      await this.local.setState('pending_reconcile', JSON.stringify(missing));
      this.emit({ deletedElsewhere: missing });
    } else if (missing.length) {
      await this.local.deleteLocal(missing);
      await this.host.historyChanged();
    }
    await this.local.setState('last_full_reconcile_at', String(this.host.now()));
    this.reconcileRequested = false;
  }

  // ------------------------------------------------------------------ Envoi
  private toItem(run: LocalRunForPush): PushItem {
    const payload = { ...run.payload };
    delete payload.points;
    delete payload.cloudRoute;
    const efforts = payload.bestEfforts;
    return {
      id: run.id,
      source: run.id.startsWith('healthkit:') ? 'healthkit' : payload.importedFrom === 'gpx' ? 'gpx' : 'sprinter',
      client_updated_at: new Date(run.updatedAt).toISOString(),
      platform: this.host.platform(),
      app_version: this.host.appVersion(),
      tz: typeof payload.tz === 'string' ? payload.tz : null,
      has_route: false,
      // `cloudRoute` est un repère local : il ne part jamais dans le payload.
      best_efforts: efforts && typeof efforts === 'object' ? efforts as Record<string, number> : null,
      payload,
    };
  }
  /** Renvoie vrai si des éléments ont été refusés (statut « partiel »). */
  private async pushRuns(): Promise<boolean> {
    let rejected = false, historyChanged = false;
    for (let batch = 0; batch < MAX_BATCHES_PER_PASS; batch++) {
      this.guard();
      const entries = await this.local.dueOutbox(this.host.now(), PUSH_BATCH, 'run');
      if (!entries.length) break;
      const deletes = entries.filter((entry) => entry.op === 'delete');
      const upserts = entries.filter((entry) => entry.op === 'upsert');
      try {
        if (deletes.length) {
          this.guard();
          const results = await this.remote.deleteRuns(deletes.map((entry) => entry.entityId));
          this.guard();
          for (const entry of deletes) {
            const result = results.find((item) => item.id === entry.entityId);
            if (result && result.status !== 'rejected') await this.local.complete(entry, { deleted: true });
            else { rejected = true; await this.local.fail(entry, 'rejected', this.host.now(), true); }
          }
        }
        if (upserts.length) {
          const runs = await this.local.runsForPush(upserts.map((entry) => entry.entityId));
          const byId = new Map(runs.map((run) => [run.id, run]));
          for (const entry of upserts) if (!byId.has(entry.entityId)) await this.local.complete(entry, {});
          const items = upserts.filter((entry) => byId.has(entry.entityId)).map((entry) => this.toItem(byId.get(entry.entityId)!));
          if (items.length) {
            this.guard();
            const results = await this.remote.pushRuns(items);
            this.guard();
            for (const entry of upserts.filter((item) => byId.has(item.entityId))) {
              const result = results.find((item) => item.id === entry.entityId);
              if (!result) { await this.local.fail(entry, 'missing_result', this.host.now() + backoffMs(entry.attempts), false); continue; }
              if (result.status === 'applied' || result.status === 'ignored_stale') {
                await this.local.complete(entry, { serverUpdatedAt: result.server_updated_at, validity: result.validity, reasons: result.validity_reasons });
              } else if (result.status === 'ignored_deleted') {
                // La suppression l'emporte : la course disparaît aussi de cet appareil.
                await this.local.complete(entry, { deleted: true });
                await this.local.deleteLocal([entry.entityId]);
                historyChanged = true;
              } else if (result.reason === 'backup_disabled') {
                await this.local.setState('backup_runs', 'off');
                this.emit({ backup: 'off' });
                return rejected;
              } else {
                rejected = true;
                await this.local.fail(entry, result.reason ?? 'rejected', this.host.now(), true);
              }
            }
          }
        }
      } catch (error) {
        if (error instanceof SyncError && (error.kind === 'server' || error.kind === 'client')) {
          for (const entry of entries) await this.local.fail(entry, error.code ?? error.kind, this.host.now() + backoffMs(entry.attempts), error.kind === 'client');
        }
        throw error;
      }
      const counts = await this.local.counts();
      this.emit(counts);
      await this.host.yieldToUi();
    }
    if (historyChanged) await this.host.historyChanged();
    return rejected;
  }

  // ------------------------------------------------------------------ Réception
  private async pull() {
    const storedTs = await this.local.getState('pull_cursor_ts');
    const storedId = (await this.local.getState('pull_cursor_id')) ?? '';
    let cursor: Cursor = storedTs
      ? { ts: new Date(Date.parse(storedTs) - PULL_OVERLAP_MS).toISOString(), id: '' }
      : { ts: null, id: null };
    let best: Cursor = { ts: storedTs, id: storedId };
    let changed = 0;
    for (let page = 0; page < MAX_PULL_PAGES; page++) {
      this.guard();
      const result = await this.remote.pull(cursor, 200);
      this.guard();
      const last = result.items.at(-1);
      const end: Cursor | null = result.next_cursor ?? (last ? { ts: last.server_updated_at, id: last.id } : null);
      if (end && compareCursor(end, best) > 0) best = end;
      changed += (await this.local.applyPage(result.items, best.ts ? best : null)).changed;
      if (!result.next_cursor) break;
      cursor = result.next_cursor;
      await this.host.yieldToUi();
    }
    if (changed) await this.host.historyChanged();
  }
}

function pick(data: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const key of PORTABLE_KEYS) if (key in data) out[key] = data[key];
  return out;
}

export function compareCursor(a: Cursor, b: Cursor): number {
  if (!b.ts) return a.ts ? 1 : 0;
  if (!a.ts) return -1;
  const time = Date.parse(a.ts) - Date.parse(b.ts);
  if (time) return Math.sign(time);
  return (a.id ?? '') < (b.id ?? '') ? -1 : (a.id ?? '') > (b.id ?? '') ? 1 : 0;
}
