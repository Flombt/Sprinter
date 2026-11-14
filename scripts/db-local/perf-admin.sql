-- Mesure des budgets §10.6 sur la graine volumineuse (10 000 comptes) :
-- node scripts/db-local/run.mjs --seed --seed-users 10000 --sql scripts/db-local/perf-admin.sql --only none
do $$
declare v_admin uuid := gen_random_uuid(); v_session uuid := gen_random_uuid();
begin
  insert into auth.users (id, email, raw_app_meta_data) values (v_admin, 'perf-admin@example.test', '{"providers":["email"]}');
  insert into auth.sessions (id, user_id, aal) values (v_session, v_admin, 'aal2');
  insert into private.admin_users (user_id, role) values (v_admin, 'owner');
  perform set_config('perf.admin', v_admin::text, false);
  perform set_config('perf.session', v_session::text, false);
end $$;
create temporary table perf (label text, ms numeric);
create or replace function pg_temp.measure(p_label text, p_sql text, p_runs int) returns void language plpgsql as $$
declare t timestamptz; i int;
begin
  for i in 1..p_runs loop
    t := clock_timestamp();
    perform set_config('request.jwt.claims', json_build_object('sub', current_setting('perf.admin'), 'role', 'authenticated', 'aal', 'aal2',
      'session_id', current_setting('perf.session'), 'amr', json_build_array(json_build_object('method', 'totp', 'timestamp', extract(epoch from now())::bigint)))::text, true);
    execute p_sql;
    insert into perf values (p_label, extract(epoch from clock_timestamp() - t) * 1000);
  end loop;
end $$;
select pg_temp.measure('search e-mail préfixe', $q$select public.admin_search_users('coureur04242@ex')$q$, 20);
select pg_temp.measure('search e-mail complet', $q$select public.admin_search_users('coureur04242@example.test')$q$, 20);
select pg_temp.measure('search nom',
  format('select public.admin_search_users(%L)', (
    select left(display_name_norm, 3) from private.user_directory
    where length(display_name_norm) >= 3 order by user_id limit 1
  )), 20);
select pg_temp.measure('search id court',
  format('select public.admin_search_users(%L)', left(md5('sprinter-seed-user-4242'), 8)), 20);
select pg_temp.measure('search filtres + tri', $q$select public.admin_search_users(null, '{"platform":["android"],"runs_min":5}', '-runs_count')$q$, 20);
select pg_temp.measure('overview 30 j', $q$select public.admin_overview(current_date - 29, current_date, true)$q$, 5);
select pg_temp.measure('overview 366 j', $q$select public.admin_overview(current_date - 365, current_date, true)$q$, 3);
select label, count(*) as runs, round(percentile_cont(0.5) within group (order by ms)::numeric, 1) as p50_ms,
       round(percentile_cont(0.95) within group (order by ms)::numeric, 1) as p95_ms
from perf group by label order by label;
select 'comptes' as label, count(*) from auth.users union all select 'courses', count(*) from public.runs;

do $$
begin
  if (select count(*) from auth.users) < 10001 then
    raise exception 'Le seuil de 10 000 comptes synthétiques n’est pas atteint';
  end if;
  if exists (
    select 1 from perf where label like 'search %'
    group by label having percentile_cont(0.95) within group (order by ms) >= 300
  ) then
    raise exception 'La recherche admin dépasse son budget p95 de 300 ms';
  end if;
end $$;
