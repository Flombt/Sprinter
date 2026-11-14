-- Phase 0 : RLS, privilèges et état des comptes (§5.3, §14 phase 0).
begin;
select plan(32);

-- Structure -------------------------------------------------------------------------
select is(
  (select count(*)::int from pg_tables where schemaname = 'public' and not rowsecurity),
  0, 'aucune table public sans RLS');
select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname in ('public', 'authz', 'private') and p.prosecdef and has_function_privilege('anon', p.oid, 'execute')),
  0, 'aucune fonction SECURITY DEFINER exécutable par anon');
select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'private' and has_function_privilege('authenticated', p.oid, 'execute')),
  0, 'aucune fonction private exécutable par authenticated');
select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname in ('public', 'authz', 'private') and p.prosecdef
     and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c in ('search_path=""', 'search_path=')) ),
  0, 'toute fonction SECURITY DEFINER fixe search_path vide');
select ok(not has_schema_privilege('authenticated', 'private', 'usage'), 'schéma private inaccessible à authenticated');
select ok(not has_schema_privilege('anon', 'private', 'usage'), 'schéma private inaccessible à anon');
select ok(not has_schema_privilege('anon', 'authz', 'usage'), 'schéma authz inaccessible à anon');

-- Données de test ---------------------------------------------------------------------
create temporary table ids (name text primary key, id uuid) on commit drop;
grant select on ids to anon, authenticated;
insert into ids values ('a', tests.create_user('a@example.test')), ('b', tests.create_user('b@example.test', 'apple'));
insert into ids values ('sa', tests.create_session((select id from ids where name = 'a'))),
                       ('sb', tests.create_session((select id from ids where name = 'b')));
update public.profiles set display_name = 'Coureur B', city = 'Lyon' where user_id = (select id from ids where name = 'b');
insert into public.support_requests (user_id, category, message, internal_note)
values ((select id from ids where name = 'a'), 'bug', 'Le bouton ne répond pas', 'note interne confidentielle');

select is((select providers from private.user_directory where user_id = (select id from ids where name = 'b')),
  array['apple'], 'annuaire alimenté par trigger avec le fournisseur');
select is((select count(*)::int from public.profiles where user_id in (select id from ids)), 2, 'profil vide créé à l''inscription');
insert into auth.identities (provider_id, user_id, provider, email)
values ('google-b', (select id from ids where name = 'b'), 'google', 'b@example.test');
select is((select providers from private.user_directory where user_id = (select id from ids where name = 'b')),
  array['apple', 'google'], 'ajout d''une méthode reflété dans l''annuaire');

-- anon ------------------------------------------------------------------------------
select tests.login_anon();
select is((select count(*)::int from public.app_config), 2, 'anon lit app_config (valeurs publiques)');
select throws_ok('select * from public.profiles', '42501', null, 'anon ne lit pas profiles');
select throws_ok('select * from public.runs', '42501', null, 'anon ne lit pas runs');
select throws_ok($$insert into public.app_config (key, value) values ('x', 'true')$$, '42501', null, 'anon n''écrit pas app_config');
select tests.logout();

insert into public.app_config (key, value, is_public) values ('internal_only', '1', false);
select tests.login_anon();
select is((select count(*)::int from public.app_config where key = 'internal_only'), 0, 'valeur non publique invisible');
select tests.logout();

-- Propriétaire ----------------------------------------------------------------------
select tests.login_as((select id from ids where name = 'a'));
select is((select count(*)::int from public.profiles), 1, 'A ne voit que son profil');
select is((select count(*)::int from public.profiles where display_name = 'Coureur B'), 0, 'A ne voit pas le profil de B');
select lives_ok($$update public.profiles set display_name = 'Coureuse A', age_band = '25-34' where true$$, 'A modifie les champs autorisés');
select throws_ok($$update public.profiles set user_id = gen_random_uuid()$$, '42501', null, 'user_id non modifiable');
select throws_ok($$update public.profiles set created_at = now()$$, '42501', null, 'created_at non modifiable');
select is((select count(*)::int from public.profiles where display_name = 'Coureur B'), 0, 'la mise à jour n''a pas touché B');
select throws_ok($$insert into public.runs (user_id, id, started_at, active_s, distance_m, payload, client_updated_at)
  values (auth.uid(), 'x', now(), 10, 10, '{}', now())$$, '42501', null, 'écriture directe sur runs refusée');
select throws_ok($$insert into public.consent_log (user_id, purpose, version, granted, client_event_id, client_at)
  values (auth.uid(), 'terms', '1', true, gen_random_uuid(), now())$$, '42501', null, 'écriture directe sur consent_log refusée');
select is((select count(*)::int from public.support_requests), 1, 'A lit sa demande de support');
select throws_ok('select internal_note from public.support_requests', '42501', null, 'note interne invisible pour le titulaire');
select throws_ok('select * from private.admin_users', '42501', null, 'tables private inaccessibles');
select tests.logout();

-- Compte désactivé, session révoquée, suppression en cours -----------------------------
update private.user_directory set status = 'disabled' where user_id = (select id from ids where name = 'a');
select tests.login_as((select id from ids where name = 'a'), (select id from ids where name = 'sa'));
select is((select count(*)::int from public.profiles), 0, 'compte désactivé : aucune donnée avec un JWT encore valide');
select tests.logout();
update private.user_directory set status = 'active' where user_id = (select id from ids where name = 'a');

delete from auth.sessions where id = (select id from ids where name = 'sa');
select tests.login_as((select id from ids where name = 'a'), (select id from ids where name = 'sa'));
select is((select count(*)::int from public.profiles), 0, 'session révoquée : ancien JWT sans accès');
select tests.logout();

update private.user_directory set status = 'deleting' where user_id = (select id from ids where name = 'b');
select tests.login_as((select id from ids where name = 'b'), (select id from ids where name = 'sb'));
select is((select count(*)::int from public.profiles), 0, 'suppression validée : accès retirés immédiatement');
select tests.logout();

-- Journal d'administration append-only ---------------------------------------------------
insert into private.admin_audit_logs (action, metadata) values ('config.write', '{"key":"sync_enabled"}');
select throws_ok($$update private.admin_audit_logs set reason = 'x'$$, '42501', null, 'audit : UPDATE refusé');
select throws_ok($$delete from private.admin_audit_logs$$, '42501', null, 'audit : DELETE refusé');
select lives_ok($$select set_config('private.purging_audit', 'on', true); delete from private.admin_audit_logs where at < now() - interval '13 months'$$,
  'audit : purge de rétention autorisée');

select * from finish();
rollback;
