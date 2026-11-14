-- Phase 6 : revue de sécurité automatisée (§13.5) — fonctions SECURITY DEFINER et IDOR.
begin;
select plan(8);

-- Toute fonction publique exécutable par un utilisateur contrôle l'appelant (require_uid ou assert_admin).
select is((select string_agg(p.proname, ', ' order by p.proname) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.prosecdef and has_function_privilege('authenticated', p.oid, 'execute')
             and p.prosrc not like '%private.require_uid()%' and p.prosrc not like '%private.assert_admin(%'), null,
  'chaque RPC SECURITY DEFINER contrôle l''appelant');
select is((select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.prosecdef and p.proname like 'service\_%' and has_function_privilege('authenticated', p.oid, 'execute')), 0,
  'les fonctions de service sont inaccessibles aux utilisateurs');
select is((select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.prosecdef and p.proname like 'admin\_%' and p.prosrc not like '%private.assert_admin(%' and p.proname <> 'admin_whoami'), 0,
  'chaque RPC admin passe par assert_admin');
select is((select count(*)::int from pg_tables where schemaname in ('public') and tableowner <> 'postgres' and not rowsecurity), 0, 'RLS sur toutes les tables publiques');

-- IDOR : B ne lit aucune ligne de A, quel que soit le canal exposé.
create temporary table ids (name text primary key, id uuid) on commit drop;
grant select on ids to authenticated;
insert into ids values ('a', tests.create_user('a@example.test')), ('b', tests.create_user('b@example.test'));
select tests.create_session(id) from ids;
update public.app_config set value = 'true' where key in ('accounts_enabled', 'sync_enabled', 'support_enabled');
select tests.login_as((select id from ids where name = 'a'));
select public.record_consent('cloud_sync_runs', '1', true, gen_random_uuid(), now() - interval '1 hour');
select public.sync_push_runs(jsonb_build_array(tests.run_item('idor', now() - interval '1 day', 5000, 1500)));
select public.sync_push_preferences('{"audioEnabled":true}', now());
select public.register_device(gen_random_uuid(), 'ios', '27', '1.0.0');
select public.touch_activity(current_date);
select public.submit_support_request(gen_random_uuid(), 'bug', 'Message', null, null);
select public.sync_push_documents('[{"kind":"shoe","id":"s","client_updated_at":"2026-11-01T00:00:00Z","payload":{"name":"x"}}]');
select tests.logout();
create temporary table visible (n int) on commit drop;
grant insert, select on visible to authenticated;
select tests.login_as((select id from ids where name = 'b'));
insert into visible select (select count(*) from public.runs) + (select count(*) from public.user_preferences) + (select count(*) from public.user_devices)
  + (select count(*) from public.activity_days) + (select count(*) from public.consent_log) + (select count(*) from public.synced_documents)
  + (select count(*) from public.profiles where user_id <> auth.uid()) + (select count(*) from public.support_requests);
select is((select n from visible), 0, 'IDOR : aucune ligne de A visible par B');
select is(jsonb_array_length(public.sync_pull(null, null, 500) -> 'items'), 0, 'IDOR : la réception ne livre rien de A');
select is((public.sync_delete_runs(array['idor']) -> 0 ->> 'status'), 'already_deleted', 'IDOR : une suppression de B ne touche que B');
select tests.logout();
select is((select deleted_at is null from public.runs where id = 'idor' and user_id = (select id from ids where name = 'a')), true, 'la course de A est intacte');
select * from finish();
rollback;
