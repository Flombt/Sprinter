-- Graine SYNTHÉTIQUE (§0.2 règle 12) : aucune donnée réelle. Domaine réservé example.test.
-- Appliquée par `supabase db reset` en local, et manuellement sur staging uniquement.
-- Échelle : variable `sprinter.seed_users` (défaut 2 000 comptes, ~10 courses par compte).
-- Variante volumineuse (budgets §10.6) : psql "$DB_URL" -c "set sprinter.seed_users = 10000" -f supabase/seed.sql

select setseed(0.42);
select set_config('sprinter.seed_users', coalesce(nullif(current_setting('sprinter.seed_users', true), ''), '2000'), false);

create temporary table seed_users as
select
  i,
  md5('sprinter-seed-user-' || i)::uuid as id,
  format('coureur%s@example.test', lpad(i::text, 5, '0')) as email,
  (array['apple','apple','apple','google','google','google','email','email','email','email'])[1 + floor(random() * 10)::int] as provider,
  random() < 0.1 as second_method,
  now() - (power(random(), 1.6) * interval '420 days') as created_at,
  random() as r_profile,
  random() as r_activity
from generate_series(1, current_setting('sprinter.seed_users')::int) as i;

insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, email_confirmed_at)
select id, email,
       jsonb_build_object('provider', provider, 'providers', jsonb_build_array(provider)),
       '{}'::jsonb, created_at, created_at, created_at
from seed_users
on conflict (id) do nothing;

insert into auth.identities (provider_id, user_id, provider, identity_data, created_at, updated_at)
select case when provider = 'email' then id::text else provider || '-seed-' || i end, id, provider,
       jsonb_build_object('sub', id::text, 'email', email), created_at, created_at
from seed_users
on conflict (provider_id, provider) do nothing;

insert into auth.identities (provider_id, user_id, provider, identity_data, created_at, updated_at)
select id::text, id, 'email', jsonb_build_object('sub', id::text, 'email', email), created_at, created_at
from seed_users where second_method and provider <> 'email'
on conflict (provider_id, provider) do nothing;

-- Profil de compte : champs facultatifs, partiellement renseignés.
with names as (
  select array['Camille','Alex','Sacha','Lou','Noa','Charlie','Eden','Maxime','Morgane','Yanis','Inès','Hugo','Léa','Nathan','Jade','Malo','Zoé','Théo','Anaïs','Bastien'] as n
), places as (
  select * from (values
    ('FR', array['Paris','Lyon','Marseille','Toulouse','Nantes','Lille','Bordeaux','Rennes','Grenoble','Annecy']),
    ('BE', array['Bruxelles','Liège','Namur','Gand']),
    ('CH', array['Genève','Lausanne','Neuchâtel']),
    ('CA', array['Montréal','Québec','Gatineau']),
    ('ES', array['Barcelone','Madrid','Valence'])
  ) as t(code, cities)
)
update public.profiles p
   set display_name = case when u.r_profile < 0.7 then (select n[1 + floor(random() * 20)::int] from names) || ' ' || chr(65 + floor(random() * 26)::int) || '.' end,
       country_code = c.code,
       city = case when c.code is not null and random() < 0.65 then c.cities[1 + floor(random() * array_length(c.cities, 1))::int] end,
       age_band = case when random() < 0.5 then (array['16-24','25-34','25-34','35-44','35-44','45-54','55+'])[1 + floor(random() * 7)::int] end
  from seed_users u
  left join lateral (
    select code, cities from places
    where u.r_profile < 0.6
    order by case code when 'FR' then random() * 0.3 else random() end
    limit 1
  ) c on true
 where p.user_id = u.id;

-- Appareils : 1 ou 2 par compte.
insert into public.user_devices (user_id, device_id, platform, os_version, app_version, last_seen_at, last_sync_at, last_sync_status, last_sync_error_code, created_at)
select u.id,
       md5('sprinter-seed-device-' || u.i || '-' || d)::uuid,
       plat,
       case plat when 'ios' then (array['26.4','27.0','27.1'])[1 + floor(random() * 3)::int] else (array['14','15','16'])[1 + floor(random() * 3)::int] end,
       (array['1.0.0','1.0.0','1.0.1','1.1.0'])[1 + floor(random() * 4)::int],
       now() - random() * interval '45 days',
       case when random() < 0.97 then now() - random() * interval '45 days' end,
       s.status,
       case s.status when 'error' then (array['network','timeout','auth_expired','server_5xx'])[1 + floor(random() * 4)::int] when 'partial' then 'rejected_items' end,
       u.created_at
from seed_users u
cross join lateral generate_series(1, case when u.r_activity < 0.15 then 2 else 1 end) as d
cross join lateral (select case when random() < 0.68 then 'ios' else 'android' end as plat) p
cross join lateral (select case when r < 0.95 then 'ok' when r < 0.97 then 'partial' else 'error' end as status from (select random() as r) x) s;

-- Courses : distance et allure réalistes, quelques cas limites pour les règles de validité.
create temporary table seed_runs as
select
  u.id as user_id,
  u.i,
  k,
  u.created_at + random() * (now() - u.created_at) as started_at,
  greatest(150, round((1000 + power(random(), 1.8) * 24000)::numeric, 1)) as distance_m,
  230 + random() * 230 as pace,
  (array['sprinter','sprinter','sprinter','sprinter','sprinter','sprinter','sprinter','sprinter','sprinter','sprinter','sprinter','healthkit','gpx'])[1 + floor(random() * 13)::int] as source,
  random() as r_quality,
  random() as r_deleted
from seed_users u
cross join lateral generate_series(1, (u.r_activity * 21)::int) as k;

insert into public.runs (user_id, id, source, started_at, ended_at, tz, active_s, total_s, distance_m, reliable_s, best_pace_s_km,
                         ascent_m, session_type, platform, app_version, best_efforts, payload, has_route, validity, validity_reasons,
                         client_updated_at, server_updated_at, created_at, deleted_at)
select
  r.user_id,
  case r.source when 'healthkit' then 'healthkit:' || md5('hk-' || r.i || '-' || r.k)::uuid
                else (extract(epoch from r.started_at) * 1000)::bigint || '-' || substr(md5('run-' || r.i || '-' || r.k), 1, 10) end,
  r.source,
  r.started_at,
  r.started_at + make_interval(secs => (case when r.r_quality < 0.005 then 20 else r.distance_m / 1000 * r.pace end) * 1.08),
  'Europe/Paris',
  (case when r.r_quality < 0.005 then 20 else r.distance_m / 1000 * r.pace end)::int,
  ((case when r.r_quality < 0.005 then 20 else r.distance_m / 1000 * r.pace end) * 1.08)::int,
  case when r.r_quality between 0.005 and 0.008 then r.distance_m * 4 else r.distance_m end,
  case when r.source = 'sprinter' then ((r.distance_m / 1000 * r.pace) * case when r.r_quality > 0.97 then 0.4 else 0.85 + random() * 0.15 end)::int end,
  round((r.pace * 0.85)::numeric, 2),
  round((random() * r.distance_m / 100)::numeric, 1),
  case when random() < 0.25 then (array['progression','timeTrial','regularity','survival'])[1 + floor(random() * 4)::int] else 'free' end,
  case when random() < 0.68 then 'ios' else 'android' end,
  '1.0.0',
  case when r.source = 'sprinter' then (
    select jsonb_object_agg(d::text, round((d / 1000.0 * r.pace * (0.9 + random() * 0.08))::numeric))
    from unnest(array[1000, 5000, 10000, 21097.5]) as d where d <= r.distance_m) end,
  jsonb_build_object('dataVersion', 3, 'startedAt', (extract(epoch from r.started_at) * 1000)::bigint,
                     'activeSeconds', round((r.distance_m / 1000 * r.pace)::numeric), 'distanceMeters', r.distance_m,
                     'inTargetSeconds', 0, 'splits', '[]'::jsonb, 'synthetic', true),
  r.source = 'sprinter' and random() < 0.4,
  case when r.r_quality < 0.008 then 'invalid' when r.r_quality > 0.97 and r.source = 'sprinter' then 'suspect' else 'valid' end,
  case when r.r_quality < 0.005 then array['too_short'] when r.r_quality < 0.008 then array['vehicle_speed']
       when r.r_quality > 0.97 and r.source = 'sprinter' then array['low_gps_reliability'] else '{}' end,
  r.started_at + interval '2 hours',
  r.started_at + interval '2 hours',
  r.started_at + interval '2 hours',
  case when r.r_deleted < 0.01 then r.started_at + interval '3 days' end
from seed_runs r
on conflict (user_id, id) do nothing;

update public.runs set payload = '{}'::jsonb, best_efforts = null, has_route = false where deleted_at is not null;

-- Mesure d'usage : jours de course + ouvertures de l'app.
insert into public.activity_days (user_id, day, runs_count)
select user_id, (started_at at time zone 'Europe/Paris')::date, count(*)
from public.runs where deleted_at is null
group by 1, 2
on conflict (user_id, day) do update set runs_count = excluded.runs_count;

insert into public.activity_days (user_id, day)
select u.id, (now() at time zone 'Europe/Paris')::date - (random() * 90)::int
from seed_users u cross join generate_series(1, 6)
where u.r_activity > 0.3 and u.created_at < now() - interval '1 day'
on conflict (user_id, day) do nothing;

update private.user_directory d
   set last_active_day = a.last_day
  from (select user_id, max(day) as last_day from public.activity_days group by user_id) a
 where a.user_id = d.user_id;

-- Choix et acceptations.
insert into public.consent_log (user_id, purpose, version, granted, client_event_id, client_at, created_at)
select u.id, p.purpose, '2026-11', true, md5('consent-' || u.i || p.purpose)::uuid, u.created_at, u.created_at
from seed_users u cross join (values ('terms'), ('privacy_policy')) as p(purpose);

insert into public.consent_log (user_id, purpose, version, granted, client_event_id, client_at, created_at)
select u.id, 'cloud_sync_runs', '2026-11', true, md5('consent-runs-' || u.i)::uuid, u.created_at + interval '1 minute', u.created_at + interval '1 minute'
from seed_users u where exists (select 1 from public.runs r where r.user_id = u.id);

insert into public.consent_log (user_id, purpose, version, granted, client_event_id, client_at, created_at)
select u.id, 'cloud_sync_routes', '2026-11', u.r_profile < 0.45, md5('consent-routes-' || u.i)::uuid, u.created_at + interval '2 minutes', u.created_at + interval '2 minutes'
from seed_users u where exists (select 1 from public.runs r where r.user_id = u.id);

-- Demandes de support synthétiques.
insert into public.support_requests (user_id, category, message, platform, app_version, status, created_at)
select u.id,
       (array['account','sync','bug','data_request','other'])[1 + floor(random() * 5)::int],
       'Message synthétique de test n° ' || u.i,
       (array['ios','android'])[1 + floor(random() * 2)::int],
       '1.0.0',
       (array['open','open','in_progress','resolved','closed'])[1 + floor(random() * 5)::int],
       now() - random() * interval '60 days'
from seed_users u where u.i % 33 = 0;

drop table if exists seed_runs;
drop table if exists seed_users;
