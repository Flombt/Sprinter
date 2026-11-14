-- Phase 4a : accès admin (AAL2, rôles, capacités) et KPI vérifiés contre des requêtes de référence.
begin;
select plan(24);

create temporary table ids (name text primary key, id uuid) on commit drop;
grant select on ids to authenticated, anon;
insert into ids values
  ('owner', tests.create_user('owner@example.test')), ('support', tests.create_user('support@example.test')),
  ('analyst', tests.create_user('analyst@example.test')), ('user', tests.create_user('user@example.test')),
  ('forged', tests.create_user('forged@example.test', 'email', '{"role":"owner","admin":true}'::jsonb));
update auth.users set raw_app_meta_data = raw_app_meta_data || '{"role":"owner"}' where id = (select id from ids where name = 'forged');
insert into private.admin_users (user_id, role) values
  ((select id from ids where name = 'owner'), 'owner'), ((select id from ids where name = 'support'), 'support'),
  ((select id from ids where name = 'analyst'), 'analyst');
select tests.create_session(id) from ids;

-- Accès ------------------------------------------------------------------------------------
select tests.login_as((select id from ids where name = 'user'), null, 'aal2');
select throws_ok($$select public.admin_whoami()$$, '42501', 'forbidden', 'utilisateur non admin : accès refusé');
select throws_ok($$select public.admin_overview(current_date - 6, current_date)$$, '42501', 'forbidden', 'non admin : vue d''ensemble refusée');
select tests.logout();
select tests.login_as((select id from ids where name = 'forged'), null, 'aal2');
select throws_ok($$select public.admin_overview(current_date - 6, current_date)$$, '42501', 'forbidden', 'rôle déclaré dans les métadonnées : refusé');
select tests.logout();
select tests.login_as((select id from ids where name = 'owner'), null, 'aal1');
select is(public.admin_whoami() ->> 'role', 'owner', 'whoami accepté en AAL1 pour orienter vers le TOTP');
select is(jsonb_array_length(public.admin_whoami() -> 'capabilities'), 0, 'aucune capacité tant que la session est AAL1');
select throws_ok($$select public.admin_overview(current_date - 6, current_date)$$, '42501', 'aal2_required', 'session AAL1 : RPC refusée');
select tests.logout();
select tests.login_anon();
select throws_ok($$select public.admin_whoami()$$, '42501', null, 'anon ne peut pas appeler les RPC admin');
select tests.logout();
select tests.login_as((select id from ids where name = 'support'), null, 'aal2');
select lives_ok($$select public.admin_overview(current_date - 6, current_date)$$, 'support : vue d''ensemble autorisée');
select throws_ok($$select public.admin_list_audit()$$, '42501', 'forbidden', 'support : journal refusé');
select tests.logout();
select tests.login_as((select id from ids where name = 'owner'), null, 'aal2', 60);
select ok((public.admin_whoami() ->> 'reauth_valid_until')::timestamptz > now(), 'authentification récente détectée (amr)');
select throws_ok($$select public.admin_overview(current_date - 400, current_date)$$, '22023', 'invalid_parameter:period', 'période > 366 jours refusée');
select throws_ok($$select public.admin_list_audit(null, '{"email":"x"}')$$, '22023', null, 'filtre hors liste blanche refusé');
select tests.logout();

-- KPI sur un jeu déterministe (semaine du 6 au 12 janvier 2020, hors de la graine) ----------------
update private.user_directory set signed_up_at = '2020-01-07 10:00+01' where user_id = (select id from ids where name = 'user');
update private.user_directory set signed_up_at = '2020-01-09 10:00+01' where user_id = (select id from ids where name = 'forged');
update private.user_directory set signed_up_at = '2019-12-01 10:00+01' where user_id = (select id from ids where name = 'analyst');
insert into public.runs (user_id, id, started_at, ended_at, active_s, distance_m, reliable_s, payload, client_updated_at) values
  ((select id from ids where name = 'user'), 'k1', '2020-01-08 08:00+01', '2020-01-08 08:30+01', 1500, 5000, 1500, '{}', now()),
  ((select id from ids where name = 'forged'), 'k2', '2020-01-21 08:00+01', '2020-01-21 09:00+01', 3000, 10000, 3000, '{}', now()),
  ((select id from ids where name = 'analyst'), 'k3', '2020-01-10 08:00+01', '2020-01-10 09:00+01', 3300, 10000, 3300, '{}', now()),
  ((select id from ids where name = 'analyst'), 'k4', '2020-01-11 08:00+01', '2020-01-11 08:01+01', 20, 50, 20, '{}', now());
insert into public.activity_days (user_id, day) values
  ((select id from ids where name = 'user'), '2020-01-07'), ((select id from ids where name = 'user'), '2020-01-08'),
  ((select id from ids where name = 'forged'), '2020-01-09'), ((select id from ids where name = 'analyst'), '2020-01-10'),
  ((select id from ids where name = 'analyst'), '2020-01-11');
insert into public.user_devices (user_id, device_id, platform, app_version, last_seen_at, last_sync_status) values
  ((select id from ids where name = 'user'), gen_random_uuid(), 'ios', '9.9.1', '2020-01-08 12:00+01', 'ok'),
  ((select id from ids where name = 'forged'), gen_random_uuid(), 'android', '9.9.1', '2020-01-09 12:00+01', 'error');
create temporary table ov as select null::jsonb as v;
grant select, update on ov to authenticated;
select tests.login_as((select id from ids where name = 'owner'), null, 'aal2');
update ov set v = public.admin_overview('2020-01-06', '2020-01-12', true) -> 'kpis';
select tests.logout();
select is((select (v -> 'signups' ->> 'value')::numeric from ov), 2::numeric, 'KPI inscriptions');
select is((select (v -> 'runs' ->> 'value')::numeric from ov), 2::numeric, 'KPI courses (invalides exclues)');
select is((select (v -> 'distance_km' ->> 'value')::numeric from ov), 15.0, 'KPI distance cumulée');
select is((select (v -> 'avg_pace_s_per_km' ->> 'value')::numeric from ov), 320.0, 'KPI allure moyenne = Σ temps ÷ Σ distance');
select is((select (v -> 'avg_pace_s_per_km' ->> 'median')::numeric from ov), 315.0, 'allure médiane affichée à côté');
select is((select (v -> 'activation' ->> 'value')::numeric from ov), 0.5, 'KPI activation (course valide sous 7 jours)');
select is((select (v -> 'dau' ->> 'value')::numeric from ov), 0.7, 'KPI DAU moyen');
select is((select (v -> 'mau' ->> 'value')::numeric from ov), 3::numeric, 'KPI MAU au dernier jour');
select is((select (v -> 'sync_success' ->> 'value')::numeric from ov), 0.5, 'KPI succès de synchro');
select ok((select (v -> 'guest_conversion' ->> 'unavailable')::boolean from ov), 'conversion invité → compte : non disponible');

-- Cohérence avec des requêtes de référence sur les 30 derniers jours (graine incluse si chargée) ----
-- pgTAP exécute tout dans une transaction : on invalide le calcul du jour fait plus haut, avant les mises à jour.
delete from private.daily_metrics where day >= current_date - 1;
select tests.login_as((select id from ids where name = 'owner'), null, 'aal2');
update ov set v = public.admin_overview(current_date - 29, current_date, false) -> 'kpis';
select tests.logout();
select is((select (v -> 'runs' ->> 'value')::numeric from ov),
  (select count(*)::numeric from public.runs where deleted_at is null and validity <> 'invalid'
     and started_at >= ((current_date - 29)::timestamp at time zone 'Europe/Paris') and started_at < ((current_date + 1)::timestamp at time zone 'Europe/Paris')),
  'référence : nombre de courses sur 30 jours');
select is((select (v -> 'signups' ->> 'value')::numeric from ov),
  (select count(*)::numeric from private.user_directory
     where signed_up_at >= ((current_date - 29)::timestamp at time zone 'Europe/Paris') and signed_up_at < ((current_date + 1)::timestamp at time zone 'Europe/Paris')),
  'référence : inscriptions sur 30 jours');
select * from finish();
rollback;
