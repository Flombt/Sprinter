-- Phase 4b : recherche, fiche et actions (§10.4, §14 4b).
begin;
select plan(27);
-- Les agrégats admin portent sur tous les comptes : la graine synthétique de la CI est effacée pour ce test.
select tests.clear_seed();

create temporary table ids (name text primary key, id uuid) on commit drop;
grant select on ids to authenticated, anon;
insert into ids values
  ('owner', tests.create_user('owner@example.test')), ('support', tests.create_user('support@example.test')),
  ('analyst', tests.create_user('analyst@example.test')),
  ('t1', tests.create_user('zoe.martin-test@example.test', 'google')), ('t2', tests.create_user('zoe.durand-test@example.test', 'apple')),
  ('t3', tests.create_user('leo.petit-test@example.test'));
insert into private.admin_users (user_id, role) values ((select id from ids where name = 'owner'), 'owner'),
  ((select id from ids where name = 'support'), 'support'), ((select id from ids where name = 'analyst'), 'analyst');
select tests.create_session(id) from ids;
update public.profiles set display_name = 'Zoé Martin', country_code = 'FR', city = 'Lyon', age_band = '25-34' where user_id = (select id from ids where name = 't1');
update public.profiles set display_name = 'Zoe Durand', country_code = 'BE' where user_id = (select id from ids where name = 't2');
update public.profiles set display_name = 'Léo Petit', country_code = 'FR' where user_id = (select id from ids where name = 't3');
insert into public.user_devices (user_id, device_id, platform, app_version) values
  ((select id from ids where name = 't1'), gen_random_uuid(), 'android', '7.7.7'), ((select id from ids where name = 't2'), gen_random_uuid(), 'ios', '7.7.7');
insert into public.runs (user_id, id, started_at, ended_at, active_s, distance_m, reliable_s, payload, client_updated_at)
select (select id from ids where name = 't1'), 'z' || g, now() - (g || ' days')::interval, now() - (g || ' days')::interval + interval '30 minutes', 1500, 5000, 1500, '{}', now()
from generate_series(1, 6) g;
create temporary table res (k text primary key, v jsonb) on commit drop;
grant select, insert, update on res to authenticated;

-- Recherche --------------------------------------------------------------------------------------
select tests.login_as((select id from ids where name = 'owner'), null, 'aal2');
insert into res values ('email', public.admin_search_users('zoe.martin-test@example.test'));
insert into res values ('prefix', public.admin_search_users('zoe.'));
insert into res values ('name', public.admin_search_users('zoé'));
insert into res values ('short', public.admin_search_users(left(replace((select id from ids where name = 't3')::text, '-', ''), 8)));
insert into res values ('combined', public.admin_search_users(null, jsonb_build_object('platform', jsonb_build_array('android'), 'runs_min', 5,
  'signup_from', current_date - 1, 'signup_to', current_date)));
insert into res values ('page1', public.admin_search_users(null, '{"country":["FR","BE"]}', 'display_name', null, 2));
update res set v = public.admin_search_users(null, '{"country":["FR","BE"]}', 'display_name', (select v -> 'next_cursor' from res where k = 'page1'), 2) where k = 'page1';
select tests.logout();
select is((select jsonb_array_length(v -> 'items') from res where k = 'email'), 1, 'recherche par e-mail complet');
select is((select v #>> '{items,0,email_masked}' from res where k = 'email'), 'z***@example.test', 'e-mail masqué dans la liste');
select ok((select position('zoe.martin' in v::text) = 0 from res where k = 'email'), 'aucun e-mail complet dans les résultats');
select is((select (v ->> 'total')::int from res where k = 'prefix'), 2, 'recherche par préfixe d''e-mail');
select is((select (v ->> 'total')::int from res where k = 'name'), 2, 'nom partiel sans accents ni casse');
select is((select v #>> '{items,0,user_id}' from res where k = 'short')::uuid, (select id from ids where name = 't3'), 'recherche par identifiant court');
select is((select (v ->> 'total')::int from res where k = 'combined'), 1, 'filtres combinés (inscrits récemment + Android + ≥ 5 courses)');
select is((select v #>> '{items,0,user_id}' from res where k = 'combined')::uuid, (select id from ids where name = 't1'), 'résultat identique à la requête de référence');
select is((select jsonb_array_length(v -> 'items') from res where k = 'page1'), 1, 'pagination keyset : page suivante');
select tests.login_as((select id from ids where name = 'owner'), null, 'aal2');
select throws_ok($$select public.admin_search_users(null, '{"age":30}')$$, '22023', 'invalid_parameter:filters.age', 'aucun filtre sur l''âge');
select throws_ok($$select public.admin_search_users(null, '{"address":"x"}')$$, '22023', null, 'aucun filtre sur l''adresse');
select throws_ok($$select public.admin_search_users(null, '{}', 'email')$$, '22023', 'invalid_parameter:sort', 'tri hors liste blanche refusé');
select tests.logout();
select is((select count(*)::int from private.admin_audit_logs where action = 'user.search'), 7, 'chaque recherche est journalisée');
select ok((select bool_and(position('zoe' in metadata::text) = 0 and position('@' in metadata::text) = 0) from private.admin_audit_logs where action = 'user.search'),
  'audit sans texte de recherche ni e-mail');
select tests.login_as((select id from ids where name = 'analyst'), null, 'aal2');
select throws_ok($$select public.admin_search_users('zoe')$$, '42501', 'forbidden', 'analyst : recherche refusée');
select tests.logout();

-- Fiche -----------------------------------------------------------------------------------------------
select tests.login_as((select id from ids where name = 'owner'), null, 'aal2');
select throws_ok(format($$select public.admin_get_user('%s', null)$$, (select id from ids where name = 't1')), '22023', 'reason_required', 'fiche impossible sans motif');
insert into res values ('card', public.admin_get_user((select id from ids where name = 't1'), 'support', 'ticket 42'));
select tests.logout();
select is((select v ->> 'email' from res where k = 'card'), 'zoe.martin-test@example.test', 'e-mail complet uniquement dans la fiche');
select is((select v ->> 'age_band' from res where k = 'card'), '25-34', 'owner voit la tranche d''âge');
select ok((select position('"points"' in v::text) = 0 and not (v ? 'runs') from res where k = 'card'), 'aucun détail de course ni tracé');
select is((select reason from private.admin_audit_logs where action = 'user.view' order by id desc limit 1), 'support · ticket 42', 'consultation journalisée avec le motif');
select tests.login_as((select id from ids where name = 'support'), null, 'aal2');
update res set v = public.admin_get_user((select id from ids where name = 't1'), 'support') where k = 'card';
select tests.logout();
select ok((select v -> 'age_band' = 'null'::jsonb and (v ->> 'age_band_hidden')::boolean from res where k = 'card'), 'support ne voit pas la tranche d''âge');

-- Actions -------------------------------------------------------------------------------------------
select tests.login_as((select id from ids where name = 'owner'), null, 'aal2', 3600);
select throws_ok(format($$select public.admin_authorize_user_action('%s', 'disable', 'support')$$, (select id from ids where name = 't2')), '42501', 'reauth_required',
  'désactivation : ré-authentification < 5 min exigée');
select tests.logout();
select tests.login_as((select id from ids where name = 'owner'), null, 'aal2', 30);
select is(public.admin_authorize_user_action((select id from ids where name = 't2'), 'disable', 'support') ->> 'status', 'disabled', 'compte désactivé');
select tests.logout();
select tests.login_as((select id from ids where name = 't2'));
select is((select count(*)::int from public.profiles), 0, 'compte désactivé : plus aucun accès, même avec un ancien JWT');
select tests.logout();
select tests.login_as((select id from ids where name = 'owner'), null, 'aal2', 30);
select is(public.admin_authorize_user_action((select id from ids where name = 't2'), 'enable', 'support') ->> 'status', 'active', 'réactivation');
select throws_ok(format($$select public.admin_authorize_user_action('%s', 'process_deletion', 'data_request', null, 'SUPPRIMER')$$, (select id from ids where name = 't3')),
  '22023', 'confirmation_mismatch', 'suppression : confirmation typée exigée');
select is(public.admin_authorize_user_action((select id from ids where name = 't3'), 'process_deletion', 'data_request', null,
  'SUPPRIMER ' || left(replace((select id from ids where name = 't3')::text, '-', ''), 8)) ->> 'action', 'process_deletion', 'suppression autorisée avec la confirmation');
select tests.logout();
select * from finish();
rollback;
