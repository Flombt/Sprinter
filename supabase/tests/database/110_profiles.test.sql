-- Phase 8a : profil personnalisé privé (éléments révisés, rejouables, médias privés, coupure serveur).
begin;
select plan(35);
create temporary table ids (name text primary key, id uuid) on commit drop;
grant select on ids to authenticated;
insert into ids values ('a', tests.create_user('profil-a@example.test')), ('b', tests.create_user('profil-b@example.test')),
  ('m1', gen_random_uuid()), ('m2', gen_random_uuid()), ('m3', gen_random_uuid()), ('w9', gen_random_uuid()),
  ('op1', gen_random_uuid()), ('op2', gen_random_uuid()), ('op3', gen_random_uuid()), ('op4', gen_random_uuid()), ('op5', gen_random_uuid());
select tests.create_session(id) from ids where name in ('a', 'b');
create temporary table r (label text primary key, v jsonb) on commit drop;
grant all on r to authenticated;
create or replace function pg_temp.item(p_key text, p_payload jsonb, p_op text, p_base int, p_prev text default null, p_deleted boolean default false)
returns jsonb language sql as $$
  select jsonb_build_array(jsonb_strip_nulls(jsonb_build_object('key', p_key, 'payload', p_payload, 'op_id', coalesce((select id::text from ids where name = p_op), p_op),
    'prev_op_id', (select id::text from ids where name = p_prev), 'base_revision', p_base, 'deleted', p_deleted, 'client_updated_at', now())))
$$;
create or replace function pg_temp.status(p_result jsonb) returns text language sql as $$ select p_result -> 'results' -> 0 ->> 'status' $$;

-- Coupure côté serveur
select tests.login_as((select id from ids where name = 'a'));
select throws_ok($$select public.profile_pull()$$, 'P0001', 'feature_disabled', 'profil éteint : aucune lecture ni écriture');
select tests.logout();
update public.app_config set value = 'true' where key in ('accounts_enabled', 'profiles_enabled');

-- Écritures révisées et rejouables
select tests.login_as((select id from ids where name = 'a'));
select is(pg_temp.status(public.profile_save(pg_temp.item('appearance', '{"theme":"espace"}', 'op1', 0))), 'applied', 'premier enregistrement appliqué');
select is(pg_temp.status(public.profile_save(pg_temp.item('appearance', '{"theme":"espace"}', 'op1', 0))), 'applied', 'rejeu de la même opération accepté');
select is((select revision from public.profile_elements where element_key = 'appearance'), 1, 'le rejeu ne crée pas de nouvelle révision');
select is(pg_temp.status(public.profile_save(pg_temp.item('appearance', '{"theme":"neon"}', 'op2', 1))), 'applied', 'modification fondée sur la révision courante');
insert into r select 'conflict', public.profile_save(pg_temp.item('appearance', '{"theme":"nature"}', gen_random_uuid()::text, 1));
select is((select v -> 'results' -> 0 ->> 'status' from r where label = 'conflict'), 'conflict', 'modification simultanée du même élément détectée');
select is((select v -> 'results' -> 0 -> 'payload' ->> 'theme' from r where label = 'conflict'), 'neon', 'la version serveur est renvoyée');
select is(pg_temp.status(public.profile_save(pg_temp.item('appearance', '{"theme":"retro"}', 'op3', 2))), 'applied', 'opération appliquée (réponse perdue)');
select is(pg_temp.status(public.profile_save(pg_temp.item('appearance', '{"theme":"pastel"}', 'op4', 2, 'op3'))), 'applied',
  'nouvelle édition après réponse perdue : pas de faux conflit');
select is(pg_temp.status(public.profile_save(pg_temp.item('about', '{"bio":"Coureuse du dimanche"}', gen_random_uuid()::text, 0))), 'applied',
  'éléments distincts : fusion sans conflit');

-- Validation des contenus
select is(public.profile_save(pg_temp.item('appearance', '{"theme":"Thème Libre!"}', gen_random_uuid()::text, 4)) -> 'results' -> 0 ->> 'reason',
  'invalid:appearance', 'identifiant de thème hors catalogue refusé');
select is(public.profile_save(pg_temp.item('about', jsonb_build_object('bio', 'a' || chr(7) || 'b'), gen_random_uuid()::text, 1)) -> 'results' -> 0 ->> 'reason',
  'invalid:about', 'caractères de contrôle refusés');
select is(public.profile_save(pg_temp.item('about', jsonb_build_object('bio', repeat('x', 191)), gen_random_uuid()::text, 1)) -> 'results' -> 0 ->> 'reason',
  'invalid:about', 'bio bornée à 190 caractères');
select is(public.profile_save(pg_temp.item('status', '{"text":"Au repos","expiresAt":"demain"}', gen_random_uuid()::text, 0)) -> 'results' -> 0 ->> 'reason',
  'invalid:status', 'date d''expiration invalide refusée');
select is(pg_temp.status(public.profile_save(pg_temp.item('status', jsonb_build_object('emoji', '🏃', 'text', 'Prépa 10 km', 'expiresAt', now() + interval '1 hour'),
  gen_random_uuid()::text, 0))), 'applied', 'statut temporaire enregistré');
select is(public.profile_save(pg_temp.item('banner', '{"source":"gradient","colors":["#112233"]}', gen_random_uuid()::text, 0)) -> 'results' -> 0 ->> 'reason',
  'invalid:banner', 'un dégradé exige au moins deux couleurs');
select is(public.profile_save(pg_temp.item('widget:' || gen_random_uuid(), '{"type":"text","tags":["x"]}', gen_random_uuid()::text, 0)) -> 'results' -> 0 ->> 'reason',
  'invalid:widget', 'champ incompatible avec le type de widget refusé');
select is(public.profile_save(pg_temp.item('<script>', '{}', gen_random_uuid()::text, 0)) -> 'results' -> 0 ->> 'reason', 'key', 'clé d''élément inconnue refusée');

-- Limite de huit widgets
select public.profile_save(jsonb_agg(jsonb_build_object('key', 'widget:' || gen_random_uuid(), 'payload', '{"type":"interests","tags":["trail"]}'::jsonb,
  'op_id', gen_random_uuid(), 'base_revision', 0, 'client_updated_at', now()))) from generate_series(1, 8);
select is(public.profile_save(pg_temp.item('widget:' || (select id from ids where name = 'w9'), '{"type":"stats","stats":["runs"]}', gen_random_uuid()::text, 0))
  -> 'results' -> 0 ->> 'reason', 'limit_widgets', 'neuvième widget refusé');

-- Médias : réservation, dépôt privé, validation, remplacement
select is(public.profile_media_begin((select id from ids where name = 'm1'), 'avatar', 'image/jpeg', 120000, 800, 800) ->> 'path',
  (select id from ids where name = 'a')::text || '/' || (select id from ids where name = 'm1')::text || '.jpg', 'réservation dans le dossier du titulaire');
select throws_ok(format($$select public.profile_media_begin('%s', 'avatar', 'image/jpeg', 6000000, 800, 800)$$, gen_random_uuid()),
  '22023', 'media_too_large', 'image de plus de 5 Mio refusée');
select throws_ok(format($$select public.profile_media_begin('%s', 'avatar', 'image/gif', 1000, 64, 64)$$, gen_random_uuid()),
  '22023', 'invalid_parameter:mime', 'format animé non accepté en 8a');
select is(pg_temp.status(public.profile_save(pg_temp.item('avatar', jsonb_build_object('source', 'media', 'mediaId', (select id from ids where name = 'm1')),
  gen_random_uuid()::text, 0))), 'deferred', 'avatar en attente tant que le média n''est pas validé');
select lives_ok(format($$insert into storage.objects (bucket_id, name, owner) values ('profile-media', '%s/%s.jpg', auth.uid())$$,
  (select id from ids where name = 'a'), (select id from ids where name = 'm1')), 'dépôt dans une réservation en attente');
select throws_ok(format($$insert into storage.objects (bucket_id, name, owner) values ('profile-media', '%s/%s.jpg', auth.uid())$$,
  (select id from ids where name = 'a'), gen_random_uuid()), '42501', null, 'aucun dépôt sans réservation');
select tests.logout();
select public.service_profile_media_result((select id from ids where name = 'a'), (select id from ids where name = 'm1'), true, 'image/jpeg', 118000, 800, 800);
insert into public.profile_media (id, user_id, usage, mime, bytes, width, height, storage_path, status, ready_at)
values ((select id from ids where name = 'm2'), (select id from ids where name = 'a'), 'avatar', 'image/jpeg', 1000, 64, 64,
        (select id from ids where name = 'a')::text || '/' || (select id from ids where name = 'm2')::text || '.jpg', 'ready', now());
select is(public.service_profile_media_result((select id from ids where name = 'a'), (select id from ids where name = 'm2'), true, 'image/gif', 1000, 64, 64, true, 500)
  ->> 'status', 'ready', 'un média déjà validé reste validé');

-- B ne voit ni ne modifie rien chez A
select tests.login_as((select id from ids where name = 'b'));
select throws_ok(format($$insert into storage.objects (bucket_id, name, owner) values ('profile-media', '%s/%s.jpg', auth.uid())$$,
  (select id from ids where name = 'a'), (select id from ids where name = 'm1')), '42501', null, 'B ne dépose rien dans le dossier de A');
select is((select count(*)::int from storage.objects where bucket_id = 'profile-media'), 0, 'B ne voit pas les fichiers de A');
select is(jsonb_array_length(public.profile_pull() -> 'elements'), 0, 'B ne lit aucun élément de A');
select tests.logout();

select tests.login_as((select id from ids where name = 'a'));
select is(pg_temp.status(public.profile_save(pg_temp.item('avatar', jsonb_build_object('source', 'media', 'mediaId', (select id from ids where name = 'm1'),
  'crop', jsonb_build_object('x', 0.1, 'y', -0.2, 'zoom', 1.5)), 'op5', 0))), 'applied', 'avatar enregistré après validation du média');
select public.profile_save(pg_temp.item('avatar', jsonb_build_object('source', 'media', 'mediaId', (select id from ids where name = 'm2')), gen_random_uuid()::text, 1));
select tests.logout();
select is((select status from public.profile_media where id = (select id from ids where name = 'm1')), 'deleted', 'l''ancien avatar est libéré après remplacement');
select ok(exists (select 1 from public.service_storage_purge_batch(500) p where p.bucket = 'profile-media'
  and p.path like '%' || (select id from ids where name = 'm1')::text || '.jpg'), 'le fichier remplacé part dans la file de purge');

-- Nettoyage, session révoquée, suppression du compte
insert into public.profile_media (id, user_id, usage, mime, bytes, width, height, storage_path, created_at)
values ((select id from ids where name = 'm3'), (select id from ids where name = 'b'), 'banner', 'image/png', 1000, 64, 64,
        (select id from ids where name = 'b')::text || '/' || (select id from ids where name = 'm3')::text || '.png', now() - interval '2 days');
select is((private.job_profile_media() ->> 'pending')::int, 1, 'réservation abandonnée nettoyée après 24 h');
delete from auth.sessions where user_id = (select id from ids where name = 'a');
select tests.login_as((select id from ids where name = 'a'), (select id from ids where name = 'op1'));
select throws_ok($$select public.profile_pull()$$, '42501', 'forbidden', 'session révoquée : plus aucun accès');
select tests.logout();
delete from auth.users where id = (select id from ids where name = 'a');
select is((select count(*)::int from public.profile_elements where user_id = (select id from ids where name = 'a')), 0, 'la suppression du compte retire le profil');
select * from finish();
rollback;
