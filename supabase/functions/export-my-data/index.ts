// GET ou POST /functions/v1/export-my-data — archive ZIP des données en ligne du titulaire (§6.6).
// GET permet à l'app de télécharger l'archive directement dans un fichier.
// Les lectures utilisent le JWT de l'utilisateur : la RLS garantit qu'aucune donnée
// d'un autre compte ne peut entrer dans l'archive.
import { bearer, json, logEvent, SECURITY_HEADERS } from '../_shared/http.ts';
import { buildExport } from '../_shared/exporter.ts';
import { serverClient, userClient } from '../_shared/supabase.ts';

Deno.serve(async (request) => {
  if (request.method !== 'POST' && request.method !== 'GET') return json(405, { error: 'method_not_allowed' });
  const token = bearer(request);
  if (!token) return json(401, { error: 'unauthenticated' });
  try {
    const { data, error } = await serverClient().auth.getUser(token);
    if (error || !data.user) return json(401, { error: 'unauthenticated' });
    const userId = data.user.id;
    const client = userClient(token);
    // Compte inactif ou session révoquée : la RLS renverrait des listes vides ; on refuse explicitement.
    const { data: active, error: activeError } = await client.rpc('my_consents');
    if (activeError || active === null) return json(403, { error: 'forbidden' });
    const zip = await buildExport({
      async select(table, columns) {
        const rows: Record<string, unknown>[] = [];
        for (let from = 0; ; from += 1000) {
          const { data: page, error: selectError } = await client.from(table).select(columns).range(from, from + 999);
          if (selectError) throw new Error(`select_${table}`);
          rows.push(...(page as unknown as Record<string, unknown>[]));
          if (!page || page.length < 1000) return rows;
        }
      },
      async listTracks() {
        const { data: files, error: listError } = await client.storage.from('run-tracks').list(userId, { limit: 1000 });
        if (listError) return [];
        return (files ?? []).filter((file) => file.id !== null).map((file) => `${userId}/${file.name}`);
      },
      async downloadTrack(path) {
        const { data: blob, error: downloadError } = await client.storage.from('run-tracks').download(path);
        if (downloadError || !blob) throw new Error('download_track');
        return new Uint8Array(await blob.arrayBuffer());
      },
      async downloadProfileMedia(path) {
        const { data: blob, error: downloadError } = await client.storage.from('profile-media').download(path);
        return downloadError || !blob ? null : new Uint8Array(await blob.arrayBuffer());
      },
      now: () => new Date(),
    });
    const day = new Date().toISOString().slice(0, 10);
    return new Response(new Blob([zip as Uint8Array<ArrayBuffer>]), {
      status: 200,
      headers: { ...SECURITY_HEADERS, 'Content-Type': 'application/zip', 'Content-Disposition': `attachment; filename="sprinter-export-${day}.zip"` },
    });
  } catch (error) {
    logEvent('export.error', { message: error instanceof Error ? error.message : 'unknown' });
    return json(500, { error: 'internal' });
  }
});
