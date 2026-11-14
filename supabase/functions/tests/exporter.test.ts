import assert from 'node:assert/strict';
import { gzipSync, unzipSync, strFromU8, strToU8 } from 'fflate';
import { buildExport, EXPORT_TABLES, safeName } from '../_shared/exporter.ts';

Deno.test('export : toutes les données du titulaire, rien d’autre', async () => {
  const tables: Record<string, Record<string, unknown>[]> = {
    profiles: [{ display_name: 'Coureur synthétique' }],
    user_preferences: [{ data: { audioEnabled: true } }],
    consent_log: [{ purpose: 'terms', granted: true }],
    user_devices: [{ platform: 'ios' }],
    activity_days: [{ day: '2026-11-10', runs_count: 1 }],
    support_requests: [{ category: 'bug', message: 'Message synthétique' }],
    runs: [
      { id: '1800000000000-abc', distance_m: 5000, deleted_at: null },
      { id: 'healthkit:0f1e2d3c-4b5a-4968-8776-655443322110', distance_m: 3000, deleted_at: null },
      { id: 'supprimee', distance_m: 1, deleted_at: '2026-11-01T00:00:00Z' },
    ],
    run_routes: [{ run_id: '1800000000000-abc', points_count: 10, bytes: 100 }],
    profile_elements: [{ element_key: 'about', payload: { bio: 'Bio synthétique' }, deleted: false, revision: 2 }],
    profile_media: [
      { id: 'm1', usage: 'avatar', mime: 'image/jpeg', status: 'ready', storage_path: 'u1/m1.jpg' },
      { id: 'm2', usage: 'banner', mime: 'image/jpeg', status: 'deleted', storage_path: 'u1/m2.jpg' },
    ],
  };
  const selected: string[] = [];
  const zip = await buildExport({
    async select(table, columns) {
      selected.push(table);
      assert.ok(!columns.includes('internal_note'), 'jamais la note interne du support');
      return tables[table] ?? [];
    },
    async listTracks() { return ['u1/MTgwMDAwMDAwMDAwMC1hYmM.json.gz']; },
    async downloadTrack() { return gzipSync(strToU8('[]')); },
    async downloadProfileMedia(path) { return path === 'u1/m1.jpg' ? new Uint8Array([0xff, 0xd8, 0xff]) : null; },
    now: () => new Date('2026-11-14T10:00:00Z'),
  });
  const files = unzipSync(zip);
  for (const { file } of EXPORT_TABLES) assert.ok(files[file], `${file} présent`);
  assert.ok(files['runs/1800000000000-abc.json']);
  assert.ok(files['runs/healthkit_0f1e2d3c-4b5a-4968-8776-655443322110.json'], 'identifiant Santé rendu sûr');
  assert.ok(!Object.keys(files).some((name) => name.includes('supprimee')), 'les tombstones ne sont pas exportées');
  assert.ok(files['routes/MTgwMDAwMDAwMDAwMC1hYmM.json.gz']);
  assert.equal(JSON.parse(strFromU8(files['profile.json']!))[0].display_name, 'Coureur synthétique');
  assert.match(strFromU8(files['LISEZMOI.txt']!), /GPX/);
  assert.equal(JSON.parse(strFromU8(files['profile-page.json']!))[0].payload.bio, 'Bio synthétique', 'profil personnalisé exporté');
  const media = JSON.parse(strFromU8(files['profile-media.json']!));
  assert.deepEqual(media.map((item: { id: string }) => item.id), ['m1'], 'seuls les médias en service sont listés');
  assert.ok(!('storage_path' in media[0]), 'aucun chemin interne de stockage');
  assert.ok(files['profile-media/m1.jpg'] && !files['profile-media/m2.jpg'], 'images du profil incluses, fichiers purgés absents');
  assert.match(strFromU8(files['LISEZMOI.txt']!), /brouillons du profil/);
  assert.deepEqual(selected.sort(), [...EXPORT_TABLES.map((t) => t.table), 'runs', 'run_routes', 'profile_elements', 'profile_media'].sort());
  assert.ok(files['profile-sharing.json'] && files['profile-published.json'] && files['profile-notices.json'], 'choix de partage exportés');
});

Deno.test('noms de fichiers uniques et sûrs', () => {
  const used = new Set<string>();
  assert.equal(safeName('a/b', used), 'a_b');
  assert.equal(safeName('a:b', used), 'a_b-2');
  assert.equal(safeName('', used), 'course');
});
