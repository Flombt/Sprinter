-- Phase 3 : tracés GPS (§8, §14 phase 3).
begin;
select plan(17);
-- Depuis 0013, les écritures de synchronisation exigent les flags actifs côté serveur.
update public.app_config set value = 'true' where key in ('accounts_enabled', 'sync_enabled');
create temporary table ids (name text primary key, id uuid) on commit drop;
grant select on ids to authenticated;
insert into ids values ('a', tests.create_user('a@example.test')), ('b', tests.create_user('b@example.test'));
select tests.create_session(id) from ids;
update public.app_config set value = 'true' where key = 'routes_sync_enabled';

select tests.login_as((select id from ids where name = 'a'));
select public.record_consent('cloud_sync_runs', '2026-11', true, gen_random_uuid(), now() - interval '1 hour');
select public.sync_push_runs(jsonb_build_array(tests.run_item('t1', now() - interval '1 day', 10000, 3000, now() - interval '2 hours')));
-- Sauvegarde des parcours non choisie : envoi refusé.
select throws_ok(format($$insert into storage.objects (bucket_id, name, owner) values ('run-tracks', '%s/dDE.json.gz', auth.uid())$$, (select id from ids where name = 'a')),
  '42501', null, 'envoi refusé sans choix explicite des parcours');
select public.record_consent('cloud_sync_routes', '2026-11', true, gen_random_uuid(), now() - interval '30 minutes');
select lives_ok(format($$insert into storage.objects (bucket_id, name, owner) values ('run-tracks', '%s/dDE.json.gz', auth.uid())$$, (select id from ids where name = 'a')),
  'envoi autorisé avec les deux sauvegardes');
select throws_ok(format($$insert into storage.objects (bucket_id, name, owner) values ('run-tracks', '%s/dDE.json.gz', auth.uid())$$, (select id from ids where name = 'b')),
  '42501', null, 'écriture dans le dossier d''un autre utilisateur refusée');
select throws_ok(format($$insert into storage.objects (bucket_id, name, owner) values ('run-tracks', '%s/../x.json.gz', auth.uid())$$, (select id from ids where name = 'a')),
  '42501', null, 'chemin hors format refusé');
select is(public.sync_register_route('t1', (select id from ids where name = 'a')::text || '/dDE.json.gz', 3600, 120000, null) ->> 'registered', 'true', 'tracé enregistré');
select is((select has_route from public.runs where id = 't1'), true, 'la course signale son tracé');
select throws_ok($$select public.sync_register_route('t1', 'autre/dDE.json.gz', 1, 1, null)$$, '22023', null, 'chemin d''un autre dossier refusé');
select throws_ok(format($$select public.sync_register_route('t1', '%s/absent.json.gz', 1, 1, null)$$, (select id from ids where name = 'a')), 'P0002', null, 'objet absent refusé');
select tests.logout();

select tests.login_as((select id from ids where name = 'b'));
select is((select count(*)::int from storage.objects where bucket_id = 'run-tracks'), 0, 'B ne voit pas les fichiers de A');
select is((select count(*)::int from public.run_routes), 0, 'B ne voit pas les tracés de A');
select tests.logout();

-- Retrait du choix : nouvel envoi refusé, suppression toujours possible.
select tests.login_as((select id from ids where name = 'a'));
select public.record_consent('cloud_sync_routes', '2026-11', false, gen_random_uuid(), now());
create temporary table changed (n int) on commit drop;
grant select, insert on changed to authenticated;
with updated as (update storage.objects set metadata = '{"replaced":true}' where bucket_id = 'run-tracks' returning 1)
insert into changed select count(*) from updated;
select is((select n from changed), 0, 'remplacement refusé après retrait (aucune ligne modifiable)');
select throws_ok(format($$select public.sync_register_route('t1', '%s/dDE.json.gz', 1, 1, null)$$, (select id from ids where name = 'a')), '42501', null, 'enregistrement refusé après retrait');
select is((public.sync_delete_routes() ->> 'deleted')::int, 1, 'supprimer mes parcours en ligne');
select is((select count(*)::int from public.run_routes), 0, 'références supprimées');
-- Comme l'API Storage, autoriser le DELETE des métadonnées pour ces objets de test.
select set_config('storage.allow_delete_query', 'true', true);
with deleted as (
  delete from storage.objects
   where bucket_id = 'run-tracks' and name = (select id::text || '/dDE.json.gz' from ids where name = 'a')
  returning 1
)
select is((select count(*)::int from deleted), 1, 'le titulaire supprime son fichier');
select set_config('storage.allow_delete_query', 'false', true);
select tests.logout();
select is((select count(*)::int from storage.objects where name like '%dDE.json.gz'), 0, 'le fichier a bien disparu');
select is((select count(*)::int from private.storage_purge_queue where path like '%dDE.json.gz'), 1, 'fichier mis en file de purge');
select * from finish();
rollback;
