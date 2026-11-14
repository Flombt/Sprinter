-- Phase 2 : synchronisation (§7, §9.1, §14 phase 2).
begin;
select plan(42);

create temporary table ids (name text primary key, id uuid) on commit drop;
grant select on ids to anon, authenticated;
insert into ids values ('a', tests.create_user('a@example.test')), ('b', tests.create_user('b@example.test'));
insert into ids values ('sa', tests.create_session((select id from ids where name = 'a'))),
                       ('sb', tests.create_session((select id from ids where name = 'b')));
create temporary table batch (n int primary key, payload jsonb) on commit drop;
grant select on batch to authenticated;
insert into batch values (1, jsonb_build_array(
  tests.run_item('r1', now() - interval '3 days', 5000, 1500, now() - interval '2 hours'),
  tests.run_item('r2', now() - interval '2 days', 8000, 2600, now() - interval '2 hours'),
  tests.run_item('healthkit:0f1e2d3c-4b5a-4968-8776-655443322110', now() - interval '1 day', 3000, 1000, now() - interval '2 hours', null, 'healthkit')));

-- Compte vide sur une connexion neuve : la réception répond sans erreur.
select tests.login_as((select id from ids where name = 'a'));
select is(jsonb_array_length(public.sync_pull(null, null, 200) -> 'items'), 0, 'compte vide : réception sans erreur');

-- Sauvegarde non activée : rien n'est écrit -------------------------------------------------
select is((select count(*)::int from jsonb_array_elements(public.sync_push_runs((select payload from batch where n = 1))) e where e ->> 'reason' = 'backup_disabled'),
  3, 'sans sauvegarde activée, les courses restent sur l''appareil');
select is((select count(*)::int from public.runs), 0, 'aucune ligne serveur avant le choix explicite');
select is(public.record_consent('cloud_sync_runs', '2026-11', true, gen_random_uuid(), now()) ->> 'status', 'applied', 'sauvegarde activée');

-- Rejeu du même lot trois fois : exactement trois lignes ----------------------------------------
select is((select count(*)::int from jsonb_array_elements(public.sync_push_runs((select payload from batch where n = 1))) e where e ->> 'status' = 'applied'), 3, 'premier envoi appliqué');
select is((select count(*)::int from jsonb_array_elements(public.sync_push_runs((select payload from batch where n = 1))) e where e ->> 'status' = 'ignored_stale'), 3, 'deuxième envoi ignoré');
select is((select count(*)::int from jsonb_array_elements(public.sync_push_runs((select payload from batch where n = 1))) e where e ->> 'status' = 'ignored_stale'), 3, 'troisième envoi ignoré');
select is((select count(*)::int from public.runs), 3, 'exactement trois lignes serveur');
select is((select source from public.runs where id like 'healthkit:%'), 'healthkit', 'import Santé conservé avec sa source');
select is((select session_type from public.runs where id = 'r1'), 'free', 'type de séance dérivé du payload');

-- Le client ne choisit ni le propriétaire, ni la validité, ni les colonnes dérivées ---------------
select lives_ok($$select public.sync_push_runs(jsonb_build_array(tests.run_item('forced', now() - interval '5 hours', 4000, 1300)
  || jsonb_build_object('user_id', (select id from ids where name = 'b'), 'validity', 'valid', 'distance_m', 1)))$$, 'envoi avec user_id forcé');
select is((select user_id from public.runs where id = 'forced'), (select id from ids where name = 'a'), 'user_id := auth.uid(), jamais celui du payload');
select is((select distance_m from public.runs where id = 'forced'), 4000.0, 'distance dérivée du payload, pas du client');
select is((select (e ->> 'reason') from jsonb_array_elements(public.sync_push_runs(jsonb_build_array(
  tests.run_item('with-points', now() - interval '6 hours', 4000, 1300) || jsonb_build_object('payload',
  (tests.run_item('with-points', now() - interval '6 hours', 4000, 1300) -> 'payload') || '{"points":[{"id":0}]}'::jsonb)))) e),
  'points_not_allowed', 'aucun point GPS dans les courses');
select is((select (e ->> 'reason') from jsonb_array_elements(public.sync_push_runs(jsonb_build_array(
  tests.run_item('healthkit-wrong', now() - interval '7 hours', 4000, 1300, now(), null, 'healthkit')))) e), 'bad_source', 'source Santé cohérente avec l''identifiant');
select throws_ok($$select public.sync_push_runs((select jsonb_agg(tests.run_item('x' || g, now(), 1000, 300)) from generate_series(1, 51) g))$$,
  '22023', null, 'lot de plus de 50 courses refusé');

-- Dernier écrit gagne, la suppression l'emporte --------------------------------------------------
select is((select e ->> 'status' from jsonb_array_elements(public.sync_push_runs(jsonb_build_array(
  tests.run_item('r1', now() - interval '3 days', 5100, 1500, now() - interval '3 hours')))) e), 'ignored_stale', 'version plus ancienne ignorée');
select is((select e ->> 'status' from jsonb_array_elements(public.sync_push_runs(jsonb_build_array(
  tests.run_item('r1', now() - interval '3 days', 5200, 1500, now())))) e), 'applied', 'version plus récente appliquée');
select is((select distance_m from public.runs where id = 'r1'), 5200.0, 'modification enregistrée');
select is((select e ->> 'status' from jsonb_array_elements(public.sync_delete_runs(array['r2'])) e), 'deleted', 'suppression : tombstone');
select is((select e ->> 'status' from jsonb_array_elements(public.sync_push_runs(jsonb_build_array(
  tests.run_item('r2', now() - interval '2 days', 9000, 2600, now() + interval '1 day')))) e), 'ignored_deleted', 'une modification tardive ne ressuscite pas une course supprimée');
select is((select payload from public.runs where id = 'r2'), '{}'::jsonb, 'tombstone vidée de son contenu');
select is((select e ->> 'status' from jsonb_array_elements(public.sync_delete_runs(array['never-synced'])) e), 'already_deleted', 'suppression d''une course inconnue : tombstone créée');
select is((select e ->> 'status' from jsonb_array_elements(public.sync_push_runs(jsonb_build_array(
  tests.run_item('never-synced', now() - interval '10 hours', 5000, 1500)))) e), 'ignored_deleted', 'pas de résurrection après suppression hors ligne');

-- Réception par curseur ---------------------------------------------------------------------------
select is(jsonb_array_length(public.sync_pull(null, null, 200) -> 'items'), 5, 'réception complète, tombstones incluses');
select ok(public.sync_pull(null, null, 200) -> 'next_cursor' = 'null'::jsonb, 'curseur nul en fin de liste');
select is(jsonb_array_length(public.sync_pull(null, null, 2) -> 'items'), 2, 'pagination');
select is((public.sync_pull(null, null, 200) #>> '{items,0,payload,id}') is not null, true, 'payload transmis pour les courses actives');
select is((select count(*)::int from jsonb_array_elements(public.sync_pull(null, null, 200) -> 'items') e where (e ->> 'deleted')::boolean and e -> 'payload' = 'null'::jsonb), 2,
  'tombstones sans contenu');
select is(jsonb_array_length(public.sync_list_ids(null, 1000) -> 'ids'), 3, 'identifiants des seules courses non supprimées');
select tests.logout();

-- Isolation entre comptes ----------------------------------------------------------------------------
select tests.login_as((select id from ids where name = 'b'));
select is(jsonb_array_length(public.sync_pull(null, null, 200) -> 'items'), 0, 'B ne reçoit rien de A');
select is((select count(*)::int from public.runs), 0, 'B ne lit aucune course de A');
select tests.logout();

-- Règles de validité (§9.1), une par cas --------------------------------------------------------------
select tests.login_as((select id from ids where name = 'a'));
select public.sync_push_runs(jsonb_build_array(
  tests.run_item('v-unfinished', now() - interval '20 days', 5000, 1500) || jsonb_build_object('payload', (tests.run_item('v-unfinished', now() - interval '20 days', 5000, 1500) -> 'payload') - 'endedAt'),
  tests.run_item('v-short', now() - interval '21 days', 90, 25),
  tests.run_item('v-date', timestamptz '1999-06-01', 5000, 1500),
  tests.run_item('v-vehicle', now() - interval '22 days', 20000, 1000),
  tests.run_item('v-superhuman', now() - interval '23 days', 5000, 590),
  tests.run_item('v-fast', now() - interval '24 days', 5000, 700),
  tests.run_item('v-gps', now() - interval '25 days', 5000, 1500, now(), 600),
  tests.run_item('v-overlap-a', now() - interval '26 days', 5000, 1500),
  tests.run_item('v-overlap-b', now() - interval '26 days' + interval '10 minutes', 3000, 900)));
select is((select validity_reasons from public.runs where id = 'v-unfinished'), array['unfinished'], 'règle : course non terminée');
select is((select validity_reasons from public.runs where id = 'v-short'), array['too_short'], 'règle : trop courte');
select is((select validity_reasons from public.runs where id = 'v-date'), array['bad_date'], 'règle : date impossible');
select is((select validity || ':' || array_to_string(validity_reasons, ',') from public.runs where id = 'v-vehicle'), 'invalid:vehicle_speed,superhuman_pace', 'règle : vitesse de véhicule');
select is((select validity || ':' || array_to_string(validity_reasons, ',') from public.runs where id = 'v-superhuman'), 'invalid:superhuman_pace', 'règle : allure surhumaine');
select is((select validity || ':' || array_to_string(validity_reasons, ',') from public.runs where id = 'v-fast'), 'suspect:very_fast', 'règle : allure très rapide');
select is((select validity || ':' || array_to_string(validity_reasons, ',') from public.runs where id = 'v-gps'), 'suspect:low_gps_reliability', 'règle : fiabilité GPS faible');
select is((select validity || ':' || array_to_string(validity_reasons, ',') from public.runs where id = 'v-overlap-b'), 'suspect:overlap', 'règle : chevauchement (la plus récente)');

-- Réglages portables -------------------------------------------------------------------------------
select is(public.sync_push_preferences('{"audioEnabled":true,"backgroundEnabled":false,"spotifyToken":"x"}', now()) ->> 'status', 'applied', 'réglages portables enregistrés');
select is((select data from public.user_preferences), '{"audioEnabled": true}'::jsonb, 'seuls les réglages portables sont conservés');
select tests.logout();

select * from finish();
rollback;
