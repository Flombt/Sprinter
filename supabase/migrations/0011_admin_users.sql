-- 0011 — Sprinter Admin, utilisateurs (phase 4b, §10.4) : recherche, fiche, actions.
-- E-mail masqué partout sauf dans la fiche ; motif d'accès obligatoire ; audit sans e-mail
-- ni texte de recherche ; aucun filtre ni colonne sur l'âge exact, l'adresse ou une position.

create or replace function private.user_stats() returns table (user_id uuid, runs_count bigint, distance_km numeric)
language sql stable security definer set search_path = '' as $$
  select r.user_id, count(*), round(sum(r.distance_m) / 1000, 1)
  from public.runs r where r.deleted_at is null and r.validity <> 'invalid' group by r.user_id
$$;

create or replace function public.admin_search_users(
  p_q text default null, p_filters jsonb default '{}'::jsonb, p_sort text default '-signed_up_at', p_cursor jsonb default null, p_limit int default 50
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_filters jsonb := coalesce(p_filters, '{}'::jsonb);
  v_limit int := least(greatest(coalesce(p_limit, 50), 1), 100);
  v_q text := nullif(trim(coalesce(p_q, '')), '');
  v_kind text := 'none'; v_norm text; v_key text;
  v_sort text := coalesce(nullif(p_sort, ''), '-signed_up_at');
  v_desc boolean; v_field text; v_items jsonb; v_total int; v_cursor_v text; v_cursor_id uuid; v_exact boolean := false;
begin
  perform private.assert_admin('users.search');
  for v_key in select jsonb_object_keys(v_filters) loop
    if v_key not in ('signup_from','signup_to','last_active_from','last_active_to','status','provider','platform','app_version',
                     'country','city','runs_min','runs_max','km_min','km_max') then
      raise exception 'invalid_parameter:filters.%', v_key using errcode = '22023';
    end if;
  end loop;
  v_desc := left(v_sort, 1) = '-'; v_field := ltrim(v_sort, '-');
  if v_field not in ('signed_up_at','last_active_day','display_name','runs_count','distance_km') then
    raise exception 'invalid_parameter:sort' using errcode = '22023';
  end if;
  if v_q is not null then
    if position('@' in v_q) > 0 then
      if char_length(v_q) < 3 then raise exception 'invalid_parameter:q' using errcode = '22023'; end if;
      v_kind := 'email'; v_norm := lower(v_q);
    elsif v_q ~* '^[0-9a-f-]{8,36}$' then v_kind := 'id'; v_norm := lower(replace(v_q, '-', ''));
    else
      if char_length(v_q) < 2 then raise exception 'invalid_parameter:q' using errcode = '22023'; end if;
      v_kind := 'name'; v_norm := private.normalize_text(v_q);
    end if;
  end if;
  if p_cursor is not null then v_cursor_v := p_cursor ->> 'v'; v_cursor_id := (p_cursor ->> 'id')::uuid; end if;
  -- Le rapprochement approximatif (trigramme) ne sert que si aucune correspondance directe n'existe.
  if v_kind = 'email' then v_exact := exists (select 1 from private.user_directory where email_norm like v_norm || '%');
  elsif v_kind = 'name' then v_exact := exists (select 1 from private.user_directory where display_name_norm like '%' || v_norm || '%');
  end if;

  with base as (
    select d.user_id, p.display_name, d.email_norm, d.providers, d.status, d.signed_up_at, d.last_active_day,
           coalesce((select array_agg(distinct ud.platform) from public.user_devices ud where ud.user_id = d.user_id), '{}') as platforms,
           coalesce(s.runs_count, 0) as runs_count, coalesce(s.distance_km, 0) as distance_km,
           -- Clé de tri textuelle comparable (ordre stable, puis identifiant).
           case v_field
             when 'signed_up_at' then to_char(d.signed_up_at at time zone 'UTC', 'YYYYMMDDHH24MISSUS')
             when 'last_active_day' then coalesce(to_char(d.last_active_day, 'YYYYMMDD'), '00000000')
             when 'display_name' then coalesce(d.display_name_norm, '')
             when 'runs_count' then lpad(coalesce(s.runs_count, 0)::text, 12, '0')
             else lpad(to_char(coalesce(s.distance_km, 0) * 10, 'FM999999999990'), 12, '0') end as sort_key
    from private.user_directory d
    left join public.profiles p on p.user_id = d.user_id
    left join private.user_stats() s on s.user_id = d.user_id
    where (v_kind = 'none'
        or (v_kind = 'id' and replace(d.user_id::text, '-', '') like v_norm || '%')
        or (v_kind = 'email' and (d.email_norm like v_norm || '%' or (not v_exact and char_length(v_norm) >= 4 and extensions.similarity(d.email_norm, v_norm) >= 0.3)))
        or (v_kind = 'name' and (d.display_name_norm like '%' || v_norm || '%' or (not v_exact and extensions.similarity(d.display_name_norm, v_norm) >= 0.3))))
      and (not v_filters ? 'signup_from' or d.signed_up_at >= private.paris_start((v_filters ->> 'signup_from')::date))
      and (not v_filters ? 'signup_to' or d.signed_up_at < private.paris_start((v_filters ->> 'signup_to')::date + 1))
      and (not v_filters ? 'last_active_from' or d.last_active_day >= (v_filters ->> 'last_active_from')::date)
      and (not v_filters ? 'last_active_to' or d.last_active_day <= (v_filters ->> 'last_active_to')::date)
      and (not v_filters ? 'status' or d.status = any (array(select jsonb_array_elements_text(v_filters -> 'status'))))
      and (not v_filters ? 'provider' or d.providers && array(select jsonb_array_elements_text(v_filters -> 'provider')))
      and (not v_filters ? 'platform' or exists (select 1 from public.user_devices ud where ud.user_id = d.user_id
           and ud.platform = any (array(select jsonb_array_elements_text(v_filters -> 'platform')))))
      and (not v_filters ? 'app_version' or exists (select 1 from public.user_devices ud where ud.user_id = d.user_id
           and ud.app_version = any (array(select jsonb_array_elements_text(v_filters -> 'app_version')))))
      and (not v_filters ? 'country' or p.country_code = any (array(select jsonb_array_elements_text(v_filters -> 'country'))))
      and (not v_filters ? 'city' or p.city = any (array(select jsonb_array_elements_text(v_filters -> 'city'))))
      and (not v_filters ? 'runs_min' or coalesce(s.runs_count, 0) >= (v_filters ->> 'runs_min')::numeric)
      and (not v_filters ? 'runs_max' or coalesce(s.runs_count, 0) <= (v_filters ->> 'runs_max')::numeric)
      and (not v_filters ? 'km_min' or coalesce(s.distance_km, 0) >= (v_filters ->> 'km_min')::numeric)
      and (not v_filters ? 'km_max' or coalesce(s.distance_km, 0) <= (v_filters ->> 'km_max')::numeric)
  ),
  page as (
    select * from base r
    where v_cursor_id is null
       or (v_desc and (r.sort_key, r.user_id) < (v_cursor_v, v_cursor_id))
       or (not v_desc and (r.sort_key, r.user_id) > (v_cursor_v, v_cursor_id))
    order by case when v_desc then r.sort_key end desc, case when not v_desc then r.sort_key end asc,
             case when v_desc then r.user_id end desc, case when not v_desc then r.user_id end asc
    limit v_limit
  )
  select (select count(*) from (select 1 from base limit 10001) t),
         coalesce((select jsonb_agg(jsonb_build_object(
            'user_id', r.user_id, 'short_id', private.short_id(r.user_id), 'display_name', r.display_name,
            'email_masked', private.mask_email(r.email_norm), 'providers', to_jsonb(r.providers), 'status', r.status,
            'signed_up_at', r.signed_up_at, 'last_active_day', r.last_active_day, 'platforms', to_jsonb(r.platforms),
            'runs_count', r.runs_count, 'distance_km', r.distance_km, '_k', r.sort_key) order by
            case when v_desc then r.sort_key end desc, case when not v_desc then r.sort_key end asc,
            case when v_desc then r.user_id end desc, case when not v_desc then r.user_id end asc) from page r), '[]'::jsonb)
    into v_total, v_items;

  perform private.audit('user.search', null, null, jsonb_build_object(
    'filters', (select coalesce(jsonb_agg(k order by k), '[]'::jsonb) from jsonb_object_keys(v_filters) k), 'q_kind', v_kind, 'sort', v_sort));
  return jsonb_build_object(
    'items', (select coalesce(jsonb_agg(e - '_k'), '[]'::jsonb) from jsonb_array_elements(v_items) e),
    'total', least(v_total, 10000), 'total_capped', v_total > 10000,
    'next_cursor', case when jsonb_array_length(v_items) = v_limit then
      jsonb_build_object('v', v_items -> -1 ->> '_k', 'id', v_items -> -1 ->> 'user_id') end);
end $$;

-- Fiche utilisateur : motif obligatoire, e-mail complet uniquement ici, aucune course ni tracé.
create or replace function public.admin_get_user(p_user_id uuid, p_reason text, p_reason_note text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_admin record; v_reason text; v_dir private.user_directory; v_profile public.profiles;
begin
  select * into v_admin from private.assert_admin('users.read_profile');
  v_reason := private.check_reason(p_reason, p_reason_note);
  select * into v_dir from private.user_directory where user_id = p_user_id;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  select * into v_profile from public.profiles where user_id = p_user_id;
  perform private.audit('user.view', p_user_id, v_reason, jsonb_build_object('role', v_admin.role));
  return jsonb_build_object(
    'user_id', p_user_id, 'short_id', private.short_id(p_user_id), 'display_name', v_profile.display_name, 'status', v_dir.status,
    'providers', to_jsonb(v_dir.providers), 'signed_up_at', v_dir.signed_up_at, 'last_active_day', v_dir.last_active_day,
    'email', v_dir.email_norm, 'country_code', v_profile.country_code, 'city', v_profile.city,
    'age_band', case when v_admin.role = 'support' then null else v_profile.age_band end,
    'age_band_hidden', v_admin.role = 'support',
    'devices', coalesce((select jsonb_agg(jsonb_build_object('platform', platform, 'os_version', os_version, 'app_version', app_version,
        'last_seen_at', last_seen_at, 'last_sync_at', last_sync_at, 'last_sync_status', last_sync_status, 'last_sync_error_code', last_sync_error_code)
        order by last_seen_at desc) from public.user_devices where user_id = p_user_id), '[]'::jsonb),
    'activity', (select jsonb_build_object('runs_count', count(*), 'distance_km', round(coalesce(sum(distance_m), 0) / 1000, 1),
        'active_days_30', (select count(*) from public.activity_days a where a.user_id = p_user_id and a.day > current_date - 30),
        'last_run_at', max(started_at))
      from public.runs where user_id = p_user_id and deleted_at is null and validity <> 'invalid'),
    'consents', coalesce((select jsonb_agg(jsonb_build_object('purpose', p, 'granted', (c ->> 'granted')::boolean, 'version', c ->> 'version', 'at', c ->> 'at'))
        from unnest(array['terms','privacy_policy','cloud_sync_runs','cloud_sync_routes','community_leaderboard']) p,
             lateral (select private.current_consent(p_user_id, p) c) x where c <> 'null'::jsonb), '[]'::jsonb),
    'support', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'category', category, 'status', status, 'created_at', created_at) order by created_at desc)
        from public.support_requests where user_id = p_user_id), '[]'::jsonb),
    'deletion', (select jsonb_build_object('status', status, 'requested_at', requested_at) from private.deletion_requests where user_id = p_user_id));
end $$;

/**
 * Autorise et applique en base une action sur un compte (désactiver, réactiver, révoquer les
 * sessions, traiter une suppression). Appelée par l'Edge Function admin-user-action avec le JWT
 * de l'administrateur : contrôle, effet en base et audit dans la même transaction.
 */
create or replace function public.admin_authorize_user_action(
  p_user_id uuid, p_action text, p_reason text, p_reason_note text default null, p_confirmation text default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_reason text; v_dir private.user_directory; v_sessions int := 0;
begin
  perform private.assert_admin('users.manage', true);
  v_reason := private.check_reason(p_reason, p_reason_note);
  if p_action not in ('disable','enable','revoke_sessions','process_deletion') then raise exception 'invalid_parameter:action' using errcode = '22023'; end if;
  select * into v_dir from private.user_directory where user_id = p_user_id for update;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  if p_user_id = auth.uid() then raise exception 'forbidden' using errcode = '42501', hint = 'self_action'; end if;
  if p_action = 'process_deletion' and coalesce(p_confirmation, '') <> 'SUPPRIMER ' || private.short_id(p_user_id) then
    raise exception 'confirmation_mismatch' using errcode = '22023';
  end if;
  if p_action = 'disable' then
    update private.user_directory set status = 'disabled', status_changed_at = now() where user_id = p_user_id and status = 'active';
    delete from auth.sessions where user_id = p_user_id; get diagnostics v_sessions = row_count;
  elsif p_action = 'enable' then
    update private.user_directory set status = 'active', status_changed_at = now() where user_id = p_user_id and status = 'disabled';
  elsif p_action = 'revoke_sessions' then
    delete from auth.sessions where user_id = p_user_id; get diagnostics v_sessions = row_count;
  end if;
  perform private.audit('user.' || p_action, p_user_id, v_reason, jsonb_build_object('sessions_revoked', v_sessions));
  return jsonb_build_object('action', p_action, 'status', (select status from private.user_directory where user_id = p_user_id));
end $$;

revoke all on function private.user_stats() from public, anon, authenticated;
revoke all on function public.admin_search_users(text, jsonb, text, jsonb, int), public.admin_get_user(uuid, text, text),
  public.admin_authorize_user_action(uuid, text, text, text, text) from public, anon;
grant execute on function public.admin_search_users(text, jsonb, text, jsonb, int), public.admin_get_user(uuid, text, text),
  public.admin_authorize_user_action(uuid, text, text, text, text) to authenticated;
