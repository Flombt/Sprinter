// Local-first moderation workflow. A different API is only used when DISCOVERY_API_URL is set.
import { datasetPage, readApidae } from '../_shared/discovery-apidae.ts';
import { discoveryId, type DiscoveryItem, readDiscoveryItem } from '../_shared/discovery-model.ts';

const bundled = new URL('../../../src/discovery/catalogue.json', import.meta.url);
const [command, ...args] = Deno.args;
const market = 'nice';
const states = ['draft', 'pending_review', 'published', 'stale', 'cancelled', 'postponed', 'archived', 'rejected'];
const getEnv = (name: string) => {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`Variable requise : ${name}`);
  return value;
};

function apiUrl() {
  const url = new URL(Deno.env.get('DISCOVERY_API_URL') ?? 'http://127.0.0.1:54321');
  if (
    url.username || url.password || url.search || url.hash || url.pathname !== '/' ||
    (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(url.hostname)))
  ) {
    throw new Error('URL du projet Discovery invalide.');
  }
  return url.origin;
}

async function loadAuthoring(file: string | URL): Promise<DiscoveryItem[]> {
  const raw = JSON.parse(await Deno.readTextFile(file)) as unknown;
  const items = (Array.isArray(raw) ? raw : [raw]).map(readDiscoveryItem);
  const valid = items.filter((item): item is DiscoveryItem => !!item && item.market === market);
  if (!valid.length || valid.length !== items.length || new Set(valid.map((item) => item.id)).size !== valid.length) {
    throw new Error('Fiche(s) invalide(s) ou identifiants dupliqués.');
  }
  return valid;
}

function preview(items: DiscoveryItem[]) {
  console.table(
    items.map((row) => ({
      id: row.id,
      type: row.kind,
      titre: row.title,
      commune: row.city,
      jour: row.schedule?.day ?? row.dateNote ?? '',
      source: row.sources[0]?.url,
      revue: row.sources[0]?.checkedOn,
    })),
  );
}

async function rpc(name: string, payload: object, service = false) {
  const key = getEnv(service ? 'SUPABASE_SERVICE_ROLE_KEY' : 'SUPABASE_ANON_KEY');
  const token = service ? key : getEnv('DISCOVERY_EDITOR_JWT');
  const response = await fetch(`${apiUrl()}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    redirect: 'error',
    signal: AbortSignal.timeout(15000),
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const code = (await response.json().catch(() => ({})) as { code?: string }).code;
    throw new Error(`RPC refusée (${response.status}${code ? `, ${code}` : ''}).`);
  }
  return response.status === 204 ? null : await response.json();
}

switch (command) {
  case 'preview':
    preview(await loadAuthoring(args[0] ?? bundled));
    break;
  case 'probe': {
    const result = await readApidae(null);
    console.log(
      JSON.stringify(
        { source: datasetPage, url: result.checkpoint.url, modified: result.checkpoint.modified, ...result.metrics },
        null,
        2,
      ),
    );
    break;
  }
  case 'seed': {
    const items = await loadAuthoring(bundled);
    const count = await rpc('service_discovery_seed_v1', {
      p_market: market,
      p_items: items,
      p_reason: 'Installation du catalogue éditorial initial',
    }, true);
    console.log(`${count} fiches vérifiées pour ${apiUrl()}.`);
    break;
  }
  case 'trigger': {
    const response = await fetch(`${apiUrl()}/functions/v1/discovery-import`, {
      method: 'POST',
      headers: { 'x-cron-secret': getEnv('CRON_SECRET') },
      redirect: 'error',
      signal: AbortSignal.timeout(90000),
    });
    if (!response.ok) throw new Error(`L’import a répondu ${response.status}. Consulte le journal.`);
    console.log(await response.json());
    break;
  }
  case 'queue':
    console.log(
      JSON.stringify(
        await rpc('admin_discovery_queue_v1', { p_market: market, p_item_id: args[0] || null, p_after: args[1] || '' }),
        null,
        2,
      ),
    );
    break;
  case 'write': {
    const [file, state, revision, reason] = args;
    if (!file || !state || !states.includes(state) || !revision || !/^\d+$/.test(revision) || !reason) {
      throw new Error('write FICHIER ÉTAT RÉVISION MOTIF');
    }
    const [item, extra] = await loadAuthoring(file);
    if (!item || extra) throw new Error('L’édition attend exactement une fiche par fichier.');
    const updated = await rpc('admin_discovery_write_v1', {
      p_market: market,
      p_id: item.id,
      p_item: item,
      p_state: state,
      p_expected: Number(revision),
      p_reason: reason,
    });
    console.log(`Fiche ${item.id}, révision ${updated}, état ${state}.`);
    break;
  }
  case 'review': {
    const [externalId, decision, expected, itemId, reason] = args;
    if (
      !externalId || !expected || !reason || !['accepted', 'rejected'].includes(decision ?? '') ||
      (decision === 'accepted' && !discoveryId(itemId))
    ) throw new Error('review ID_EXTERNE accepted|rejected UPDATED_AT FICHE_OU_TIRET MOTIF');
    await rpc('admin_discovery_review_v1', {
      p_source: 'apidae-nice',
      p_external_id: externalId,
      p_decision: decision,
      p_expected: expected,
      p_item_id: decision === 'accepted' ? itemId : null,
      p_reason: reason,
    });
    console.log(`Revue de ${externalId} enregistrée.`);
    break;
  }
  default:
    throw new Error('Commandes : preview, probe, seed, trigger, queue, write, review.');
}
