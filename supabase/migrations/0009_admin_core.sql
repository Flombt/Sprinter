-- 0009 — Sprinter Admin, socle (phase 4a, §10.2, §10.5) : rôles et capacités, AAL2,
-- ré-authentification récente, audit, vue d'ensemble, métriques quotidiennes, journal.
-- Le site n'utilise jamais service_role : il appelle ces fonctions avec le JWT de l'administrateur.

-- Capacités par rôle (§10.2). La modération exige une habilitation dédiée pour `support`.
create or replace function private.admin_capabilities(p_role text, p_moderation boolean) returns text[]
language sql immutable set search_path = '' as $$
  select case p_role
    when 'owner' then array['overview.read','quality.read','analytics.read','leaderboard.aggregate','export.aggregates','leaderboard.nominative',
                            'users.search','users.read_profile','runs.read_summary','users.manage','support.manage','config.write','audit.read',
                            'admins.manage','moderation.read','moderation.decide']
    when 'support' then array['overview.read','quality.read','users.search','users.read_profile','runs.read_summary','support.manage']
                        || case when p_moderation then array['moderation.read','moderation.decide'] else '{}'::text[] end
    when 'analyst' then array['overview.read','quality.read','analytics.read','leaderboard.aggregate','export.aggregates']
    else '{}'::text[] end
$$;

-- Ré-authentification réelle de moins de 5 minutes (claim amr, inchangée par un rafraîchissement).
create or replace function private.reauth_valid_until() returns timestamptz
language sql stable set search_path = '' as $$
  select to_timestamp(max((e ->> 'timestamp')::double precision)) + interval '5 minutes'
  from jsonb_array_elements(coalesce(auth.jwt() -> 'amr', '[]'::jsonb)) e
  where jsonb_typeof(e -> 'timestamp') = 'number'
$$;

/**
 * Contrôle commun : session active, AAL2, rôle issu de private.admin_users (jamais des
 * métadonnées), capacité. Optionnellement : ré-authentification de moins de 5 minutes.
 */
create or replace function private.assert_admin(p_capability text, p_reauth boolean default false)
returns table (admin_id uuid, role text) language plpgsql stable security definer set search_path = '' as $$
declare v_uid uuid := private.require_uid(); v_admin private.admin_users;
begin
  select * into v_admin from private.admin_users a where a.user_id = v_uid;
  if not found then raise exception 'forbidden' using errcode = '42501'; end if;
  if coalesce(auth.jwt() ->> 'aal', '') <> 'aal2' then raise exception 'aal2_required' using errcode = '42501'; end if;
  if p_capability is not null and not (p_capability = any (private.admin_capabilities(v_admin.role, v_admin.moderation))) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_reauth and coalesce(private.reauth_valid_until() < now(), true) then
    raise exception 'reauth_required' using errcode = '42501';
  end if;
  admin_id := v_uid; role := v_admin.role;
  return next;
end $$;

-- Audit append-only, écrit dans la même transaction que la lecture ou l'action.
create or replace function private.audit(p_action text, p_target uuid, p_reason text, p_metadata jsonb default '{}'::jsonb)
returns void language sql security definer set search_path = '' as $$
  insert into private.admin_audit_logs (admin_id, action, target_user_id, reason, metadata)
  values (auth.uid(), p_action, p_target, left(p_reason, 500), coalesce(p_metadata, '{}'::jsonb));
$$;

create or replace function private.check_reason(p_reason text, p_note text) returns text
language plpgsql immutable set search_path = '' as $$
begin
  if p_reason is null or p_reason not in ('support','data_request','technical','other') then
    raise exception 'reason_required' using errcode = '22023';
  end if;
  if p_note is not null and char_length(p_note) > 200 then raise exception 'invalid_parameter:reason_note' using errcode = '22023'; end if;
  return p_reason || coalesce(' · ' || nullif(trim(p_note), ''), '');
end $$;

create or replace function private.check_period(p_from date, p_to date) returns void
language plpgsql immutable set search_path = '' as $$
begin
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 365 then
    raise exception 'invalid_parameter:period' using errcode = '22023';
  end if;
end $$;

-- ---------------------------------------------------------------------------------------
-- admin_whoami (§10.2 étape 3) : accepté en AAL1 pour orienter vers le TOTP.
-- ---------------------------------------------------------------------------------------
create or replace function public.admin_whoami() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_uid uuid := private.require_uid(); v_admin private.admin_users; v_aal text := coalesce(auth.jwt() ->> 'aal', 'aal1');
begin
  select * into v_admin from private.admin_users where user_id = v_uid;
  if not found then raise exception 'forbidden' using errcode = '42501'; end if;
  return jsonb_build_object('user_id', v_uid, 'short_id', private.short_id(v_uid), 'role', v_admin.role, 'aal', v_aal,
    'moderation', v_admin.moderation,
    'capabilities', case when v_aal = 'aal2' then to_jsonb(private.admin_capabilities(v_admin.role, v_admin.moderation)) else '[]'::jsonb end,
    'reauth_valid_until', private.reauth_valid_until());
end $$;

-- ---------------------------------------------------------------------------------------
-- Métriques quotidiennes (jours calendaires Europe/Paris, idempotent).
-- ---------------------------------------------------------------------------------------
create or replace function private.paris_day(p_at timestamptz) returns date
language sql immutable set search_path = '' as $$ select (p_at at time zone 'Europe/Paris')::date $$;
-- Début du jour calendaire à Paris : bornes indexables (started_at, signed_up_at).
create or replace function private.paris_start(p_day date) returns timestamptz
language sql immutable set search_path = '' as $$ select (p_day::timestamp at time zone 'Europe/Paris') $$;

create or replace function private.compute_daily_metrics(p_day date) returns void
language plpgsql security definer set search_path = '' as $$
begin
  delete from private.daily_metrics where day = p_day;
  insert into private.daily_metrics (day, metric, dim, value)
  select p_day, 'signups', '', count(*) from private.user_directory
    where signed_up_at >= private.paris_start(p_day) and signed_up_at < private.paris_start(p_day + 1)
  union all
  select p_day, 'signups', 'provider:' || p, count(*)
    from private.user_directory d, unnest(case when cardinality(d.providers) = 0 then array['email'] else d.providers end) p
    where d.signed_up_at >= private.paris_start(p_day) and d.signed_up_at < private.paris_start(p_day + 1) group by p
  union all
  select p_day, 'active_users', '', count(distinct user_id) from public.activity_days where day = p_day
  union all
  select p_day, 'wau', '', count(distinct user_id) from public.activity_days where day between p_day - 6 and p_day
  union all
  select p_day, 'mau', '', count(distinct user_id) from public.activity_days where day between p_day - 29 and p_day
  union all
  select p_day, m.metric, '', m.value from (
    select count(*)::numeric as runs, coalesce(sum(distance_m), 0) as distance_m, coalesce(sum(active_s), 0)::numeric as active_s
    from public.runs where deleted_at is null and validity <> 'invalid'
      and started_at >= private.paris_start(p_day) and started_at < private.paris_start(p_day + 1)
  ) r cross join lateral (values ('runs', r.runs), ('distance_m', r.distance_m), ('active_s', r.active_s)) as m(metric, value);
end $$;

-- Valeur d'une métrique pour un jour : en direct pour aujourd'hui, sinon depuis daily_metrics (calculée si absente).
create or replace function private.metric(p_day date, p_metric text) returns numeric
language plpgsql security definer set search_path = '' as $$
declare v_value numeric;
begin
  if p_day >= private.paris_day(now()) then
    perform private.compute_daily_metrics(p_day);
  elsif not exists (select 1 from private.daily_metrics where day = p_day) then
    perform private.compute_daily_metrics(p_day);
  end if;
  select value into v_value from private.daily_metrics where day = p_day and metric = p_metric and dim = '';
  return coalesce(v_value, 0);
end $$;

-- ---------------------------------------------------------------------------------------
-- Vue d'ensemble (§10.5).
-- ---------------------------------------------------------------------------------------
create or replace function private.overview_values(p_from date, p_to date) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_days int := p_to - p_from + 1;
  v_signups numeric := 0; v_dau numeric := 0; v_runs numeric := 0; v_distance numeric := 0; v_active numeric := 0;
  v_wau numeric; v_mau numeric; v_active_users numeric; v_activation numeric; v_cohort numeric; v_median numeric;
  v_seen numeric; v_ok numeric; v_day date;
  v_series jsonb := '{}'::jsonb;
begin
  for v_day in select generate_series(p_from, p_to, interval '1 day')::date loop
    v_signups := v_signups + private.metric(v_day, 'signups');
    v_dau := v_dau + private.metric(v_day, 'active_users');
    v_runs := v_runs + private.metric(v_day, 'runs');
    v_distance := v_distance + private.metric(v_day, 'distance_m');
    v_active := v_active + private.metric(v_day, 'active_s');
  end loop;
  v_wau := private.metric(p_to, 'wau');
  v_mau := private.metric(p_to, 'mau');
  select count(distinct user_id) into v_active_users from public.activity_days where day between p_from and p_to;
  -- Activation : comptes créés sur la période avec une course non invalide dans les 7 jours suivant l'inscription.
  select count(*), count(*) filter (where exists (
           select 1 from public.runs r where r.user_id = d.user_id and r.deleted_at is null and r.validity <> 'invalid'
             and r.started_at >= d.signed_up_at and r.started_at < d.signed_up_at + interval '7 days'))
    into v_cohort, v_activation
    from private.user_directory d where d.signed_up_at >= private.paris_start(p_from) and d.signed_up_at < private.paris_start(p_to + 1);
  select percentile_cont(0.5) within group (order by active_s / (distance_m / 1000.0)) into v_median
    from public.runs where deleted_at is null and validity <> 'invalid' and distance_m >= 100
      and started_at >= private.paris_start(p_from) and started_at < private.paris_start(p_to + 1);
  select count(*), count(*) filter (where last_sync_status = 'ok') into v_seen, v_ok
    from public.user_devices where last_seen_at >= private.paris_start(p_from) and last_seen_at < private.paris_start(p_to + 1);
  return jsonb_build_object(
    'signups', v_signups, 'dau', round(v_dau / v_days, 1), 'wau', v_wau, 'mau', v_mau,
    'stickiness', case when v_mau > 0 then round((v_dau / v_days) / v_mau, 3) end,
    'activation', case when v_cohort > 0 then round(v_activation / v_cohort, 3) end,
    'runs', v_runs, 'distance_km', round(v_distance / 1000, 1),
    'avg_pace_s_per_km', case when v_distance > 0 then round(v_active / (v_distance / 1000), 1) end,
    'median_pace_s_per_km', round(v_median::numeric, 1),
    'runs_per_active', case when v_active_users > 0 then round(v_runs / v_active_users, 2) end,
    'sync_success', case when v_seen > 0 then round(v_ok / v_seen, 3) end);
end $$;

create or replace function public.admin_overview(p_from date, p_to date, p_compare boolean default true) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_current jsonb; v_previous jsonb; v_len int; v_prev_from date; v_prev_to date; v_series jsonb; v_kpis jsonb := '{}'::jsonb; v_key text;
begin
  perform private.assert_admin('overview.read');
  perform private.check_period(p_from, p_to);
  v_len := p_to - p_from + 1; v_prev_to := p_from - 1; v_prev_from := p_from - v_len;
  v_current := private.overview_values(p_from, p_to);
  v_previous := case when p_compare then private.overview_values(v_prev_from, v_prev_to) end;
  select jsonb_object_agg(m, coalesce(s, '[]'::jsonb)) into v_series from (
    select m, jsonb_agg(jsonb_build_object('day', d, 'value', case m
        when 'signups' then private.metric(d, 'signups') when 'dau' then private.metric(d, 'active_users')
        when 'wau' then private.metric(d, 'wau') when 'mau' then private.metric(d, 'mau')
        when 'runs' then private.metric(d, 'runs') when 'distance_km' then round(private.metric(d, 'distance_m') / 1000, 1)
        when 'avg_pace_s_per_km' then case when private.metric(d, 'distance_m') > 0 then round(private.metric(d, 'active_s') / (private.metric(d, 'distance_m') / 1000), 1) end
        when 'stickiness' then case when private.metric(d, 'mau') > 0 then round(private.metric(d, 'active_users') / private.metric(d, 'mau'), 3) end
      end) order by d) as s
    from generate_series(p_from, p_to, interval '1 day') g(dd), lateral (select g.dd::date as d) x,
         unnest(array['signups','dau','wau','mau','runs','distance_km','avg_pace_s_per_km','stickiness']) as m
    group by m) t;
  foreach v_key in array array['signups','dau','wau','mau','stickiness','activation','runs','distance_km','avg_pace_s_per_km','runs_per_active','sync_success'] loop
    v_kpis := v_kpis || jsonb_build_object(v_key, jsonb_build_object(
      'value', v_current -> v_key, 'previous', case when p_compare then v_previous -> v_key end,
      'series', coalesce(v_series -> v_key, '[]'::jsonb)));
  end loop;
  v_kpis := jsonb_set(v_kpis, '{avg_pace_s_per_km,median}', coalesce(v_current -> 'median_pace_s_per_km', 'null'::jsonb));
  v_kpis := v_kpis || jsonb_build_object('guest_conversion', jsonb_build_object('value', null, 'previous', null, 'series', '[]'::jsonb, 'unavailable', true));
  return jsonb_build_object(
    'period', jsonb_build_object('from', p_from, 'to', p_to, 'days', v_len, 'timezone', 'Europe/Paris'),
    'compare_period', case when p_compare then jsonb_build_object('from', v_prev_from, 'to', v_prev_to) end,
    'updated_at', (select max(computed_at) from private.daily_metrics where day < private.paris_day(now())),
    'kpis', v_kpis,
    'providers', (select coalesce(jsonb_agg(jsonb_build_object('provider', p, 'accounts', n) order by n desc), '[]'::jsonb)
                  from (select p, count(*) n from private.user_directory d, unnest(d.providers) p where d.status <> 'deleting' group by p) x),
    'providers_note', 'Un compte relié à plusieurs fournisseurs compte dans chacun.',
    'versions', (select coalesce(jsonb_agg(jsonb_build_object('platform', platform, 'app_version', app_version, 'devices', n) order by n desc), '[]'::jsonb)
                 from (select platform, coalesce(app_version, 'inconnue') app_version, count(*) n from public.user_devices
                       where private.paris_day(last_seen_at) between p_from and p_to group by 1, 2) v));
end $$;

-- ---------------------------------------------------------------------------------------
-- Journal (lecture seule, owner).
-- ---------------------------------------------------------------------------------------
create or replace function public.admin_list_audit(p_cursor jsonb default null, p_filters jsonb default '{}'::jsonb, p_limit int default 50)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_limit int := least(greatest(coalesce(p_limit, 50), 1), 200);
  v_filters jsonb := coalesce(p_filters, '{}'::jsonb);
  v_key text; v_items jsonb;
begin
  perform private.assert_admin('audit.read');
  for v_key in select jsonb_object_keys(v_filters) loop
    if v_key not in ('action','admin_id','target_user_id','from','to') then raise exception 'invalid_parameter:filters.%', v_key using errcode = '22023'; end if;
  end loop;
  select coalesce(jsonb_agg(jsonb_build_object('id', l.id, 'at', l.at, 'admin_id', l.admin_id,
           'admin_short', coalesce(private.short_id(l.admin_id), 'système'), 'action', l.action,
           'target_user_id', l.target_user_id, 'target_short', private.short_id(l.target_user_id),
           'reason', l.reason, 'metadata', l.metadata) order by l.at desc, l.id desc), '[]'::jsonb)
    into v_items
    from (select * from private.admin_audit_logs a
          where (p_cursor is null or (a.at, a.id) < ((p_cursor ->> 'at')::timestamptz, (p_cursor ->> 'id')::bigint))
            and (not v_filters ? 'action' or a.action = any (array(select jsonb_array_elements_text(v_filters -> 'action'))))
            and (not v_filters ? 'admin_id' or a.admin_id = (v_filters ->> 'admin_id')::uuid)
            and (not v_filters ? 'target_user_id' or a.target_user_id = (v_filters ->> 'target_user_id')::uuid)
            and (not v_filters ? 'from' or a.at >= (v_filters ->> 'from')::date)
            and (not v_filters ? 'to' or a.at < (v_filters ->> 'to')::date + 1)
          order by a.at desc, a.id desc limit v_limit) l;
  return jsonb_build_object('items', v_items, 'next_cursor', case when jsonb_array_length(v_items) = v_limit then
    jsonb_build_object('at', v_items -> -1 -> 'at', 'id', v_items -> -1 -> 'id') end);
end $$;

-- ---------------------------------------------------------------------------------------
-- Planification (pg_cron, UTC) : J-1 et rattrapage de J-2 chaque jour à 01:15.
-- ---------------------------------------------------------------------------------------
create or replace function private.job_daily_metrics() returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.compute_daily_metrics(private.paris_day(now()) - 1);
  perform private.compute_daily_metrics(private.paris_day(now()) - 2);
end $$;

do $cron$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('daily-metrics', '15 1 * * *', 'select private.job_daily_metrics()');
  end if;
end $cron$;

revoke all on function private.admin_capabilities(text, boolean), private.reauth_valid_until(), private.assert_admin(text, boolean),
  private.audit(text, uuid, text, jsonb), private.check_reason(text, text), private.check_period(date, date), private.paris_day(timestamptz), private.paris_start(date),
  private.compute_daily_metrics(date), private.metric(date, text), private.overview_values(date, date), private.job_daily_metrics()
  from public, anon, authenticated;
revoke all on function public.admin_whoami(), public.admin_overview(date, date, boolean), public.admin_list_audit(jsonb, jsonb, int) from public, anon;
grant execute on function public.admin_whoami(), public.admin_overview(date, date, boolean), public.admin_list_audit(jsonb, jsonb, int) to authenticated;
