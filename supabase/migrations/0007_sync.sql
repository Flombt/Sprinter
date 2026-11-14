-- 0007 — Synchronisation des courses et des réglages portables (phase 2, §7, §9.1).
-- Les écritures passent par des RPC qui forcent user_id := auth.uid(), dérivent les colonnes
-- depuis le payload et appliquent le « dernier écrit gagne » ; la suppression l'emporte.

-- ---------------------------------------------------------------------------------------
-- Validité des courses (§9.1, rules_version 1). Information pour le titulaire, jamais modifiable par lui.
-- ---------------------------------------------------------------------------------------
create or replace function private.run_validity(
  p_source text, p_started_at timestamptz, p_ended_at timestamptz, p_distance_m numeric, p_active_s integer, p_reliable_s integer,
  out validity text, out reasons text[]
) language plpgsql stable set search_path = '' as $$
declare
  v_speed numeric := case when p_active_s > 0 then p_distance_m / p_active_s end;
  v_pace numeric := case when p_distance_m > 0 then p_active_s / (p_distance_m / 1000.0) end;
begin
  reasons := '{}';
  if p_ended_at is null then reasons := array_append(reasons, 'unfinished'); end if;
  if p_distance_m < 100 or p_active_s < 30 then reasons := array_append(reasons, 'too_short'); end if;
  if p_started_at > now() + interval '1 day' or p_started_at < timestamptz '2000-01-01 00:00:00+00' then reasons := array_append(reasons, 'bad_date'); end if;
  if v_speed is not null and v_speed > 12.5 then reasons := array_append(reasons, 'vehicle_speed'); end if;
  if p_distance_m >= 1000 and v_pace is not null and v_pace < 120 then reasons := array_append(reasons, 'superhuman_pace'); end if;
  if array_length(reasons, 1) > 0 then validity := 'invalid'; return; end if;
  if p_distance_m >= 1000 and v_pace is not null and v_pace < 150 then reasons := array_append(reasons, 'very_fast'); end if;
  if p_source = 'sprinter' and p_active_s > 0 and coalesce(p_reliable_s, 0)::numeric / p_active_s < 0.6 then reasons := array_append(reasons, 'low_gps_reliability'); end if;
  validity := case when array_length(reasons, 1) > 0 then 'suspect' else 'valid' end;
end $$;

-- Meilleurs efforts calculés sur l'appareil : seuls les efforts plausibles sont conservés
-- (distance de la course ≥ d, vitesse ≤ 12,5 m/s, durée ≤ temps actif + 1 s).
create or replace function private.sanitize_best_efforts(p_efforts jsonb, p_distance_m numeric, p_active_s integer)
returns jsonb language sql immutable set search_path = '' as $$
  select case when p_efforts is null or jsonb_typeof(p_efforts) <> 'object' then null else nullif((
    select coalesce(jsonb_object_agg(e.key, round((e.value)::numeric, 1)), '{}'::jsonb)
    from jsonb_each(p_efforts) e
    where e.key ~ '^[0-9]{3,5}(\.[0-9])?$'
      and jsonb_typeof(e.value) = 'number'
      and (e.value)::numeric > 0
      and e.key::numeric <= p_distance_m
      and e.key::numeric / (e.value)::numeric <= 12.5
      and (e.value)::numeric <= p_active_s + 1
  ), '{}'::jsonb) end
$$;

create or replace function private.runs_before_write() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_check record;
begin
  if tg_op = 'UPDATE' and (new.user_id is distinct from old.user_id or new.id is distinct from old.id) then
    raise exception 'immutable_identity' using errcode = '42501';
  end if;
  new.server_updated_at := now();
  new.client_updated_at := least(new.client_updated_at, now());
  new.rules_version := 1;
  if new.deleted_at is not null then
    new.validity := 'invalid'; new.validity_reasons := array['deleted'];
    return new;
  end if;
  new.best_efforts := private.sanitize_best_efforts(new.best_efforts, new.distance_m, new.active_s);
  select * into v_check from private.run_validity(new.source, new.started_at, new.ended_at, new.distance_m, new.active_s, new.reliable_s);
  new.validity := v_check.validity;
  new.validity_reasons := v_check.reasons;
  -- Chevauchement avec une autre course du même utilisateur : la plus récente est suspecte.
  if new.validity = 'valid' or new.validity = 'suspect' then
    if exists (
      select 1 from public.runs o
      where o.user_id = new.user_id and o.id <> new.id and o.deleted_at is null and o.ended_at is not null and new.ended_at is not null
        and tstzrange(o.started_at, o.ended_at, '[)') && tstzrange(new.started_at, new.ended_at, '[)')
        and (o.started_at < new.started_at or (o.started_at = new.started_at and o.id < new.id))
    ) then
      new.validity := 'suspect';
      new.validity_reasons := array_append(new.validity_reasons, 'overlap');
    end if;
  end if;
  return new;
end $$;
create trigger runs_before_write before insert or update on public.runs
  for each row execute function private.runs_before_write();

-- Réévalue les courses qui démarrent après une course nouvellement écrite (chevauchement).
create or replace function private.revalidate_overlaps(p_user uuid, p_id text, p_started timestamptz, p_ended timestamptz)
returns void language sql security definer set search_path = '' as $$
  update public.runs r set rules_version = r.rules_version
  where r.user_id = p_user and r.id <> p_id and r.deleted_at is null and p_ended is not null and r.ended_at is not null
    and tstzrange(r.started_at, r.ended_at, '[)') && tstzrange(p_started, p_ended, '[)')
    and (r.started_at > p_started or (r.started_at = p_started and r.id > p_id));
$$;

-- File des objets Storage à purger (tracés supprimés), consommée par l'Edge Function purge-storage (phase 3).
create table private.storage_purge_queue (
  id bigint generated always as identity primary key,
  bucket text not null,
  path text not null,
  queued_at timestamptz not null default now(),
  unique (bucket, path)
);

-- ---------------------------------------------------------------------------------------
-- Envoi des courses (§5.4, §7.3).
-- ---------------------------------------------------------------------------------------
create or replace function public.sync_push_runs(p_runs jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_uid();
  v_backup boolean;
  v_item jsonb; v_payload jsonb; v_id text; v_source text; v_existing record;
  v_started timestamptz; v_ended timestamptz; v_client timestamptz; v_tz text;
  v_row public.runs; v_status text; v_reason text; v_out jsonb := '[]'::jsonb; v_inserted boolean; v_n int;
begin
  if p_runs is null or jsonb_typeof(p_runs) <> 'array' or jsonb_array_length(p_runs) > 50 then
    raise exception 'bad_batch' using errcode = '22023';
  end if;
  v_backup := private.has_consent(v_uid, 'cloud_sync_runs');
  for v_item in select value from jsonb_array_elements(p_runs) loop
    v_status := null; v_reason := null; v_row := null;
    v_id := v_item ->> 'id';
    v_payload := v_item -> 'payload';
    begin
      if not v_backup then v_reason := 'backup_disabled';
      elsif v_id is null or char_length(v_id) not between 1 and 100 then v_reason := 'bad_id';
      elsif v_payload is null or jsonb_typeof(v_payload) <> 'object' then v_reason := 'bad_payload';
      elsif v_payload ? 'points' and jsonb_typeof(v_payload -> 'points') = 'array' and jsonb_array_length(v_payload -> 'points') > 0 then v_reason := 'points_not_allowed';
      elsif (v_payload ->> 'id') is distinct from v_id then v_reason := 'id_mismatch';
      elsif jsonb_typeof(v_payload -> 'startedAt') <> 'number' or jsonb_typeof(v_payload -> 'activeSeconds') <> 'number'
            or jsonb_typeof(v_payload -> 'distanceMeters') <> 'number' then v_reason := 'bad_payload';
      end if;
      v_source := coalesce(v_item ->> 'source', 'sprinter');
      if v_reason is null and (v_source not in ('sprinter','healthkit','gpx') or ((v_source = 'healthkit') <> (v_id like 'healthkit:%'))) then
        v_reason := 'bad_source';
      end if;
      v_client := (v_item ->> 'client_updated_at')::timestamptz;
      if v_reason is null and v_client is null then v_reason := 'bad_client_updated_at'; end if;
      v_tz := v_item ->> 'tz';
      if v_tz is not null and (v_tz !~ '^[A-Za-z_]+(/[A-Za-z0-9_+-]+){0,2}$'
          or not exists (select 1 from pg_catalog.pg_timezone_names z where z.name = v_tz)) then v_tz := null; end if;
    exception when others then v_reason := 'bad_payload';
    end;

    if v_reason is not null then
      v_out := v_out || jsonb_build_object('id', v_id, 'status', 'rejected', 'reason', v_reason);
      continue;
    end if;

    v_started := to_timestamp((v_payload ->> 'startedAt')::double precision / 1000);
    v_ended := case when jsonb_typeof(v_payload -> 'endedAt') = 'number' then to_timestamp((v_payload ->> 'endedAt')::double precision / 1000) end;

    select r.deleted_at, r.client_updated_at into v_existing from public.runs r where r.user_id = v_uid and r.id = v_id for update;
    if found and v_existing.deleted_at is not null then
      v_status := 'ignored_deleted';
    elsif found and v_existing.client_updated_at >= least(v_client, now()) then
      v_status := 'ignored_stale';
    else
      insert into public.runs as r (
        user_id, id, source, started_at, ended_at, tz, active_s, total_s, distance_m, reliable_s, best_pace_s_km, ascent_m,
        session_type, platform, app_version, best_efforts, payload, has_route, client_updated_at
      ) values (
        v_uid, v_id, v_source, v_started, v_ended, v_tz,
        greatest(0, round((v_payload ->> 'activeSeconds')::numeric))::int,
        case when jsonb_typeof(v_payload -> 'totalSeconds') = 'number' then greatest(0, round((v_payload ->> 'totalSeconds')::numeric))::int end,
        greatest(0, round((v_payload ->> 'distanceMeters')::numeric, 1)),
        case when jsonb_typeof(v_payload -> 'reliableSeconds') = 'number' then greatest(0, round((v_payload ->> 'reliableSeconds')::numeric))::int end,
        case when jsonb_typeof(v_payload -> 'bestPace') = 'number' and (v_payload ->> 'bestPace')::numeric > 0 then least(round((v_payload ->> 'bestPace')::numeric, 2), 99999.99) end,
        case when jsonb_typeof(v_payload -> 'ascentMeters') = 'number' then least(greatest(0, round((v_payload ->> 'ascentMeters')::numeric, 1)), 999999.9) end,
        left(coalesce(v_payload #>> '{workout,definition,kind}', 'free'), 40),
        case when v_item ->> 'platform' in ('ios','android') then v_item ->> 'platform' end,
        left(v_item ->> 'app_version', 32),
        case when jsonb_typeof(v_item -> 'best_efforts') = 'object' then v_item -> 'best_efforts' end,
        v_payload - 'points',
        coalesce((v_item ->> 'has_route')::boolean, false),
        v_client
      )
      on conflict (user_id, id) do update set
        source = excluded.source, started_at = excluded.started_at, ended_at = excluded.ended_at, tz = excluded.tz,
        active_s = excluded.active_s, total_s = excluded.total_s, distance_m = excluded.distance_m, reliable_s = excluded.reliable_s,
        best_pace_s_km = excluded.best_pace_s_km, ascent_m = excluded.ascent_m, session_type = excluded.session_type,
        platform = coalesce(excluded.platform, r.platform), app_version = coalesce(excluded.app_version, r.app_version),
        best_efforts = excluded.best_efforts, payload = excluded.payload,
        has_route = excluded.has_route or exists (select 1 from public.run_routes rr where rr.user_id = r.user_id and rr.run_id = r.id),
        client_updated_at = excluded.client_updated_at
      where r.deleted_at is null and r.client_updated_at < excluded.client_updated_at
      returning (xmax = 0) into v_inserted;
      get diagnostics v_n = row_count;
      if v_n = 0 then
        v_status := 'ignored_stale';
      else
        v_status := 'applied';
        select * into v_row from public.runs where user_id = v_uid and id = v_id;
        perform private.revalidate_overlaps(v_uid, v_id, v_row.started_at, v_row.ended_at);
        -- Mesure d'usage : une course récente nouvellement sauvegardée compte pour son jour local.
        if v_inserted and v_row.started_at > now() - interval '2 days' then
          insert into public.activity_days (user_id, day, runs_count)
          values (v_uid, (v_row.started_at at time zone coalesce(v_tz, 'UTC'))::date, 1)
          on conflict (user_id, day) do update set runs_count = public.activity_days.runs_count + 1;
        end if;
      end if;
    end if;
    select * into v_row from public.runs where user_id = v_uid and id = v_id;
    v_out := v_out || jsonb_build_object('id', v_id, 'status', v_status, 'server_updated_at', v_row.server_updated_at,
      'validity', v_row.validity, 'validity_reasons', to_jsonb(v_row.validity_reasons));
  end loop;
  return v_out;
end $$;

-- Tombstone : la suppression l'emporte et vide le contenu (§5.4, §7.7).
create or replace function public.sync_delete_runs(p_ids text[]) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := private.require_uid(); v_id text; v_out jsonb := '[]'::jsonb; v_status text; v_at timestamptz;
  v_started timestamptz; v_ended timestamptz;
begin
  if p_ids is null or array_length(p_ids, 1) > 100 then raise exception 'bad_batch' using errcode = '22023'; end if;
  foreach v_id in array p_ids loop
    if v_id is null or char_length(v_id) not between 1 and 100 then
      v_out := v_out || jsonb_build_object('id', v_id, 'status', 'rejected', 'reason', 'bad_id'); continue;
    end if;
    insert into private.storage_purge_queue (bucket, path)
    select 'run-tracks', rr.storage_path from public.run_routes rr where rr.user_id = v_uid and rr.run_id = v_id
    on conflict (bucket, path) do nothing;
    delete from public.run_routes where user_id = v_uid and run_id = v_id;
    update public.runs set deleted_at = now(), payload = '{}'::jsonb, best_efforts = null, has_route = false, client_updated_at = now()
     where user_id = v_uid and id = v_id and deleted_at is null
    returning server_updated_at, started_at, ended_at into v_at, v_started, v_ended;
    if found then
      v_status := 'deleted';
      perform private.revalidate_overlaps(v_uid, v_id, v_started, v_ended);
    else
      insert into public.runs (user_id, id, source, started_at, active_s, distance_m, payload, client_updated_at, deleted_at)
      values (v_uid, v_id, case when v_id like 'healthkit:%' then 'healthkit' else 'sprinter' end, now(), 0, 0, '{}'::jsonb, now(), now())
      on conflict (user_id, id) do nothing;
      v_status := 'already_deleted';
      select server_updated_at into v_at from public.runs where user_id = v_uid and id = v_id;
    end if;
    v_out := v_out || jsonb_build_object('id', v_id, 'status', v_status, 'server_updated_at', v_at);
  end loop;
  return v_out;
end $$;

-- ---------------------------------------------------------------------------------------
-- Réception (§5.4) : curseur keyset (server_updated_at, id), tombstones incluses, réponse < 4 Mo.
-- ---------------------------------------------------------------------------------------
create or replace function public.sync_pull(p_after_ts timestamptz default null, p_after_id text default null, p_limit int default 200)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_uid();
  v_limit int := least(greatest(coalesce(p_limit, 200), 1), 500);
  v_items jsonb := '[]'::jsonb; v_bytes int := 0; v_count int := 0; v_last record; v_row record; v_item jsonb; v_cut boolean := false;
begin
  for v_row in
    select * from public.runs r
    where r.user_id = v_uid
      and (p_after_ts is null or (r.server_updated_at, r.id) > (p_after_ts, coalesce(p_after_id, '')))
    order by r.server_updated_at, r.id
    limit v_limit
  loop
    v_item := jsonb_build_object(
      'id', v_row.id, 'deleted', v_row.deleted_at is not null, 'server_updated_at', v_row.server_updated_at,
      'client_updated_at', v_row.client_updated_at, 'source', v_row.source, 'has_route', v_row.has_route,
      'validity', v_row.validity, 'validity_reasons', to_jsonb(v_row.validity_reasons), 'tz', v_row.tz,
      'best_efforts', v_row.best_efforts,
      'payload', case when v_row.deleted_at is null then v_row.payload end);
    if v_count > 0 and v_bytes + octet_length(v_item::text) > 3500000 then v_cut := true; exit; end if;
    v_items := v_items || v_item; v_bytes := v_bytes + octet_length(v_item::text); v_count := v_count + 1;
    v_last := v_row;
  end loop;
  return jsonb_build_object('items', v_items, 'next_cursor',
    case when v_count > 0 and (v_cut or v_count = v_limit) then jsonb_build_object('ts', v_last.server_updated_at, 'id', v_last.id) end);
end $$;

create or replace function public.sync_list_ids(p_after text default null, p_limit int default 1000) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_uid uuid := private.require_uid(); v_ids text[];
begin
  select array_agg(id order by id) into v_ids from (
    select r.id from public.runs r
    where r.user_id = v_uid and r.deleted_at is null and (p_after is null or r.id > p_after)
    order by r.id limit least(greatest(coalesce(p_limit, 1000), 1), 5000)) s;
  return jsonb_build_object('ids', coalesce(to_jsonb(v_ids), '[]'::jsonb),
    'next', case when coalesce(array_length(v_ids, 1), 0) >= least(greatest(coalesce(p_limit, 1000), 1), 5000) then v_ids[array_length(v_ids, 1)] end);
end $$;

-- ---------------------------------------------------------------------------------------
-- Réglages portables (§7.5) : liste blanche, dernier écrit gagne.
-- ---------------------------------------------------------------------------------------
create or replace function public.sync_push_preferences(p_data jsonb, p_client_updated_at timestamptz) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_uid();
  v_at timestamptz := least(p_client_updated_at, now());
  v_clean jsonb; v_row public.user_preferences;
begin
  if p_data is null or jsonb_typeof(p_data) <> 'object' or p_client_updated_at is null then
    raise exception 'invalid_parameter:data' using errcode = '22023';
  end if;
  select coalesce(jsonb_object_agg(key, value), '{}'::jsonb) into v_clean
  from jsonb_each(p_data) where key in ('config','audioEnabled','hapticsEnabled','appearance','autoPauseEnabled','coaching');
  insert into public.user_preferences as p (user_id, data, client_updated_at) values (v_uid, v_clean, v_at)
  on conflict (user_id) do update set data = excluded.data, client_updated_at = excluded.client_updated_at
  where p.client_updated_at < excluded.client_updated_at
  returning * into v_row;
  if v_row.user_id is null then
    select * into v_row from public.user_preferences where user_id = v_uid;
    return jsonb_build_object('status', 'ignored_stale', 'data', v_row.data, 'client_updated_at', v_row.client_updated_at);
  end if;
  return jsonb_build_object('status', 'applied', 'data', v_row.data, 'client_updated_at', v_row.client_updated_at);
end $$;

create or replace function public.sync_get_preferences() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_uid uuid := private.require_uid(); v_row public.user_preferences;
begin
  select * into v_row from public.user_preferences where user_id = v_uid;
  if not found then return null; end if;
  return jsonb_build_object('data', v_row.data, 'client_updated_at', v_row.client_updated_at);
end $$;

-- Statut de la dernière synchronisation de l'appareil (page Qualité de l'admin).
create or replace function public.report_sync(p_device_id uuid, p_status text, p_error_code text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := private.require_uid();
begin
  if p_status not in ('ok','partial','error') then raise exception 'invalid_parameter:status' using errcode = '22023'; end if;
  update public.user_devices
     set last_sync_at = now(), last_seen_at = now(), last_sync_status = p_status,
         last_sync_error_code = case when p_status = 'ok' then null when p_error_code ~ '^[a-z0-9_.:-]{1,64}$' then p_error_code else 'unknown' end
   where user_id = v_uid and device_id = p_device_id;
end $$;

revoke all on function public.sync_push_runs(jsonb), public.sync_delete_runs(text[]), public.sync_pull(timestamptz, text, int),
  public.sync_list_ids(text, int), public.sync_push_preferences(jsonb, timestamptz), public.sync_get_preferences(),
  public.report_sync(uuid, text, text) from public, anon;
grant execute on function public.sync_push_runs(jsonb), public.sync_delete_runs(text[]), public.sync_pull(timestamptz, text, int),
  public.sync_list_ids(text, int), public.sync_push_preferences(jsonb, timestamptz), public.sync_get_preferences(),
  public.report_sync(uuid, text, text) to authenticated;
revoke all on function private.run_validity(text, timestamptz, timestamptz, numeric, integer, integer),
  private.sanitize_best_efforts(jsonb, numeric, integer), private.runs_before_write(),
  private.revalidate_overlaps(uuid, text, timestamptz, timestamptz) from public, anon, authenticated;
grant all on private.storage_purge_queue to service_role;
