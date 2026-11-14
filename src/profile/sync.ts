// Synchronisation du profil personnalisé (§17.6) : local-first, propre état, indépendante de la
// sauvegarde des courses (un compte qui garde ses courses sur l'appareil peut synchroniser son profil).
// Ordre d'un passage : médias (réservation → dépôt → validation), éléments enregistrés, réception.
// Rien ne part pendant une course (§7.1) ; chaque étape reprend sans doublon après une interruption.
import { SyncError } from '../sync/types';
import { classify } from '../sync/remote';
import { payloadMedia, type Payload } from './model';
import type { LocalMedia, OutboxItem, ProfileLocalStore, RemoteElement, SaveResult } from './localStore';

export interface RemoteMedia { id: string; usage: LocalMedia['usage']; mime: string; bytes: number; width: number; height: number; path: string }
export interface ProfileRemote {
  save(items: OutboxItem[]): Promise<SaveResult[]>;
  pull(): Promise<{ elements: RemoteElement[]; media: RemoteMedia[] }>;
  mediaBegin(media: LocalMedia): Promise<{ path: string; status: string }>;
  upload(path: string, media: LocalMedia): Promise<void>;
  commit(id: string): Promise<{ status: 'ready' | 'missing' | 'rejected'; reason?: string }>;
  /** Télécharge un média du titulaire et renvoie son adresse locale. */
  download(owner: string, media: RemoteMedia): Promise<string>;
}
export interface ProfileHost {
  enabled(): boolean;
  userId(): string | null;
  runActive(): boolean;
  refreshAuth(): Promise<boolean>;
  now(): number;
  /** Prévient l'interface qu'un média a été refusé (texte en français, vouvoiement). */
  notify?(message: string): void;
}
export interface ProfileSyncStatus {
  phase: 'disabled' | 'idle' | 'running' | 'offline' | 'paused' | 'error';
  pending: number; drafts: number; review: number; lastSyncAt: number | null; message: string | null;
}

const MEDIA_MESSAGES: Record<string, string> = {
  location: 'Cette image contenait une position GPS : elle n’a pas été envoyée. L’image précédente reste en place.',
  too_large: 'Cette image dépasse la taille autorisée. L’image précédente reste en place.',
  format: 'Ce format d’image n’est pas accepté. L’image précédente reste en place.',
};

class Interrupted extends Error {}

export class ProfileSync {
  private value: ProfileSyncStatus = { phase: 'disabled', pending: 0, drafts: 0, review: 0, lastSyncAt: null, message: null };
  private listeners = new Set<() => void>();
  private inFlight: Promise<ProfileSyncStatus> | null = null;
  private notBefore = 0;
  constructor(private store: ProfileLocalStore, private remote: ProfileRemote, private host: ProfileHost) {}

  getSnapshot = () => this.value;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private emit(patch: Partial<ProfileSyncStatus>) {
    this.value = { ...this.value, ...patch };
    for (const listener of [...this.listeners]) { try { listener(); } catch { /* observateur facultatif */ } }
  }
  private guard() { if (this.host.runActive()) throw new Interrupted('run_active'); }

  async refreshCounts() {
    const owner = this.host.userId();
    if (!owner) { this.emit({ phase: 'disabled', pending: 0, drafts: 0, review: 0 }); return; }
    const counts = await this.store.counts(owner);
    const lastSync = await this.store.getMeta(owner, 'last_sync_at');
    this.emit({ ...counts, lastSyncAt: lastSync ? Number(lastSync) : null, phase: this.value.phase === 'disabled' && this.host.enabled() ? 'idle' : this.value.phase });
  }

  sync(trigger: string): Promise<ProfileSyncStatus> {
    if (!this.host.enabled() || !this.host.userId()) { this.emit({ phase: 'disabled' }); return Promise.resolve(this.value); }
    if (this.host.runActive()) return Promise.resolve(this.value);
    if (trigger !== 'manual' && trigger !== 'save' && this.host.now() < this.notBefore) return Promise.resolve(this.value);
    this.inFlight ??= this.pass(this.host.userId()!).finally(() => { this.inFlight = null; });
    return this.inFlight;
  }

  private async pass(owner: string): Promise<ProfileSyncStatus> {
    this.emit({ phase: 'running', message: null });
    let refreshed = false;
    const attempt = async <T>(step: () => Promise<T>): Promise<T> => {
      try { return await step(); }
      catch (error) {
        const failure = error instanceof SyncError ? error : error instanceof Interrupted ? error : classify({ message: error instanceof Error ? error.message : 'unknown' }, 0);
        if (failure instanceof SyncError && failure.kind === 'auth' && !refreshed) {
          refreshed = true;
          if (await this.host.refreshAuth()) return step();
        }
        throw failure;
      }
    };
    try {
      this.guard();
      await attempt(() => this.uploadMedia(owner));
      this.guard();
      await attempt(() => this.push(owner));
      this.guard();
      await attempt(() => this.pull(owner));
      await this.store.setMeta(owner, 'last_sync_at', String(this.host.now()));
      this.notBefore = 0;
      await this.refreshCounts();
      this.emit({ phase: 'idle' });
    } catch (error) {
      await this.refreshCounts().catch(() => undefined);
      if (error instanceof Interrupted) { this.emit({ phase: 'idle' }); return this.value; }
      const failure = error as SyncError;
      if (failure.kind === 'network') this.emit({ phase: 'offline', message: 'Hors connexion : vos changements sont gardés sur cet appareil.' });
      else if (failure.kind === 'rate') {
        this.notBefore = this.host.now() + (failure.retryAfterMs ?? 60_000);
        this.emit({ phase: 'paused', message: failure.code === 'feature_disabled' ? 'Synchronisation du profil momentanément suspendue.' : 'Nouvel essai dans quelques minutes.' });
      } else this.emit({ phase: 'error', message: 'La synchronisation du profil n’a pas abouti. Elle reprendra automatiquement.' });
    }
    return this.value;
  }

  /** Médias encore locaux et utilisés par un envoi en attente : réservation, dépôt, validation. */
  private async uploadMedia(owner: string) {
    const outbox = await this.store.outbox(owner, 1000);
    const needed = new Set(outbox.flatMap((item) => payloadMedia(item.payload)));
    for (const media of await this.store.media(owner)) {
      if (!needed.has(media.id) || media.state === 'ready' || media.state === 'remote' || media.state === 'rejected') continue;
      this.guard();
      const reservation = await this.remote.mediaBegin(media);
      if (reservation.status !== 'ready' && media.state !== 'uploaded') {
        await this.remote.upload(reservation.path, media);
        await this.store.updateMedia(owner, media.id, { state: 'uploaded', path: reservation.path });
      }
      this.guard();
      const result = reservation.status === 'ready' ? { status: 'ready' as const } : await this.remote.commit(media.id);
      if (result.status === 'ready') await this.store.updateMedia(owner, media.id, { state: 'ready', path: reservation.path });
      else if (result.status === 'missing') await this.store.updateMedia(owner, media.id, { state: 'local' });
      else {
        await this.store.updateMedia(owner, media.id, { state: 'rejected' });
        // Les changements qui utilisaient ce média reviennent en brouillon à revoir ; l'ancien visuel reste.
        for (const item of outbox.filter((entry) => payloadMedia(entry.payload).includes(media.id))) {
          await this.store.applyResult(owner, item.opId, { key: item.key, status: 'rejected', reason: `media_${result.reason ?? 'format'}` }, this.host.now());
        }
        this.host.notify?.(MEDIA_MESSAGES[result.reason ?? 'format'] ?? MEDIA_MESSAGES.format!);
      }
    }
  }

  private async push(owner: string) {
    for (let round = 0; round < 5; round++) {
      const media = new Map((await this.store.media(owner)).map((item) => [item.id, item.state]));
      const items = (await this.store.outbox(owner)).filter((item) => payloadMedia(item.payload).every((id) => media.get(id) === 'ready' || media.get(id) === 'remote' || !media.has(id)));
      if (!items.length) return;
      let results: SaveResult[];
      try { results = await this.remote.save(items); }
      catch (error) {
        await this.store.markAttempt(owner, items.map((item) => item.key), error instanceof Error ? error.message.slice(0, 80) : 'error');
        throw error;
      }
      const byKey = new Map(items.map((item) => [item.key, item]));
      let progressed = false;
      for (const result of results) {
        const item = byKey.get(result.key);
        if (!item) continue;
        await this.store.applyResult(owner, item.opId, result, this.host.now());
        if (result.status !== 'deferred') progressed = true;
      }
      if (!progressed || items.length < 40) return;
      this.guard();
    }
  }

  private async pull(owner: string) {
    const remote = await this.remote.pull();
    await this.store.applyRemote(owner, remote.elements, this.host.now());
    // Médias de la version enregistrée absents de cet appareil (second appareil du titulaire).
    const local = new Map((await this.store.media(owner)).map((item) => [item.id, item]));
    const referenced = new Set((await this.store.saved(owner)).flatMap((element) => payloadMedia(element.payload as Payload | null)));
    for (const media of remote.media) {
      if (!referenced.has(media.id)) continue;
      const known = local.get(media.id);
      if (known?.uri) continue;
      this.guard();
      const uri = await this.remote.download(owner, media);
      await this.store.addMedia(owner, { ...media, uri, state: 'remote', createdAt: this.host.now() });
    }
  }
}
