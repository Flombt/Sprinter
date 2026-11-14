// Export « Mes données » (§6.6). Toutes les lectures passent par le client de l'utilisateur
// (son JWT, donc RLS) : l'archive ne peut contenir aucune donnée d'un autre compte.
import { strToU8, zipSync, type Zippable } from 'fflate';

export interface ExportDeps {
  select(table: string, columns: string): Promise<Record<string, unknown>[]>;
  listTracks(): Promise<string[]>;
  downloadTrack(path: string): Promise<Uint8Array>;
  /** Médias du profil personnalisé (bucket privé profile-media), lus avec le jeton du titulaire. */
  downloadProfileMedia?(path: string): Promise<Uint8Array | null>;
  /** Contenus supplémentaires. */
  extras?(): Promise<Record<string, unknown>>;
  now(): Date;
}

export const EXPORT_TABLES: { file: string; table: string; columns: string }[] = [
  { file: 'profile.json', table: 'profiles', columns: 'display_name,country_code,city,age_band,created_at,updated_at' },
  { file: 'preferences.json', table: 'user_preferences', columns: 'data,schema_version,client_updated_at,updated_at' },
  { file: 'consents.json', table: 'consent_log', columns: 'purpose,version,granted,client_at,created_at' },
  { file: 'devices.json', table: 'user_devices', columns: 'device_id,platform,os_version,app_version,last_seen_at,last_sync_at,last_sync_status,created_at' },
  { file: 'activity.json', table: 'activity_days', columns: 'day,runs_count' },
  { file: 'support.json', table: 'support_requests', columns: 'id,category,message,platform,app_version,status,created_at,updated_at,closed_at' },
  { file: 'profile-sharing.json', table: 'profile_sharing', columns: 'mode,searchable,handle,presence_audience,rules_version,rules_accepted_at,published_at,moderation,updated_at' },
  { file: 'profile-published.json', table: 'profile_published', columns: 'element_key,payload,published_at,moderation' },
  { file: 'profile-notices.json', table: 'profile_notices', columns: 'kind,element_key,reason,created_at,read_at' },
];

const README = `Export de vos données Sprinter
================================

Ce dossier contient toutes les données associées à votre compte et conservées en ligne :
- profile.json : profil de compte (nom affiché, pays, ville, tranche d'âge)
- preferences.json : réglages synchronisés
- consents.json : historique de vos choix et acceptations
- devices.json : appareils connectés à votre compte
- activity.json : jours d'utilisation (mesure d'usage minimale)
- support.json : vos demandes au support
- runs/ : une fiche par course sauvegardée (sans les points GPS)
- routes/ : vos parcours GPS sauvegardés en ligne, compressés (gzip, JSON)
- profile-page.json : votre profil personnalisé (apparence, avatar, bannière, présentation,
  statut, widgets et disposition) dans sa version enregistrée en ligne
- profile-media.json et profile-media/ : les images de ce profil
- profile-sharing.json, profile-published.json, profile-notices.json : vos choix de partage,
  la version visible de votre profil et les décisions de modération qui vous ont été notifiées
- profile-blocks.json : les profils que vous avez bloqués (pseudo au moment du blocage)

Les brouillons du profil qui n'ont pas été enregistrés restent uniquement sur l'appareil
où vous les avez créés : ils ne figurent pas dans cet export.

Pour un parcours au format GPX ou des statistiques au format CSV, utilisez l'export
disponible dans le détail de chaque course, dans l'application.
`;

/** Nom de fichier sûr et unique pour un identifiant de course (ex. healthkit:<uuid>). */
export function safeName(id: string, used: Set<string>): string {
  const base = id.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 80) || 'course';
  let name = base, index = 2;
  while (used.has(name)) name = `${base}-${index++}`;
  used.add(name);
  return name;
}

export async function buildExport(deps: ExportDeps): Promise<Uint8Array> {
  const files: Zippable = { 'LISEZMOI.txt': strToU8(README) };
  const pretty = (value: unknown) => strToU8(JSON.stringify(value, null, 2));
  for (const { file, table, columns } of EXPORT_TABLES) files[file] = pretty(await deps.select(table, columns));

  const runs = await deps.select('runs', 'id,source,started_at,ended_at,tz,active_s,total_s,distance_m,reliable_s,best_pace_s_km,ascent_m,session_type,platform,app_version,best_efforts,payload,has_route,validity,validity_reasons,client_updated_at,server_updated_at,deleted_at');
  const used = new Set<string>();
  const runFiles: Zippable = {};
  for (const run of runs) {
    if (run.deleted_at) continue;
    runFiles[`${safeName(String(run.id), used)}.json`] = pretty(run);
  }
  files['runs'] = runFiles;
  files['routes.json'] = pretty(await deps.select('run_routes', 'run_id,points_count,bytes,created_at'));

  const routeFiles: Zippable = {};
  for (const path of await deps.listTracks()) {
    const name = path.split('/').pop() ?? path;
    // Déjà compressés : stockés sans recompression.
    routeFiles[name] = [await deps.downloadTrack(path), { level: 0 }];
  }
  files['routes'] = routeFiles;

  files['profile-page.json'] = pretty(await deps.select('profile_elements', 'element_key,payload,deleted,revision,visibility,client_updated_at,server_updated_at'));
  const media = await deps.select('profile_media', 'id,usage,mime,bytes,width,height,animated,duration_ms,status,storage_path,created_at,ready_at');
  files['profile-media.json'] = pretty(media.filter((item) => item.status === 'ready').map(({ storage_path: _path, ...item }) => item));
  const mediaFiles: Zippable = {};
  if (deps.downloadProfileMedia) {
    for (const item of media) {
      if (item.status !== 'ready' || typeof item.storage_path !== 'string') continue;
      const content = await deps.downloadProfileMedia(item.storage_path);
      if (content) mediaFiles[item.storage_path.split('/').pop() ?? String(item.id)] = [content, { level: 0 }];
    }
  }
  files['profile-media'] = mediaFiles;
  if (deps.extras) for (const [name, value] of Object.entries(await deps.extras())) files[name] = pretty(value);
  files['export.json'] = pretty({ generated_at: deps.now().toISOString(), format: 'sprinter-export-v1' });
  return zipSync(files, { level: 6 });
}
