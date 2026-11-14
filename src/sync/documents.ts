import type { SyncLocalStore } from './localStore';
import { settingsHash } from './settings';

/**
 * Entités secondaires (§7.9, phase 2b) : séances, itinéraires, chaussures, plans. Chaque
 * document se compare par empreinte à sa dernière version synchronisée ; dernier écrit
 * gagne par document, la suppression l'emporte. Les itinéraires suivent la sauvegarde des parcours.
 */
export type DocumentKind = 'workout' | 'route' | 'shoe' | 'plan';
export interface LocalDocument { id: string; payload: Record<string, unknown>; updatedAt?: number }
export interface DocumentAdapter {
  kind: DocumentKind;
  requiresRoutes?: boolean;
  list(): Promise<LocalDocument[]>;
  /** Applique une version reçue ; null = supprimée ailleurs. */
  apply(id: string, payload: Record<string, unknown> | null, updatedAt?: number): Promise<void>;
  /** Partie comparée (ex. sans `updatedAt`, réécrit à chaque enregistrement local). */
  fingerprint?(payload: Record<string, unknown>): unknown;
}
export interface RemoteDocument { kind: DocumentKind; id: string; deleted: boolean; client_updated_at: string; server_updated_at: string; payload: Record<string, unknown> | null }
export interface DocumentRemote {
  push(docs: { kind: DocumentKind; id: string; client_updated_at: string; payload?: Record<string, unknown>; deleted?: boolean }[]):
    Promise<{ kind: DocumentKind; id: string; status: 'applied' | 'ignored_stale' | 'ignored_deleted' | 'rejected'; reason?: string }[]>;
  pull(cursor: { ts: string | null; kind: string | null; id: string | null }, limit: number): Promise<{ items: RemoteDocument[]; next_cursor: { ts: string; kind: string; id: string } | null }>;
}
interface Known { hash: string; at: number; deleted?: boolean }
const key = (kind: string, id: string) => `doc:${kind}:${id}`;

export class DocumentSync {
  constructor(private local: SyncLocalStore, private remote: DocumentRemote, private adapters: DocumentAdapter[], private now: () => number) {}
  private hash(adapter: DocumentAdapter, payload: Record<string, unknown>) { return settingsHash(adapter.fingerprint ? adapter.fingerprint(payload) : payload); }
  private async known(kind: string, id: string): Promise<Known | null> {
    const raw = await this.local.getState(key(kind, id));
    return raw ? JSON.parse(raw) as Known : null;
  }
  private remember(kind: string, id: string, value: Known) { return this.local.setState(key(kind, id), JSON.stringify(value)); }

  async run(routesOn: boolean, guard: () => void = () => {}) {
    const active = this.adapters.filter((adapter) => !adapter.requiresRoutes || routesOn);
    const byKind = new Map(active.map((adapter) => [adapter.kind, adapter]));
    const locals = new Map<string, Map<string, LocalDocument>>();
    for (const adapter of active) locals.set(adapter.kind, new Map((await adapter.list()).map((doc) => [doc.id, doc])));

    // 1. Réception d'abord : une copie locale inchangée ne doit pas écraser une modification faite ailleurs.
    // Le curseur avancé sans les parcours ne doit pas servir quand ils redeviennent visibles.
    const cursorKey = routesOn ? 'doc_cursor_with_routes' : 'doc_cursor';
    let cursor = JSON.parse((await this.local.getState(cursorKey)) ?? '{"ts":null,"kind":null,"id":null}') as { ts: string | null; kind: string | null; id: string | null };
    for (let page = 0; page < 50; page++) {
      guard();
      const result = await this.remote.pull(cursor, 200);
      for (const item of result.items) {
        const adapter = byKind.get(item.kind);
        if (!adapter) continue;
        const known = await this.known(item.kind, item.id);
        guard();
        const localDoc = locals.get(item.kind)?.get(item.id);
        const localChanged = localDoc && known && !known.deleted && this.hash(adapter, localDoc.payload) !== known.hash;
        if (item.deleted) {
          if (localDoc) {
            await adapter.apply(item.id, null);
            locals.get(item.kind)!.delete(item.id);
          }
          await this.remember(item.kind, item.id, { hash: '', at: Date.parse(item.client_updated_at), deleted: true });
          continue;
        }
        const updatedAt = Date.parse(item.client_updated_at);
        if (known && (known.deleted || known.at > updatedAt)) continue;
        const remoteHash = this.hash(adapter, item.payload ?? {});
        if (known?.hash === remoteHash && known.at === updatedAt) continue;
        if (localChanged && (localDoc.updatedAt ?? 0) > updatedAt) continue;
        try {
          if (!localDoc || this.hash(adapter, localDoc.payload) !== remoteHash) await adapter.apply(item.id, item.payload, updatedAt);
          locals.get(item.kind)!.set(item.id, { id: item.id, payload: item.payload ?? {}, updatedAt });
          await this.remember(item.kind, item.id, { hash: remoteHash, at: updatedAt });
        } catch { /* Un document reçu incompatible ne bloque pas les autres sauvegardes. */ }
      }
      const last = result.items.at(-1);
      if (last) cursor = { ts: last.server_updated_at, kind: last.kind, id: last.id };
      await this.local.setState(cursorKey, JSON.stringify(cursor));
      if (!result.next_cursor) break;
    }

    // 2. Envoi des créations, modifications et suppressions locales.
    const outgoing: Parameters<DocumentRemote['push']>[0] = [];
    const hashes = new Map<string, string>();
    for (const adapter of active) {
      const docs = locals.get(adapter.kind)!;
      for (const doc of docs.values()) {
        const hash = this.hash(adapter, doc.payload), known = await this.known(adapter.kind, doc.id);
        if (known?.hash === hash) continue;
        hashes.set(key(adapter.kind, doc.id), hash);
        outgoing.push({ kind: adapter.kind, id: doc.id, client_updated_at: new Date(doc.updatedAt ?? this.now()).toISOString(), payload: doc.payload });
      }
      for (const [stateKey, raw] of await this.local.statesWithPrefix(`doc:${adapter.kind}:`)) {
        const id = stateKey.slice(`doc:${adapter.kind}:`.length), known = JSON.parse(raw) as Known;
        if (!known.deleted && !docs.has(id)) outgoing.push({ kind: adapter.kind, id, client_updated_at: new Date(this.now()).toISOString(), deleted: true });
      }
    }
    for (let index = 0; index < outgoing.length; index += 100) {
      const batch = outgoing.slice(index, index + 100);
      guard();
      const results = await this.remote.push(batch);
      guard();
      for (const sent of batch) {
        const result = results.find((item) => item.kind === sent.kind && item.id === sent.id);
        if (!result || result.status === 'rejected') { if (result?.reason === 'backup_disabled') return; continue; }
        if (result.status === 'ignored_deleted') {
          await byKind.get(sent.kind)?.apply(sent.id, null);
          await this.remember(sent.kind, sent.id, { hash: '', at: this.now(), deleted: true });
        } else if (sent.deleted) {
          await this.remember(sent.kind, sent.id, { hash: '', at: this.now(), deleted: true });
        } else if (result.status === 'applied') {
          await this.remember(sent.kind, sent.id, { hash: hashes.get(key(sent.kind, sent.id))!, at: Date.parse(sent.client_updated_at) });
        }
        // ignored_stale : une version plus récente existe en ligne ; elle arrivera à la prochaine réception.
      }
    }
  }
}
