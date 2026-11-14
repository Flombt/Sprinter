-- 0013 — Sprinter Admin, exploitation (phase 4d, §10.4, §5.6, §5.7) : qualité de service, support,
-- configuration de l'app, coupure côté serveur, exports agrégés, jobs de rétention.

-- ---------------------------------------------------------------------------------------
-- Configuration : clés connues, schéma validé, écriture auditée.
-- ---------------------------------------------------------------------------------------
insert into public.app_config (key, value) values
  ('support_enabled', 'false'), ('leaderboard_enabled', 'false'), ('profiles_enabled', 'false'),
  ('profile_studio_enabled', 'false'), ('profile_sharing_enabled', 'false'), ('theme_library_enabled', 'false'),
  ('profile_cards_enabled', 'false'),
  ('min_version', '{"ios": null, "android": null}'), ('maintenance', '{"enabled": false, "message": null}')
on conflict (key) do nothing;

create or replace function private.config_schema(p_key text) returns jsonb
language sql immutable set search_path = '' as $$
  select case
    when p_key in ('accounts_enabled','sync_enabled','routes_sync_enabled','support_enabled','leaderboard_enabled','profiles_enabled',
                   'profile_studio_enabled','profile_sharing_enabled','theme_library_enabled','profile_cards_enabled') then '{"type":"boolean"}'::jsonb
    when p_key = 'min_version' then '{"type":"object","properties":{"ios":"semver|null","android":"semver|null"}}'::jsonb
    when p_key = 'maintenance' then '{"type":"object","properties":{"enabled":"boolean","message":"string(280)|null"}}'::jsonb
  end
$$;

create or replace function private.valid_config(p_key text, p_value jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select case
    when private.config_schema(p_key) ->> 'type' = 'boolean' then jsonb_typeof(p_value) = 'boolean'
    when p_key = 'min_version' then jsonb_typeof(p_value) = 'object'
      and (select bool_and(k in ('ios','android')) from jsonb_object_keys(p_value) k)
      and coalesce(p_value ->> 'ios', '0.0.0') ~ '^\d{1,4}\.\d{1,4}\.\d{1,4}$'
      and coalesce(p_value ->> 'android', '0.0.0') ~ '^\d{1,4}\.\d{1,4}\.\d{1,4}$'
    when p_key = 'maintenance' then jsonb_typeof(p_value) = 'object'
      and (select bool_and(k in ('enabled','message')) from jsonb_object_keys(p_value) k)
      and jsonb_typeof(p_value -> 'enabled') = 'boolean'
      and (p_value -> 'message' is null or p_value -> 'message' = 'null'::jsonb
           or (jsonb_typeof(p_value -> 'message') = 'string' and char_length(p_value ->> 'message') <= 280))
    else false end
$$;

-- Flag lu côté serveur : la coupure s'applique sans attendre le cache de l'app (§13.5 retour arrière).
create or replace function private.flag(p_key text) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select (value)::boolean from public.app_config where key = p_key and jsonb_typeof(value) = 'boolean'), false)
$$;

create or replace function public.admin_get_config() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.assert_admin('overview.read');
  return jsonb_build_object('items', (select coalesce(jsonb_agg(jsonb_build_object('key', key, 'value', value, 'updated_at', updated_at,
    'schema', private.config_schema(key)) order by key), '[]'::jsonb) from public.app_config where private.config_schema(key) is not null));
end $$;

create or replace function public.admin_set_config(p_key text, p_value jsonb, p_reason text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_old jsonb; v_row public.app_config;
begin
  perform private.assert_admin('config.write', true);
  if private.config_schema(p_key) is null then raise exception 'invalid_parameter:key' using errcode = '22023'; end if;
  if p_value is null or not private.valid_config(p_key, p_value) then raise exception 'invalid_parameter:value' using errcode = '22023'; end if;
  if p_reason is null or char_length(trim(p_reason)) not between 3 and 200 then raise exception 'reason_required' using errcode = '22023'; end if;
  select value into v_old from public.app_config where key = p_key for update;
  insert into public.app_config (key, value) values (p_key, p_value)
  on conflict (key) do update set value = excluded.value returning * into v_row;
  perform private.audit('config.write', null, p_reason, jsonb_build_object('key', p_key, 'old', v_old, 'new', p_value));
  return jsonb_build_object('key', v_row.key, 'value', v_row.value, 'updated_at', v_row.updated_at);
end $$;

-- Coupure côté serveur : toute écriture de synchronisation par un utilisateur est refusée flag éteint.
create or replace function private.require_sync_enabled() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(auth.role(), '') = 'authenticated' and not (private.flag('accounts_enabled') and private.flag('sync_enabled')) then
    raise exception 'sync_disabled' using errcode = 'P0001', hint = 'feature_flag';
  end if;
  return new;
end $$;
create trigger runs_require_sync before insert or update on public.runs for each row execute function private.require_sync_enabled();
create trigger documents_require_sync before insert or update on public.synced_documents for each row execute function private.require_sync_enabled();
create trigger preferences_require_sync before insert or update on public.user_preferences for each row execute function private.require_sync_enabled();
create trigger routes_require_sync before insert or update on public.run_routes for each row execute function private.require_sync_enabled();

-- ---------------------------------------------------------------------------------------
-- Support (§10.4) : création idempotente depuis l'app, traitement dans l'admin.
-- ---------------------------------------------------------------------------------------
create or replace function public.submit_support_request(
  p_id uuid, p_category text, p_message text, p_platform text default null, p_app_version text default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := private.require_uid(); v_row public.support_requests;
begin
  if not private.flag('support_enabled') then raise exception 'support_disabled' using errcode = 'P0001'; end if;
  if p_id is null or p_category not in ('account','sync','bug','data_request','other') or p_message is null
     or char_length(trim(p_message)) not between 1 and 4000 then
    raise exception 'invalid_parameter' using errcode = '22023';
  end if;
  select * into v_row from public.support_requests where id = p_id and user_id = v_uid;
  if found then return jsonb_build_object('id', v_row.id, 'status', v_row.status, 'duplicate', true); end if;
  if (select count(*) from public.support_requests where user_id = v_uid and created_at > now() - interval '1 day') >= 5 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;
  insert into public.support_requests (id, user_id, category, message, platform, app_version)
  values (p_id, v_uid, p_category, trim(p_message), case when p_platform in ('ios','android','web') then p_platform end, left(p_app_version, 32))
  returning * into v_row;
  return jsonb_build_object('id', v_row.id, 'status', v_row.status, 'duplicate', false);
end $$;

create or replace function public.admin_list_support(p_status text[] default null, p_cursor jsonb default null, p_limit int default 50) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_items jsonb; v_limit int := least(greatest(coalesce(p_limit, 50), 1), 200);
begin
  perform private.assert_admin('support.manage');
  select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'user_id', s.user_id, 'short_id', private.short_id(s.user_id), 'category', s.category,
           'message', s.message, 'status', s.status, 'internal_note', s.internal_note, 'platform', s.platform, 'app_version', s.app_version,
           'created_at', s.created_at, 'updated_at', s.updated_at, 'closed_at', s.closed_at) order by s.created_at desc, s.id desc), '[]'::jsonb)
    into v_items
    from (select * from public.support_requests r
          where (p_status is null or r.status = any (p_status))
            and (p_cursor is null or (r.created_at, r.id) < ((p_cursor ->> 'created_at')::timestamptz, (p_cursor ->> 'id')::uuid))
          order by r.created_at desc, r.id desc limit v_limit) s;
  perform private.audit('support.list', null, null, jsonb_build_object('statuses', to_jsonb(p_status), 'count', jsonb_array_length(v_items)));
  return jsonb_build_object('items', v_items, 'next_cursor', case when jsonb_array_length(v_items) = v_limit then
    jsonb_build_object('created_at', v_items -> -1 -> 'created_at', 'id', v_items -> -1 -> 'id') end);
end $$;

create or replace function public.admin_update_support(p_id uuid, p_status text default null, p_internal_note text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_row public.support_requests;
begin
  perform private.assert_admin('support.manage');
  if p_status is not null and p_status not in ('open','in_progress','resolved','closed') then raise exception 'invalid_parameter:status' using errcode = '22023'; end if;
  if p_internal_note is not null and char_length(p_internal_note) > 2000 then raise exception 'invalid_parameter:internal_note' using errcode = '22023'; end if;
  update public.support_requests
     set status = coalesce(p_status, status), internal_note = coalesce(p_internal_note, internal_note),
         closed_at = case when coalesce(p_status, status) = 'closed' then coalesce(closed_at, now()) when p_status is not null then null else closed_at end
   where id = p_id returning * into v_row;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  perform private.audit('support.update', v_row.user_id, null, jsonb_build_object('status', v_row.status, 'note_set', p_internal_note is not null));
  return jsonb_build_object('id', v_row.id, 'status', v_row.status, 'internal_note', v_row.internal_note, 'updated_at', v_row.updated_at, 'closed_at', v_row.closed_at);
end $$;

-- ---------------------------------------------------------------------------------------
-- Qualité de service (§10.4).
-- ---------------------------------------------------------------------------------------
create or replace function public.admin_quality(p_from date, p_to date) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_start timestamptz := private.paris_start(p_from); v_end timestamptz := private.paris_start(p_to + 1);
begin
  perform private.assert_admin('quality.read');
  perform private.check_period(p_from, p_to);
  return (
    with seen as (select * from public.user_devices where last_seen_at >= v_start and last_seen_at < v_end)
    select jsonb_build_object(
      'devices_seen', (select count(*) from seen),
      'sync_success_rate', (select case when count(*) > 0 then round(count(*) filter (where last_sync_status = 'ok')::numeric / count(*), 3) end from seen),
      'never_synced_devices', (select count(*) from seen where last_sync_at is null),
      'errors_by_code', (select coalesce(jsonb_agg(jsonb_build_object('code', code, 'devices', n) order by n desc), '[]'::jsonb)
        from (select coalesce(last_sync_error_code, 'unknown') code, count(*) n from seen where last_sync_status in ('error','partial') group by 1) e),
      'errors_by_version', (select coalesce(jsonb_agg(jsonb_build_object('platform', platform, 'app_version', app_version, 'devices', n, 'errors', errors) order by n desc), '[]'::jsonb)
        from (select platform, coalesce(app_version, 'inconnue') app_version, count(*) n, count(*) filter (where last_sync_status = 'error') errors from seen group by 1, 2) v),
      'version_adoption', (select coalesce(jsonb_agg(jsonb_build_object('platform', platform, 'app_version', app_version, 'devices', n,
          'share', share) order by platform, n desc), '[]'::jsonb)
        from (select platform, app_version, n, round(n::numeric / nullif(sum(n) over (partition by platform), 0), 3) as share
              from (select platform, coalesce(app_version, 'inconnue') app_version, count(*) n from seen group by 1, 2) counts) a),
      'crash_reporting', jsonb_build_object('available', false)));
end $$;

-- ---------------------------------------------------------------------------------------
-- Exports CSV d'agrégats (§10.4) : jamais de donnée personnelle, période ≤ 366 jours, audités.
-- ---------------------------------------------------------------------------------------
create or replace function private.csv_line(p_values text[], p_separator text) returns text
language sql immutable set search_path = '' as $$
  select string_agg(case when v is null then '' when v ~ '[",;\n]' then '"' || replace(v, '"', '""') || '"' else v end, p_separator order by n)
  from unnest(p_values) with ordinality as t(v, n)
$$;

create or replace function public.admin_export_aggregates(p_kind text, p_from date, p_to date, p_format text default 'standard') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_sep text; v_decimal text; v_lines text[] := '{}'; v_row record; v_breakdown jsonb; v_item jsonb;
begin
  perform private.assert_admin('export.aggregates');
  perform private.check_period(p_from, p_to);
  if p_format not in ('standard','excel_fr') then raise exception 'invalid_parameter:format' using errcode = '22023'; end if;
  v_sep := case when p_format = 'excel_fr' then ';' else ',' end;
  v_decimal := case when p_format = 'excel_fr' then ',' else '.' end;
  if p_kind = 'daily_kpis' then
    v_lines := array[private.csv_line(array['jour','inscriptions','actifs','courses','distance_km'], v_sep)];
    for v_row in select g::date as day from generate_series(p_from, p_to, interval '1 day') g loop
      v_lines := v_lines || private.csv_line(array[v_row.day::text, private.metric(v_row.day, 'signups')::text, private.metric(v_row.day, 'active_users')::text,
        private.metric(v_row.day, 'runs')::text, replace(round(private.metric(v_row.day, 'distance_m') / 1000, 1)::text, '.', v_decimal)], v_sep);
    end loop;
  elsif p_kind = 'runs_by_day' then
    v_lines := array[private.csv_line(array['jour','courses','distance_km','temps_actif_h'], v_sep)];
    for v_row in select g::date as day,
        (select count(*) from public.runs r where r.deleted_at is null and r.validity <> 'invalid' and r.started_at >= private.paris_start(g::date) and r.started_at < private.paris_start(g::date + 1)) as runs,
        (select round(coalesce(sum(distance_m), 0) / 1000, 1) from public.runs r where r.deleted_at is null and r.validity <> 'invalid' and r.started_at >= private.paris_start(g::date) and r.started_at < private.paris_start(g::date + 1)) as km,
        (select round(coalesce(sum(active_s), 0) / 3600.0, 1) from public.runs r where r.deleted_at is null and r.validity <> 'invalid' and r.started_at >= private.paris_start(g::date) and r.started_at < private.paris_start(g::date + 1)) as hours
      from generate_series(p_from, p_to, interval '1 day') g loop
      v_lines := v_lines || private.csv_line(array[v_row.day::text, v_row.runs::text, replace(v_row.km::text, '.', v_decimal), replace(v_row.hours::text, '.', v_decimal)], v_sep);
    end loop;
  elsif p_kind = 'versions' then
    v_lines := array[private.csv_line(array['plateforme','version','appareils'], v_sep)];
    for v_row in select platform, coalesce(app_version, 'inconnue') as version, count(*) as n from public.user_devices
      where last_seen_at >= private.paris_start(p_from) and last_seen_at < private.paris_start(p_to + 1) group by 1, 2 having count(*) >= 10 order by 1, 3 desc loop
      v_lines := v_lines || private.csv_line(array[v_row.platform, v_row.version, v_row.n::text], v_sep);
    end loop;
  elsif p_kind = 'breakdown_country' then
    v_breakdown := public.admin_analytics('breakdown_country', p_from, p_to, '{}');
    v_lines := array[private.csv_line(array['pays','comptes','courses','distance_km'], v_sep)];
    for v_item in select value from jsonb_array_elements(v_breakdown -> 'rows') loop
      v_lines := v_lines || private.csv_line(array[v_item ->> 'key', v_item ->> 'accounts', v_item ->> 'runs', replace(v_item ->> 'distance_km', '.', v_decimal)], v_sep);
    end loop;
    if v_breakdown -> 'other' <> 'null'::jsonb then
      v_lines := v_lines || private.csv_line(array['Autres', v_breakdown -> 'other' ->> 'accounts', v_breakdown -> 'other' ->> 'runs',
        replace(v_breakdown -> 'other' ->> 'distance_km', '.', v_decimal)], v_sep);
    end if;
  else
    raise exception 'invalid_parameter:kind' using errcode = '22023';
  end if;
  perform private.audit('export.aggregates', null, null, jsonb_build_object('kind', p_kind, 'from', p_from, 'to', p_to, 'format', p_format));
  return jsonb_build_object('filename', format('sprinter-%s-%s_%s.csv', p_kind, p_from, p_to), 'content_type', 'text/csv; charset=utf-8',
    'csv', case when p_format = 'excel_fr' then chr(65279) else '' end || array_to_string(v_lines, E'\r\n') || E'\r\n');
end $$;

-- ---------------------------------------------------------------------------------------
-- Rétention (§5.6, §5.7).
-- ---------------------------------------------------------------------------------------
alter table private.deletion_requests drop constraint deletion_requests_source_check;
alter table private.deletion_requests add constraint deletion_requests_source_check check (source in ('app','web','admin','inactivity'));
create or replace function public.service_begin_account_deletion(p_user_id uuid, p_source text, p_operation_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_request private.deletion_requests;
begin
  if p_source not in ('app','web','admin','inactivity') or p_operation_id is null then
    raise exception 'invalid_parameter' using errcode = '22023';
  end if;
  select * into v_request from private.deletion_requests where user_id = p_user_id for update;
  if found and v_request.status = 'done' then
    return jsonb_build_object('status', 'done', 'operation_id', v_request.operation_id);
  end if;
  if not found then
    if not exists (select 1 from auth.users where id = p_user_id) then return jsonb_build_object('status', 'not_found'); end if;
    insert into private.deletion_requests (user_id, source, operation_id, status) values (p_user_id, p_source, p_operation_id, 'processing')
    returning * into v_request;
    insert into private.admin_audit_logs (admin_id, action, target_user_id, metadata)
    values (null, 'account.deletion_requested', p_user_id, jsonb_build_object('source', p_source, 'operation_id', p_operation_id));
  else
    update private.deletion_requests set status = 'processing', attempts = attempts + 1 where user_id = p_user_id returning * into v_request;
  end if;
  update private.user_directory set status = 'deleting', status_changed_at = now() where user_id = p_user_id;
  delete from auth.sessions where user_id = p_user_id;
  perform private.on_account_deleting(p_user_id);
  return jsonb_build_object('status', 'processing', 'operation_id', v_request.operation_id, 'attempts', v_request.attempts);
end $$;

create table private.inactivity_notices (
  user_id   uuid primary key references auth.users(id) on delete cascade,
  warned_at timestamptz not null default now()
);

-- Comptes à avertir (23 mois sans activité) puis à supprimer (24 mois, 30 jours après l'avertissement).
create or replace function public.service_inactive_accounts(p_stage text, p_limit int default 100) returns table (user_id uuid)
language sql stable security definer set search_path = '' as $$
  select d.user_id from private.user_directory d
  left join private.inactivity_notices n on n.user_id = d.user_id
  where d.status = 'active' and not exists (select 1 from private.admin_users a where a.user_id = d.user_id)
    and coalesce(d.last_active_day, private.paris_day(d.signed_up_at)) < current_date - case p_stage when 'warn' then 700 else 730 end
    and case p_stage when 'warn' then n.user_id is null else n.warned_at < now() - interval '30 days' end
  order by d.signed_up_at limit least(greatest(coalesce(p_limit, 100), 1), 500);
$$;
create or replace function public.service_mark_inactivity_notice(p_user_id uuid) returns void
language sql security definer set search_path = '' as $$
  insert into private.inactivity_notices (user_id) values (p_user_id) on conflict (user_id) do nothing;
$$;
-- Une activité après l'avertissement l'annule.
create or replace function private.clear_inactivity_notice() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  delete from private.inactivity_notices where user_id = new.user_id;
  return null;
end $$;
create trigger activity_clears_inactivity after insert on public.activity_days for each row execute function private.clear_inactivity_notice();

create or replace function private.job_retention() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_tombstones int; v_audit int; v_activity int; v_support int; v_deletions int;
begin
  delete from public.runs where deleted_at < now() - interval '90 days';
  get diagnostics v_tombstones = row_count;
  delete from public.synced_documents where deleted_at < now() - interval '90 days';
  perform set_config('private.purging_audit', 'on', true);
  delete from private.admin_audit_logs where at < now() - interval '12 months';
  get diagnostics v_audit = row_count;
  perform set_config('private.purging_audit', 'off', true);
  delete from public.activity_days where day < current_date - interval '25 months';
  get diagnostics v_activity = row_count;
  delete from public.support_requests where status = 'closed' and closed_at < now() - interval '12 months';
  get diagnostics v_support = row_count;
  delete from private.deletion_requests where status = 'done' and completed_at < now() - interval '12 months';
  get diagnostics v_deletions = row_count;
  return jsonb_build_object('tombstones', v_tombstones, 'audit', v_audit, 'activity_days', v_activity, 'support', v_support, 'deletion_traces', v_deletions);
end $$;

do $cron$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('retention', '45 2 * * *', 'select private.job_retention()');
  end if;
end $cron$;

revoke all on function private.config_schema(text), private.valid_config(text, jsonb), private.flag(text), private.require_sync_enabled(),
  private.csv_line(text[], text), private.clear_inactivity_notice(), private.job_retention() from public, anon, authenticated;
revoke all on function public.admin_get_config(), public.admin_set_config(text, jsonb, text), public.admin_list_support(text[], jsonb, int),
  public.admin_update_support(uuid, text, text), public.admin_quality(date, date), public.admin_export_aggregates(text, date, date, text),
  public.submit_support_request(uuid, text, text, text, text) from public, anon;
grant execute on function public.admin_get_config(), public.admin_set_config(text, jsonb, text), public.admin_list_support(text[], jsonb, int),
  public.admin_update_support(uuid, text, text), public.admin_quality(date, date), public.admin_export_aggregates(text, date, date, text),
  public.submit_support_request(uuid, text, text, text, text) to authenticated;
revoke all on function public.service_inactive_accounts(text, int), public.service_mark_inactivity_notice(uuid),
  public.service_begin_account_deletion(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.service_inactive_accounts(text, int), public.service_mark_inactivity_notice(uuid),
  public.service_begin_account_deletion(uuid, text, uuid) to service_role;
grant all on private.inactivity_notices to service_role;
