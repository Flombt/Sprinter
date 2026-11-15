import {
  catalogVersion,
  discoveryId,
  maxCatalogItems,
  readDiscoveryItem,
  type DiscoveryItem,
} from '../../supabase/functions/_shared/discovery-model';
import type { BackendConfig } from '../account/env';

type Entry = { id: string; item: DiscoveryItem | null };
export interface DiscoveryFeed {
  version: 1;
  loadedAt: number;
  entries: Entry[];
}
interface Page {
  version: 1;
  revision: number;
  entries: Entry[];
  nextCursor: string | null;
}
export const feedTtl = 30 * 60_000;

function readEntries(list: unknown, market: string, limit: number): Entry[] {
  if (!Array.isArray(list) || list.length > limit) throw new Error('Catalogue invalide.');
  let last = '';
  return list.map((value) => {
    const entry = value as Partial<Entry> | null;
    if (!entry || !discoveryId(entry.id) || entry.id <= last)
      throw new Error('Identifiant de fiche invalide ou dupliqué.');
    last = entry.id;
    const item = entry.item === null ? null : readDiscoveryItem(entry.item);
    if (entry.item !== null && (!item || item.id !== entry.id || item.market !== market))
      throw new Error('Fiche distante invalide.');
    return { id: entry.id, item };
  });
}

export function parseCachedFeed(raw: string, market: string, now: number): DiscoveryFeed {
  if (raw.length > 8_000_000) throw new Error('Cache trop volumineux.');
  const data = JSON.parse(raw) as Partial<DiscoveryFeed> | null;
  if (
    !data ||
    data.version !== catalogVersion ||
    typeof data.loadedAt !== 'number' ||
    !Number.isFinite(data.loadedAt) ||
    data.loadedAt < 0 ||
    data.loadedAt > now + feedTtl
  )
    throw new Error('Cache catalogue illisible.');
  return {
    version: catalogVersion,
    loadedAt: Math.min(data.loadedAt, now),
    entries: readEntries(data.entries, market, maxCatalogItems),
  };
}

export async function fetchDiscoveryFeed(
  backend: BackendConfig,
  market: string,
  accessToken: string,
  signal: AbortSignal,
  request = fetch,
): Promise<DiscoveryFeed> {
  const entries: Entry[] = [];
  let revision: number | undefined;
  let cursor: string | null = null;
  let size = 0;
  for (let pageIndex = 0; pageIndex <= maxCatalogItems / 20; pageIndex++) {
    if (signal.aborted) throw new Error('Actualisation interrompue.');
    const query = new URLSearchParams({ p_market: market });
    if (cursor !== null) query.set('p_after', cursor);
    if (revision !== undefined) query.set('p_revision', String(revision));
    const response = await request(`${backend.url}/rest/v1/rpc/discovery_feed_v1?${query}`, {
      signal,
      redirect: 'error',
      headers: {
        apikey: backend.publishableKey,
        Accept: 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
    });
    if (!response.ok) throw new Error('Catalogue distant indisponible.');
    const body = await response.text();
    size += body.length;
    if (size > 8_000_000) throw new Error('Catalogue trop volumineux.');
    const page = JSON.parse(body) as Partial<Page> | null;
    if (
      !page ||
      page.version !== catalogVersion ||
      typeof page.revision !== 'number' ||
      !Number.isSafeInteger(page.revision) ||
      page.revision < 0 ||
      (revision !== undefined && page.revision !== revision)
    ) {
      throw new Error('Version du catalogue incohérente.');
    }
    const batch = readEntries(page.entries, market, 20);
    if (cursor && batch[0] && batch[0].id <= cursor) throw new Error('Page distante répétée.');
    entries.push(...batch);
    if (entries.length > maxCatalogItems) throw new Error('Catalogue trop volumineux.');
    if (page.nextCursor === null) return { version: catalogVersion, loadedAt: Date.now(), entries };
    if (batch.length !== 20 || !discoveryId(page.nextCursor) || page.nextCursor !== batch.at(-1)?.id) {
      throw new Error('Pagination du catalogue invalide.');
    }
    cursor = page.nextCursor;
    revision = page.revision;
  }
  throw new Error('Catalogue incomplet.');
}
