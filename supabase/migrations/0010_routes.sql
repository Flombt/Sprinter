-- 0010 — Tracés GPS dans le cloud (phase 3, §8) : bucket privé, policies par opération,
-- enregistrement des tracés, suppression des parcours en ligne, file de purge, recalcul de validité.
-- Le serveur ne lit jamais le contenu des tracés (fichiers opaques).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('run-tracks', 'run-tracks', false, 8388608, array['application/gzip'])
on conflict (id) do update set public = false, file_size_limit = 8388608, allowed_mime_types = array['application/gzip'];

-- Chemin attendu : <uid>/<base64url(run_id)>.json.gz
create or replace function authz.route_path_ok(p_name text) returns boolean
language sql stable security definer set search_path = '' as $$
  select (storage.foldername(p_name))[1] = (select auth.uid())::text
     and array_length(storage.foldername(p_name), 1) = 1
     and storage.filename(p_name) ~ '^[A-Za-z0-9_-]{1,140}\.json\.gz$'
$$;
-- L'envoi et le remplacement exigent les deux sauvegardes confirmées (§2 décision 22, §8).
create or replace function authz.route_upload_allowed() returns boolean
language sql stable security definer set search_path = '' as $$
  select authz.session_ok()
     and private.has_consent(auth.uid(), 'cloud_sync_runs')
     and private.has_consent(auth.uid(), 'cloud_sync_routes')
     and coalesce((select (value)::boolean from public.app_config where key = 'routes_sync_enabled'), false)
$$;
revoke all on function authz.route_path_ok(text), authz.route_upload_allowed() from public, anon;
grant execute on function authz.route_path_ok(text), authz.route_upload_allowed() to authenticated, service_role;

create policy run_tracks_select_own on storage.objects for select to authenticated
  using (bucket_id = 'run-tracks' and authz.session_ok() and authz.route_path_ok(name));
create policy run_tracks_insert_own on storage.objects for insert to authenticated
  with check (bucket_id = 'run-tracks' and authz.route_path_ok(name) and authz.route_upload_allowed());
create policy run_tracks_update_own on storage.objects for update to authenticated
  using (bucket_id = 'run-tracks' and authz.route_path_ok(name) and authz.route_upload_allowed())
  with check (bucket_id = 'run-tracks' and authz.route_path_ok(name) and authz.route_upload_allowed());
-- Le titulaire peut toujours supprimer ses fichiers, même sauvegarde des parcours en pause.
create policy run_tracks_delete_own on storage.objects for delete to authenticated
  using (bucket_id = 'run-tracks' and authz.session_ok() and authz.route_path_ok(name));

insert into public.app_config (key, value) values ('routes_sync_enabled', 'false'::jsonb) on conflict (key) do nothing;

-- ---------------------------------------------------------------------------------------
create or replace function public.sync_register_route(
  p_run_id text, p_path text, p_points_count int, p_bytes int, p_preview_polyline text default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := private.require_uid(); v_run record;
begin
  if not (private.has_consent(v_uid, 'cloud_sync_runs') and private.has_consent(v_uid, 'cloud_sync_routes')) then
    raise exception 'backup_disabled' using errcode = '42501';
  end if;
  if p_path is null or split_part(p_path, '/', 1) <> v_uid::text or p_path !~ '^[0-9a-f-]{36}/[A-Za-z0-9_-]{1,140}\.json\.gz$' then
    raise exception 'invalid_parameter:path' using errcode = '22023';
  end if;
  if p_points_count is null or p_points_count < 0 or p_bytes is null or p_bytes <= 0 or p_bytes > 8388608
     or (p_preview_polyline is not null and char_length(p_preview_polyline) > 20000) then
    raise exception 'invalid_parameter:size' using errcode = '22023';
  end if;
  select r.deleted_at into v_run from public.runs r where r.user_id = v_uid and r.id = p_run_id;
  if not found or v_run.deleted_at is not null then raise exception 'not_found' using errcode = 'P0002'; end if;
  -- L'objet doit exister dans le dossier du titulaire (déposé via l'API Storage, sous RLS).
  if not exists (select 1 from storage.objects o where o.bucket_id = 'run-tracks' and o.name = p_path) then
    raise exception 'object_missing' using errcode = 'P0002';
  end if;
  insert into public.run_routes (user_id, run_id, storage_path, points_count, bytes, preview_polyline)
  values (v_uid, p_run_id, p_path, p_points_count, p_bytes, p_preview_polyline)
  on conflict (user_id, run_id) do update
    set storage_path = excluded.storage_path, points_count = excluded.points_count, bytes = excluded.bytes,
        preview_polyline = excluded.preview_polyline, created_at = now();
  update public.runs set has_route = true where user_id = v_uid and id = p_run_id and not has_route;
  return jsonb_build_object('run_id', p_run_id, 'registered', true);
end $$;

-- « Supprimer mes parcours en ligne » (§8.5) : références et aperçus supprimés, fichiers mis en purge.
create or replace function public.sync_delete_routes(p_run_ids text[] default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := private.require_uid(); v_paths text[];
begin
  with removed as (
    delete from public.run_routes where user_id = v_uid and (p_run_ids is null or run_id = any (p_run_ids))
    returning run_id, storage_path)
  select array_agg(storage_path) into v_paths from removed;
  insert into private.storage_purge_queue (bucket, path)
  select 'run-tracks', unnest(coalesce(v_paths, '{}')) on conflict (bucket, path) do nothing;
  update public.runs set has_route = false
   where user_id = v_uid and has_route and (p_run_ids is null or id = any (p_run_ids));
  return jsonb_build_object('deleted', coalesce(array_length(v_paths, 1), 0), 'paths', to_jsonb(coalesce(v_paths, '{}')));
end $$;

-- Purge (Edge Function purge-storage) : file d'attente + fichiers orphelins de plus d'un jour.
create or replace function public.service_storage_purge_batch(p_limit int default 200)
returns table (queue_id bigint, bucket text, path text) language sql stable security definer set search_path = '' as $$
  (select q.id, q.bucket, q.path from private.storage_purge_queue q order by q.id limit p_limit)
  union all
  (select null::bigint, o.bucket_id, o.name from storage.objects o
    where o.bucket_id = 'run-tracks' and o.created_at < now() - interval '1 day'
      and not exists (select 1 from public.run_routes r where r.storage_path = o.name)
      and not exists (select 1 from private.storage_purge_queue q where q.bucket = o.bucket_id and q.path = o.name)
    limit p_limit);
$$;
create or replace function public.service_storage_purged(p_queue_ids bigint[]) returns void
language sql security definer set search_path = '' as $$
  delete from private.storage_purge_queue where id = any (p_queue_ids);
$$;

-- Recalcul des règles versionnées (§9.1) : à lancer après un changement de rules_version.
create or replace function private.recompute_validity(p_batch int default 5000) returns int
language plpgsql security definer set search_path = '' as $$
declare v_count int;
begin
  -- Le trigger runs_before_write recalcule validité, raisons et meilleurs efforts.
  update public.runs set rules_version = rules_version
   where (user_id, id) in (select user_id, id from public.runs where deleted_at is null and rules_version < 1 limit p_batch);
  get diagnostics v_count = row_count;
  return v_count;
end $$;

revoke all on function public.sync_register_route(text, text, int, int, text), public.sync_delete_routes(text[]) from public, anon;
grant execute on function public.sync_register_route(text, text, int, int, text), public.sync_delete_routes(text[]) to authenticated;
revoke all on function public.service_storage_purge_batch(int), public.service_storage_purged(bigint[]) from public, anon, authenticated;
grant execute on function public.service_storage_purge_batch(int), public.service_storage_purged(bigint[]) to service_role;
revoke all on function private.recompute_validity(int) from public, anon, authenticated;
