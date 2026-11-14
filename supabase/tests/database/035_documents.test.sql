-- Phase 2b : entités secondaires (§7.9).
begin;
select plan(9);
-- Depuis 0013, les écritures de synchronisation exigent les flags actifs côté serveur.
update public.app_config set value = 'true' where key in ('accounts_enabled', 'sync_enabled');
create temporary table ids (name text primary key, id uuid) on commit drop;
grant select on ids to authenticated;
insert into ids values ('a', tests.create_user('a@example.test')), ('b', tests.create_user('b@example.test'));
select tests.create_session(id) from ids;

select tests.login_as((select id from ids where name = 'a'));
select is((public.sync_push_documents('[{"kind":"shoe","id":"s1","client_updated_at":"2026-11-01T00:00:00Z","payload":{"name":"Trail"}}]') -> 0 ->> 'reason'),
  'backup_disabled', 'sans sauvegarde, rien n''est envoyé');
select public.record_consent('cloud_sync_runs', '2026-11', true, gen_random_uuid(), now());
select is((public.sync_push_documents('[{"kind":"shoe","id":"s1","client_updated_at":"2026-11-01T00:00:00Z","payload":{"name":"Trail"}}]') -> 0 ->> 'status'), 'applied', 'chaussure enregistrée');
select is((public.sync_push_documents('[{"kind":"shoe","id":"s1","client_updated_at":"2026-10-01T00:00:00Z","payload":{"name":"Ancien"}}]') -> 0 ->> 'status'), 'ignored_stale', 'version plus ancienne ignorée');
select is((public.sync_push_documents('[{"kind":"route","id":"r1","client_updated_at":"2026-11-01T00:00:00Z","payload":{"name":"Boucle"}}]') -> 0 ->> 'reason'),
  'backup_disabled', 'itinéraire refusé sans la sauvegarde des parcours');
select is((public.sync_push_documents('[{"kind":"shoe","id":"s1","client_updated_at":"2026-11-02T00:00:00Z","deleted":true}]') -> 0 ->> 'status'), 'applied', 'suppression enregistrée');
select is((public.sync_push_documents('[{"kind":"shoe","id":"s1","client_updated_at":"2026-11-03T00:00:00Z","payload":{"name":"Retour"}}]') -> 0 ->> 'status'), 'ignored_deleted', 'pas de résurrection');
select is(jsonb_array_length(public.sync_pull_documents() -> 'items'), 1, 'réception, tombstone incluse');
select throws_ok($$insert into public.synced_documents (user_id, kind, id, payload, client_updated_at) values (auth.uid(), 'shoe', 'x', '{}', now())$$, '42501', null, 'écriture directe refusée');
select tests.logout();
select tests.login_as((select id from ids where name = 'b'));
select is(jsonb_array_length(public.sync_pull_documents() -> 'items'), 0, 'B ne reçoit rien de A');
select * from finish();
rollback;
