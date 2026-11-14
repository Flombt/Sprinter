-- Phase 4d : configuration, coupure serveur, support, qualité, exports, rétention.
begin;
select plan(26);
create temporary table ids (name text primary key, id uuid) on commit drop;
grant select on ids to authenticated, anon;
insert into ids values ('owner', tests.create_user('owner@example.test')), ('support', tests.create_user('support@example.test')),
  ('user', tests.create_user('user@example.test')), ('idle', tests.create_user('idle@example.test'));
insert into private.admin_users (user_id, role) values ((select id from ids where name = 'owner'), 'owner'), ((select id from ids where name = 'support'), 'support');
select tests.create_session(id) from ids;
create temporary table res (k text primary key, v jsonb) on commit drop;
grant select, insert, update on res to authenticated;

-- Configuration ------------------------------------------------------------------------------------
select tests.login_as((select id from ids where name = 'support'), null, 'aal2', 30);
select ok(jsonb_array_length(public.admin_get_config() -> 'items') >= 12, 'support lit la configuration');
select throws_ok($$select public.admin_set_config('sync_enabled', 'true', 'activation staging')$$, '42501', 'forbidden', 'support ne modifie pas la configuration');
select tests.logout();
select tests.login_as((select id from ids where name = 'owner'), null, 'aal2', 3600);
select throws_ok($$select public.admin_set_config('sync_enabled', 'true', 'activation staging')$$, '42501', 'reauth_required', 'écriture : ré-authentification exigée');
select tests.logout();
select tests.login_as((select id from ids where name = 'owner'), null, 'aal2', 30);
select throws_ok($$select public.admin_set_config('unknown_flag', 'true', 'test')$$, '22023', 'invalid_parameter:key', 'clé inconnue refusée');
select throws_ok($$select public.admin_set_config('sync_enabled', '"oui"', 'test')$$, '22023', 'invalid_parameter:value', 'valeur hors schéma refusée');
select throws_ok($$select public.admin_set_config('min_version', '{"ios":"1.0"}', 'test')$$, '22023', 'invalid_parameter:value', 'version minimale validée');
select throws_ok($$select public.admin_set_config('maintenance', '{"enabled":true,"message":"x","extra":1}', 'test')$$, '22023', 'invalid_parameter:value', 'maintenance validée');
select is(public.admin_set_config('min_version', '{"ios":"1.2.0","android":"1.1.0"}', 'correctif critique') ->> 'key', 'min_version', 'version minimale enregistrée');
select lives_ok($$select public.admin_set_config('support_enabled', 'true', 'ouverture du support')$$, 'support activé');
select tests.logout();
select is((select metadata ->> 'key' from private.admin_audit_logs where action = 'config.write' order by id desc limit 1), 'support_enabled', 'écriture de configuration journalisée');
select tests.login_anon();
select is((select value ->> 'ios' from public.app_config where key = 'min_version'), '1.2.0', 'l''app lit la nouvelle version minimale sans compte');
select tests.logout();

-- Coupure côté serveur --------------------------------------------------------------------------------
select tests.login_as((select id from ids where name = 'user'));
select public.record_consent('cloud_sync_runs', '2026-11', true, gen_random_uuid(), now());
select throws_ok($$select public.sync_push_runs(jsonb_build_array(tests.run_item('k1', now() - interval '1 day', 5000, 1500)))$$, 'P0001', 'sync_disabled',
  'flags éteints : écriture de synchro refusée par le serveur, sans attendre le cache de l''app');
select tests.logout();
update public.app_config set value = 'true' where key in ('accounts_enabled', 'sync_enabled');
select tests.login_as((select id from ids where name = 'user'));
select is((public.sync_push_runs(jsonb_build_array(tests.run_item('k1', now() - interval '1 day', 5000, 1500))) -> 0 ->> 'status'), 'applied', 'flags actifs : écriture acceptée');

-- Support -------------------------------------------------------------------------------------------
insert into res values ('ticket', public.submit_support_request('00000000-0000-4000-8000-000000000001', 'sync', 'Mes courses ne se synchronisent plus.', 'ios', '1.0.0'));
select is(public.submit_support_request('00000000-0000-4000-8000-000000000001', 'sync', 'Mes courses ne se synchronisent plus.', 'ios', '1.0.0') ->> 'duplicate', 'true', 'demande idempotente');
select lives_ok($$select public.submit_support_request(gen_random_uuid(), 'bug', 'Deux', null, null); select public.submit_support_request(gen_random_uuid(), 'bug', 'Trois', null, null);
  select public.submit_support_request(gen_random_uuid(), 'bug', 'Quatre', null, null); select public.submit_support_request(gen_random_uuid(), 'bug', 'Cinq', null, null)$$, 'cinq demandes par jour');
select throws_ok($$select public.submit_support_request(gen_random_uuid(), 'bug', 'Six', null, null)$$, 'P0001', 'rate_limited', 'limite de 5 demandes par jour');
select tests.logout();
select tests.login_as((select id from ids where name = 'support'), null, 'aal2');
select is((public.admin_list_support(array['open']) -> 'items' -> -1 ->> 'category'), 'sync', 'demande visible dans l''admin');
insert into res values ('closed', public.admin_update_support('00000000-0000-4000-8000-000000000001', 'closed', 'Résolu après reconnexion.'));
select is((select v ->> 'status' from res where k = 'closed'), 'closed', 'statut et note interne');
select ok((select v ->> 'closed_at' is not null from res where k = 'closed'), 'date de clôture renseignée');
select ok(public.admin_quality(current_date - 6, current_date) ? 'version_adoption', 'qualité de service');
select tests.logout();

-- Exports -------------------------------------------------------------------------------------------
select tests.login_as((select id from ids where name = 'owner'), null, 'aal2');
insert into res values ('csv', public.admin_export_aggregates('daily_kpis', current_date - 6, current_date, 'excel_fr'));
select throws_ok($$select public.admin_export_aggregates('daily_kpis', current_date - 400, current_date)$$, '22023', 'invalid_parameter:period', 'export limité à 366 jours');
select tests.logout();
select ok((select left(v ->> 'csv', 1) = chr(65279) and position(';' in v ->> 'csv') > 0 from res where k = 'csv'), 'format Excel FR : BOM et point-virgule');
select ok((select position('@' in v ->> 'csv') = 0 from res where k = 'csv'), 'aucune donnée personnelle dans l''export');
select is((select count(*)::int from private.admin_audit_logs where action = 'export.aggregates'), 1, 'export journalisé');

-- Rétention ---------------------------------------------------------------------------------------------
insert into public.runs (user_id, id, started_at, active_s, distance_m, payload, client_updated_at, deleted_at)
values ((select id from ids where name = 'user'), 'old-tombstone', now() - interval '200 days', 0, 0, '{}', now(), now() - interval '100 days');
insert into private.admin_audit_logs (at, action) values (now() - interval '13 months', 'user.view');
insert into public.activity_days (user_id, day) values ((select id from ids where name = 'user'), current_date - 800);
select is((private.job_retention() ->> 'tombstones')::int, 1, 'tombstones de plus de 90 jours purgées');
update private.user_directory set last_active_day = current_date - 705 where user_id = (select id from ids where name = 'idle');
select ok((select (select id from ids where name = 'idle') in (select user_id from public.service_inactive_accounts('warn'))), 'compte inactif depuis 23 mois à avertir');
select * from finish();
rollback;
