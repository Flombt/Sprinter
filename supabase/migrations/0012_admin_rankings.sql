-- 0012 — Sprinter Admin, classements et analyses (phase 4c, §9.2, §9.3, §10.4, §10.5).
-- Éligibilité comparative : source sprinter, validité valide, ≥ 1 000 m, ≥ 300 s, non supprimée.
-- Ventilations : comptes distincts, seuil k = 10, regroupement « Autres » toujours ≥ 10 ou absent.

create or replace function private.period_start(p_period text) returns timestamptz
language sql stable set search_path = '' as $$
  select case p_period
    when 'week' then private.paris_start(date_trunc('week', now() at time zone 'Europe/Paris')::date)
    when 'month' then private.paris_start(date_trunc('month', now() at time zone 'Europe/Paris')::date)
    when 'year' then private.paris_start(date_trunc('year', now() at time zone 'Europe/Paris')::date)
    when 'all' then timestamptz '2000-01-01 00:00:00+00'
  end
$$;

-- Statistiques par utilisateur et par période (classements), rafraîchies chaque jour (refresh-rankings).
create materialized view private.leaderboard_stats as
with periods(period) as (values ('week'), ('month'), ('year'), ('all')),
eligible as (
  select r.*, p.period from public.runs r cross join periods p
  where r.deleted_at is null and r.source = 'sprinter' and r.validity = 'valid' and r.distance_m >= 1000 and r.active_s >= 300
    and r.started_at >= private.period_start(p.period)
)
select period, user_id,
  count(*)::numeric as runs_count,
  round(sum(distance_m) / 1000, 2) as distance_total,
  round(max(distance_m) / 1000, 2) as longest_run,
  count(distinct (started_at at time zone coalesce(tz, 'Europe/Paris'))::date)::numeric as active_days,
  count(distinct to_char(started_at at time zone coalesce(tz, 'Europe/Paris'), 'IYYY-IW'))::numeric as active_weeks,
  min((best_efforts ->> '1000')::numeric) as best_effort_1k,
  min((best_efforts ->> '5000')::numeric) as best_effort_5k,
  min((best_efforts ->> '10000')::numeric) as best_effort_10k,
  min((best_efforts ->> '21097.5')::numeric) as best_effort_21k,
  max(started_at) as last_at,
  (array_agg(started_at order by distance_m desc, started_at))[1] as longest_at,
  (array_agg(started_at order by (best_efforts ->> '1000')::numeric nulls last, started_at))[1] as best_1k_at,
  (array_agg(started_at order by (best_efforts ->> '5000')::numeric nulls last, started_at))[1] as best_5k_at,
  (array_agg(started_at order by (best_efforts ->> '10000')::numeric nulls last, started_at))[1] as best_10k_at,
  (array_agg(started_at order by (best_efforts ->> '21097.5')::numeric nulls last, started_at))[1] as best_21k_at,
  now() as refreshed_at
from eligible group by period, user_id
with no data;
create unique index leaderboard_stats_pk on private.leaderboard_stats (period, user_id);

create or replace function private.refresh_rankings() returns void
language plpgsql security definer set search_path = '' as $$
begin
  refresh materialized view private.leaderboard_stats;
end $$;

create or replace function private.metric_column(p_metric text) returns text
language sql immutable set search_path = '' as $$
  select case when p_metric in ('runs_count','distance_total','longest_run','active_days','active_weeks',
                                'best_effort_1k','best_effort_5k','best_effort_10k','best_effort_21k') then p_metric end
$$;

create or replace function private.leaderboard_values(
  p_metric text, p_period text, p_platforms text[], p_countries text[]
) returns table (user_id uuid, value numeric, achieved_at timestamptz)
language sql stable set search_path = '' as $$
  select s.user_id,
    case p_metric
      when 'runs_count' then s.runs_count
      when 'distance_total' then s.distance_total
      when 'longest_run' then s.longest_run
      when 'active_days' then s.active_days
      when 'active_weeks' then s.active_weeks
      when 'best_effort_1k' then s.best_effort_1k
      when 'best_effort_5k' then s.best_effort_5k
      when 'best_effort_10k' then s.best_effort_10k
      when 'best_effort_21k' then s.best_effort_21k
    end,
    case p_metric
      when 'longest_run' then s.longest_at
      when 'best_effort_1k' then s.best_1k_at
      when 'best_effort_5k' then s.best_5k_at
      when 'best_effort_10k' then s.best_10k_at
      when 'best_effort_21k' then s.best_21k_at
      else s.last_at
    end
  from private.leaderboard_stats s
  left join public.profiles p on p.user_id = s.user_id
  where s.period = p_period
    and (p_platforms is null or exists (
      select 1 from public.user_devices d where d.user_id = s.user_id and d.platform = any (p_platforms)
    ))
    and (p_countries is null or p.country_code = any (p_countries))
$$;

-- Classements (§9.3) : agrégé par défaut, nominatif sous capacité + motif + réauth + audit.
create or replace function public.admin_leaderboard(
  p_metric text, p_period text, p_filters jsonb default '{}'::jsonb, p_mode text default 'aggregate',
  p_reason text default null, p_reason_note text default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_filters jsonb := coalesce(p_filters, '{}'::jsonb); v_key text; v_platforms text[]; v_countries text[];
  v_lower boolean := p_metric like 'best_effort_%'; v_reason text; v_result jsonb; v_unit text;
  v_values numeric[]; v_percentiles double precision[]; v_count int;
  v_hist jsonb := '[]'::jsonb; v_suppressed int := 0; v_min numeric; v_max numeric; v_width numeric;
  v_bucket record; v_carry_from numeric; v_carry int := 0; v_refreshed timestamptz;
begin
  if private.metric_column(p_metric) is null then raise exception 'invalid_parameter:metric' using errcode = '22023'; end if;
  if p_period not in ('week','month','year','all') then raise exception 'invalid_parameter:period' using errcode = '22023'; end if;
  if p_mode not in ('aggregate','nominative') then raise exception 'invalid_parameter:mode' using errcode = '22023'; end if;
  for v_key in select jsonb_object_keys(v_filters) loop
    if v_key not in ('platform','country') then raise exception 'invalid_parameter:filters.%', v_key using errcode = '22023'; end if;
  end loop;
  if p_mode = 'nominative' then
    perform private.assert_admin('leaderboard.nominative', true);
    v_reason := private.check_reason(p_reason, p_reason_note);
  else
    perform private.assert_admin('leaderboard.aggregate');
  end if;
  if not exists (select 1 from pg_catalog.pg_matviews where schemaname = 'private' and matviewname = 'leaderboard_stats' and ispopulated) then
    perform private.refresh_rankings();
  end if;
  v_unit := case when p_metric in ('distance_total','longest_run') then 'km' when v_lower then 's' when p_metric = 'active_weeks' then 'semaines'
                 when p_metric = 'active_days' then 'jours' else 'courses' end;
  v_platforms := case when v_filters ? 'platform' then array(select jsonb_array_elements_text(v_filters -> 'platform')) end;
  v_countries := case when v_filters ? 'country' then array(select jsonb_array_elements_text(v_filters -> 'country')) end;
  select max(refreshed_at) into v_refreshed from private.leaderboard_stats;

  if p_mode = 'nominative' then
    perform private.audit('leaderboard.view_nominative', null, v_reason, jsonb_build_object('metric', p_metric, 'period', p_period));
    select jsonb_build_object('mode', 'nominative', 'metric', p_metric, 'period', p_period, 'unit', v_unit, 'refreshed_at', v_refreshed,
      'items', coalesce(jsonb_agg(jsonb_build_object('rank', rank, 'user_id', user_id, 'short_id', private.short_id(user_id),
        'display_name', display_name, 'value', value, 'achieved_at', achieved_at) order by rank), '[]'::jsonb))
      into v_result
      from (select v.*, p.display_name, row_number() over (order by case when v_lower then v.value end asc, case when not v_lower then v.value end desc, v.achieved_at asc) as rank
            from private.leaderboard_values(p_metric, p_period, v_platforms, v_countries) v
            left join public.profiles p on p.user_id = v.user_id
            where v.value is not null) ranked
      where rank <= 50;
    return v_result;
  end if;

  select count(*)::int, array_agg(value), min(value), max(value),
         percentile_cont(array[0.1, 0.25, 0.5, 0.75, 0.9]::double precision[]) within group (order by value)
    into v_count, v_values, v_min, v_max, v_percentiles
    from private.leaderboard_values(p_metric, p_period, v_platforms, v_countries)
    where value is not null;
  if v_count >= 10 then
    v_width := greatest((v_max - v_min) / 10, 0.000001);
    -- Classes successives ; une classe de moins de 10 comptes est fusionnée avec la suivante.
    for v_bucket in
      select least(floor((value - v_min) / v_width), 9) as b, count(*) as users
      from unnest(v_values) as t(value) group by 1 order by 1
    loop
      if v_carry = 0 then v_carry_from := v_min + v_bucket.b * v_width; end if;
      v_carry := v_carry + v_bucket.users;
      if v_carry >= 10 then
        v_hist := v_hist || jsonb_build_object('from', round(v_carry_from, 2), 'to', round(v_min + (v_bucket.b + 1) * v_width, 2), 'users', v_carry);
        v_carry := 0;
      end if;
    end loop;
    if v_carry > 0 then
      if jsonb_array_length(v_hist) > 0 then
        v_hist := jsonb_set(v_hist, array[(jsonb_array_length(v_hist) - 1)::text, 'users'], to_jsonb((v_hist -> -1 ->> 'users')::int + v_carry));
        v_hist := jsonb_set(v_hist, array[(jsonb_array_length(v_hist) - 1)::text, 'to'], to_jsonb(round(v_max, 2)));
      else v_suppressed := 1; end if;
    end if;
  else
    v_suppressed := case when v_count > 0 then 1 else 0 end;
  end if;
  perform private.audit('leaderboard.view_aggregate', null, null, jsonb_build_object('metric', p_metric, 'period', p_period));
  return jsonb_build_object('mode', 'aggregate', 'metric', p_metric, 'period', p_period, 'unit', v_unit, 'lower_is_better', v_lower,
    'refreshed_at', v_refreshed,
    'eligible_users', case when v_count >= 10 then v_count end,
    'percentiles', case when v_count >= 10 then jsonb_build_object(
      'p10', v_percentiles[1], 'p25', v_percentiles[2], 'p50', v_percentiles[3],
      'p75', v_percentiles[4], 'p90', v_percentiles[5]) end,
    'histogram', v_hist, 'suppressed_buckets', v_suppressed,
    'method', 'Courses éligibles (§9.2) : source Sprinter, validité « valide », au moins 1 000 m et 300 s, non supprimées. '
      || case when v_lower then 'Meilleur effort = plus petit temps mesuré sur l’appareil pour la distance. ' else '' end
      || 'Égalités départagées par la date la plus ancienne. Moins de 10 comptes : non affiché.');
end $$;

-- Ventilation avec seuil k : les plus petites cellules rejoignent « Autres » jusqu'à ce qu'il atteigne k.
create or replace function private.k_anonymize(p_rows jsonb, p_k int default 10) returns jsonb
language plpgsql immutable set search_path = '' as $$
declare v_row jsonb; v_visible jsonb := '[]'::jsonb; v_other jsonb := null; v_sorted jsonb;
begin
  select coalesce(jsonb_agg(r order by (r ->> 'accounts')::int, r ->> 'key'), '[]'::jsonb) into v_sorted from jsonb_array_elements(p_rows) r;
  for v_row in select value from jsonb_array_elements(v_sorted) loop
    if (v_row ->> 'accounts')::int < p_k or (v_other is not null and (v_other ->> 'accounts')::int < p_k) then
      v_other := jsonb_build_object(
        'accounts', coalesce((v_other ->> 'accounts')::int, 0) + (v_row ->> 'accounts')::int,
        'runs', coalesce((v_other ->> 'runs')::numeric, 0) + coalesce((v_row ->> 'runs')::numeric, 0),
        'distance_km', coalesce((v_other ->> 'distance_km')::numeric, 0) + coalesce((v_row ->> 'distance_km')::numeric, 0));
    else
      v_visible := v_visible || v_row;
    end if;
  end loop;
  if v_other is not null and (v_other ->> 'accounts')::int < p_k then
    return jsonb_build_object('rows', v_visible, 'other', null, 'suppressed', true);
  end if;
  return jsonb_build_object('rows', (select coalesce(jsonb_agg(r order by (r ->> 'accounts')::int desc, r ->> 'key'), '[]'::jsonb) from jsonb_array_elements(v_visible) r),
                            'other', v_other, 'suppressed', false);
end $$;

create or replace function private.analytics_users(p_platforms text[], p_providers text[])
returns table (user_id uuid)
language sql stable set search_path = '' as $$
  select d.user_id from private.user_directory d
  where (p_providers is null or d.providers && p_providers)
    and (p_platforms is null or exists (
      select 1 from public.user_devices u where u.user_id = d.user_id and u.platform = any (p_platforms)
    ))
$$;

create or replace function public.admin_analytics(p_view text, p_from date, p_to date, p_filters jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_filters jsonb := coalesce(p_filters, '{}'::jsonb); v_key text; v_platforms text[]; v_providers text[];
  v_start timestamptz := private.paris_start(p_from); v_end timestamptz := private.paris_start(p_to + 1); v_out jsonb;
begin
  perform private.assert_admin('analytics.read');
  perform private.check_period(p_from, p_to);
  for v_key in select jsonb_object_keys(v_filters) loop
    if v_key not in ('platform','provider') then raise exception 'invalid_parameter:filters.%', v_key using errcode = '22023'; end if;
  end loop;
  v_platforms := case when v_filters ? 'platform' then array(select jsonb_array_elements_text(v_filters -> 'platform')) end;
  v_providers := case when v_filters ? 'provider' then array(select jsonb_array_elements_text(v_filters -> 'provider')) end;
  if p_view = 'signups' then
    with an_users as (select user_id from private.analytics_users(v_platforms, v_providers))
    select jsonb_build_object('series', coalesce(jsonb_agg(jsonb_build_object('day', g::date, 'value',
      (select count(*) from private.user_directory d join an_users a using (user_id)
        where d.signed_up_at >= private.paris_start(g::date) and d.signed_up_at < private.paris_start(g::date + 1))) order by g), '[]'::jsonb)
      ) into v_out from generate_series(p_from, p_to, interval '1 day') g;
  elsif p_view = 'activity' then
    with an_users as (select user_id from private.analytics_users(v_platforms, v_providers))
    select jsonb_build_object('series', coalesce(jsonb_agg(jsonb_build_object('day', g::date,
      'dau', (select count(distinct a.user_id) from public.activity_days a join an_users u using (user_id) where a.day = g::date),
      'wau', (select count(distinct a.user_id) from public.activity_days a join an_users u using (user_id) where a.day between g::date - 6 and g::date),
      'mau', (select count(distinct a.user_id) from public.activity_days a join an_users u using (user_id) where a.day between g::date - 29 and g::date)) order by g), '[]'::jsonb)
      ) into v_out from generate_series(p_from, p_to, interval '1 day') g;
  elsif p_view in ('distance_histogram', 'duration_histogram', 'frequency_histogram') then
    with an_users as (select user_id from private.analytics_users(v_platforms, v_providers)), values_ as (
      select case p_view when 'distance_histogram' then r.distance_m / 1000 when 'duration_histogram' then r.active_s / 60.0 end as v
      from public.runs r join an_users u using (user_id)
      where p_view <> 'frequency_histogram' and r.deleted_at is null and r.validity <> 'invalid' and r.started_at >= v_start and r.started_at < v_end
      union all
      select count(*)::numeric from public.runs r join an_users u using (user_id)
      where p_view = 'frequency_histogram' and r.deleted_at is null and r.validity <> 'invalid' and r.started_at >= v_start and r.started_at < v_end
      group by r.user_id
    ), buckets as (
      select case p_view when 'distance_histogram' then width_bucket(v, 0, 50, 10) when 'duration_histogram' then width_bucket(v, 0, 300, 10)
                         else width_bucket(v, 0, 60, 12) end as b, count(*) as n from values_ group by 1
    )
    select jsonb_build_object('unit', case p_view when 'distance_histogram' then 'km' when 'duration_histogram' then 'min' else 'courses par compte' end,
      'histogram', coalesce(jsonb_agg(jsonb_build_object(
        'from', case p_view when 'distance_histogram' then (b - 1) * 5 when 'duration_histogram' then (b - 1) * 30 else (b - 1) * 5 end,
        'to', case when b > (case p_view when 'frequency_histogram' then 12 else 10 end) then null
                   else case p_view when 'distance_histogram' then b * 5 when 'duration_histogram' then b * 30 else b * 5 end end,
        'value', case when n < 10 then null else n end, 'suppressed', n < 10) order by b), '[]'::jsonb))
      into v_out from buckets;
  elsif p_view = 'retention' then
    with an_users as (select user_id from private.analytics_users(v_platforms, v_providers)), cohorts as (
      select d.user_id, private.paris_day(d.signed_up_at) as day, date_trunc('week', d.signed_up_at at time zone 'Europe/Paris')::date as week
      from private.user_directory d join an_users u using (user_id)
      where d.signed_up_at >= v_start and d.signed_up_at < v_end
    ), sizes as (
      select week, count(*) as size, max(day) as last_day from cohorts group by week having count(*) >= 10
    ), daily as (
      select c.week,
        avg((exists (select 1 from public.activity_days a where a.user_id = c.user_id and a.day = c.day + 1))::int) as d1,
        avg((exists (select 1 from public.activity_days a where a.user_id = c.user_id and a.day = c.day + 7))::int) as d7,
        avg((exists (select 1 from public.activity_days a where a.user_id = c.user_id and a.day = c.day + 30))::int) as d30
      from cohorts c join sizes s using (week) group by c.week
    ), weekly as (
      select c.week, n, avg((exists (select 1 from public.activity_days a where a.user_id = c.user_id
               and a.day between c.week + n * 7 and c.week + n * 7 + 6))::int) as rate
      from cohorts c join sizes s using (week) cross join generate_series(1, 8) n group by c.week, n
    )
    select jsonb_build_object('cohorts', coalesce(jsonb_agg(jsonb_build_object('cohort_week', s.week, 'size', s.size,
        'd1', case when s.last_day + 1 <= current_date then round(d.d1, 3) end,
        'd7', case when s.last_day + 7 <= current_date then round(d.d7, 3) end,
        'd30', case when s.last_day + 30 <= current_date then round(d.d30, 3) end,
        'w', (select jsonb_agg(case when s.week + w.n * 7 <= current_date then round(w.rate, 3) end order by w.n) from weekly w where w.week = s.week)
      ) order by s.week), '[]'::jsonb))
      into v_out from sizes s join daily d using (week);
  elsif p_view = 'platform_compare' then
    with an_users as (select user_id from private.analytics_users(v_platforms, v_providers))
    select jsonb_build_object('rows', coalesce(jsonb_agg(jsonb_build_object('platform', platform, 'accounts', accounts, 'active', active, 'runs', runs, 'distance_km', km)), '[]'::jsonb))
      into v_out from (select pl.platform,
              (select count(distinct d.user_id) from public.user_devices d join an_users u using (user_id) where d.platform = pl.platform) as accounts,
              (select count(distinct a.user_id) from public.activity_days a join public.user_devices d using (user_id) join an_users u on u.user_id = a.user_id
                where d.platform = pl.platform and a.day between p_from and p_to) as active,
              (select count(*) from public.runs r join an_users u using (user_id) where r.platform = pl.platform and r.deleted_at is null and r.validity <> 'invalid'
                and r.started_at >= v_start and r.started_at < v_end) as runs,
              (select round(coalesce(sum(r.distance_m), 0) / 1000, 1) from public.runs r join an_users u using (user_id) where r.platform = pl.platform
                and r.deleted_at is null and r.validity <> 'invalid' and r.started_at >= v_start and r.started_at < v_end) as km
            from (values ('ios'), ('android')) pl(platform)) t;
  elsif p_view in ('breakdown_country', 'breakdown_city', 'breakdown_age_band') then
    with an_users as (select user_id from private.analytics_users(v_platforms, v_providers)), keyed as (
      select u.user_id, case p_view when 'breakdown_country' then p.country_code when 'breakdown_city' then p.city else p.age_band end as key
      from an_users u join public.profiles p using (user_id)
    ), rows_ as (
      select k.key, count(distinct k.user_id) as accounts,
        count(r.id) filter (where r.id is not null) as runs, round(coalesce(sum(r.distance_m), 0) / 1000, 1) as distance_km
      from keyed k left join public.runs r on r.user_id = k.user_id and r.deleted_at is null and r.validity <> 'invalid'
        and r.started_at >= v_start and r.started_at < v_end
      where k.key is not null group by k.key
    )
    select private.k_anonymize(coalesce(jsonb_agg(jsonb_build_object('key', key, 'accounts', accounts, 'runs', runs, 'distance_km', distance_km)), '[]'::jsonb))
      into v_out from rows_;
  else
    raise exception 'invalid_parameter:view' using errcode = '22023';
  end if;
  return v_out || jsonb_build_object('view', p_view, 'from', p_from, 'to', p_to,
    'method', 'Comptes distincts ; moins de 10 comptes : regroupés dans « Autres » ou masqués. Courses : non supprimées et non invalides (§9.2).');
end $$;

create or replace function public.admin_runs_stats(p_from date, p_to date, p_filters jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_start timestamptz := private.paris_start(p_from); v_end timestamptz := private.paris_start(p_to + 1); v_platforms text[]; v_key text;
begin
  perform private.assert_admin('analytics.read');
  perform private.check_period(p_from, p_to);
  for v_key in select jsonb_object_keys(coalesce(p_filters, '{}'::jsonb)) loop
    if v_key not in ('platform') then raise exception 'invalid_parameter:filters.%', v_key using errcode = '22023'; end if;
  end loop;
  v_platforms := case when p_filters ? 'platform' then array(select jsonb_array_elements_text(p_filters -> 'platform')) end;
  return (
    with scoped as (select * from public.runs r where r.deleted_at is null and r.started_at >= v_start and r.started_at < v_end
                      and (v_platforms is null or r.platform = any (v_platforms))),
         volume as (select * from scoped where validity <> 'invalid')
    select jsonb_build_object(
      'runs', (select count(*) from volume),
      'distance_km', (select round(coalesce(sum(distance_m), 0) / 1000, 1) from volume),
      'active_hours', (select round(coalesce(sum(active_s), 0) / 3600.0, 1) from volume),
      'avg_pace_s_per_km', (select case when sum(distance_m) > 0 then round(sum(active_s) / (sum(distance_m) / 1000), 1) end from volume),
      'median_pace_s_per_km', (select round((percentile_cont(0.5) within group (order by active_s / (distance_m / 1000.0)))::numeric, 1) from volume where distance_m >= 100),
      'validity', (select jsonb_build_object('valid', count(*) filter (where validity = 'valid'), 'suspect', count(*) filter (where validity = 'suspect'),
                    'invalid', count(*) filter (where validity = 'invalid')) from scoped),
      'sources', (select jsonb_build_object('sprinter', count(*) filter (where source = 'sprinter'), 'healthkit', count(*) filter (where source = 'healthkit'),
                    'gpx', count(*) filter (where source = 'gpx')) from volume),
      'incomplete', (select count(*) from scoped where ended_at is null),
      'series', (select coalesce(jsonb_agg(jsonb_build_object('day', g::date, 'runs', (select count(*) from volume v where v.started_at >= private.paris_start(g::date)
                   and v.started_at < private.paris_start(g::date + 1)), 'distance_km', (select round(coalesce(sum(v.distance_m), 0) / 1000, 1) from volume v
                   where v.started_at >= private.paris_start(g::date) and v.started_at < private.paris_start(g::date + 1))) order by g), '[]'::jsonb)
                 from generate_series(p_from, p_to, interval '1 day') g),
      'method', 'Volume : courses non supprimées et non invalides (§9.2). Allure moyenne = Σ temps actif ÷ Σ distance (jamais la moyenne des allures). Les courses non terminées sont exclues des classements et comptées à part.'));
end $$;

-- Vue d'ensemble : le jour courant n'est recalculé qu'une fois par transaction (budget §10.6).
create or replace function private.metric(p_day date, p_metric text) returns numeric
language plpgsql security definer set search_path = '' as $$
declare v_value numeric;
begin
  if p_day >= private.paris_day(now()) then
    if not exists (select 1 from private.daily_metrics where day = p_day and computed_at = now()) then perform private.compute_daily_metrics(p_day); end if;
  elsif not exists (select 1 from private.daily_metrics where day = p_day) then
    perform private.compute_daily_metrics(p_day);
  end if;
  select value into v_value from private.daily_metrics where day = p_day and metric = p_metric and dim = '';
  return coalesce(v_value, 0);
end $$;
revoke all on function private.metric(date, text) from public, anon, authenticated;

do $cron$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('refresh-rankings', '30 1 * * *', 'select private.refresh_rankings()');
  end if;
end $cron$;

revoke all on function private.period_start(text), private.refresh_rankings(), private.metric_column(text), private.k_anonymize(jsonb, int),
  private.leaderboard_values(text, text, text[], text[]), private.analytics_users(text[], text[]) from public, anon, authenticated;
revoke all on function public.admin_leaderboard(text, text, jsonb, text, text, text), public.admin_analytics(text, date, date, jsonb),
  public.admin_runs_stats(date, date, jsonb) from public, anon;
grant execute on function public.admin_leaderboard(text, text, jsonb, text, text, text), public.admin_analytics(text, date, date, jsonb),
  public.admin_runs_stats(date, date, jsonb) to authenticated;
revoke all on private.leaderboard_stats from public, anon, authenticated;
