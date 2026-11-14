-- Phase 8c : partage volontaire, visibilité par élément, lien révocable, recherche, blocage, signalement, modération.
begin;
select plan(37);
create temporary table ids (name text primary key, id uuid) on commit drop;
grant select on ids to authenticated;
insert into ids select n, tests.create_user(format('%s-partage@example.test', n)) from unnest(array['a', 'b', 'c', 'd', 'e', 'admin', 'support', 'modo']) n;
insert into ids values ('w1', gen_random_uuid()), ('w2', gen_random_uuid()), ('w3', gen_random_uuid()), ('m1', gen_random_uuid());
select tests.create_session(id, case when name in ('admin', 'support', 'modo') then 'aal2' else 'aal1' end) from ids where name not in ('w1', 'w2', 'w3', 'm1');
insert into private.admin_users (user_id, role, moderation) values
  ((select id from ids where name = 'admin'), 'owner', false), ((select id from ids where name = 'support'), 'support', false), ((select id from ids where name = 'modo'), 'support', true);
update public.app_config set value = 'true' where key in ('accounts_enabled', 'profiles_enabled', 'profile_studio_enabled', 'profile_sharing_enabled', 'leaderboard_enabled');
create temporary table r (label text primary key, v jsonb) on commit drop;
grant all on r to authenticated;
create or replace function pg_temp.as_user(p_name text) returns void language sql as $$ select tests.login_as((select id from ids where name = p_name)) $$;
create or replace function pg_temp.as_admin(p_name text) returns void language sql as $$ select tests.login_as((select id from ids where name = p_name), null, 'aal2', 60) $$;
create or replace function pg_temp.items(p_items jsonb) returns jsonb language sql as $$
  select jsonb_agg(i || jsonb_build_object('op_id', gen_random_uuid(), 'client_updated_at', now())) from jsonb_array_elements(p_items) i
$$;
create or replace function pg_temp.view(p_handle text, p_token text default null) returns jsonb language sql as $$ select public.profile_view(p_handle, p_token) $$;
create or replace function pg_temp.token() returns text language sql as $$ select v ->> 'token' from r where label = 'token' $$;

-- Profil privé de A, avec un média d'avatar validé
insert into public.profile_media (id, user_id, usage, mime, bytes, width, height, storage_path, status, ready_at)
values ((select id from ids where name = 'm1'), (select id from ids where name = 'a'), 'avatar', 'image/jpeg', 1000, 64, 64,
        (select id from ids where name = 'a')::text || '/' || (select id from ids where name = 'm1')::text || '.jpg', 'ready', now());
select pg_temp.as_user('a');
select public.profile_save(pg_temp.items(jsonb_build_array(
  jsonb_build_object('key', 'identity', 'payload', '{"name":"Camille"}'::jsonb, 'base_revision', 0),
  jsonb_build_object('key', 'about', 'payload', '{"bio":"Trail et piste"}'::jsonb, 'base_revision', 0),
  jsonb_build_object('key', 'appearance', 'payload', '{"theme":"neon"}'::jsonb, 'base_revision', 0),
  jsonb_build_object('key', 'avatar', 'payload', jsonb_build_object('source', 'media', 'mediaId', (select id from ids where name = 'm1')), 'base_revision', 0),
  jsonb_build_object('key', 'widget:' || (select id from ids where name = 'w1'), 'payload', '{"type":"text","text":"Public"}'::jsonb, 'base_revision', 0),
  jsonb_build_object('key', 'widget:' || (select id from ids where name = 'w2'), 'payload', '{"type":"text","text":"Secret"}'::jsonb, 'base_revision', 0),
  jsonb_build_object('key', 'widget:' || (select id from ids where name = 'w3'), 'payload', '{"type":"stats","stats":["runs"]}'::jsonb, 'base_revision', 0))));
select public.profile_set_visibility(jsonb_build_array(
  jsonb_build_object('key', 'identity', 'visibility', 'audience'), jsonb_build_object('key', 'about', 'visibility', 'audience'),
  jsonb_build_object('key', 'avatar', 'visibility', 'audience'), jsonb_build_object('key', 'widget:' || (select id from ids where name = 'w1'), 'visibility', 'audience'),
  jsonb_build_object('key', 'widget:' || (select id from ids where name = 'w3'), 'visibility', 'audience')));
select throws_ok($$select public.profile_publish(0)$$, 'P0001', 'sharing_private', 'aucune publication tant que le profil est privé');
select throws_ok($$select public.profile_sharing_set('members', true, 'a-partage', 'nobody', 'v1')$$, '22023', 'invalid_parameter:handle_personal',
  'le pseudo ne reprend pas l''adresse e-mail');
select tests.logout();
select pg_temp.as_user('c');
select public.record_consent('community_leaderboard', '2026-11', true, gen_random_uuid(), now() - interval '1 hour');
select public.community_join('Rapide');
select tests.logout();
select pg_temp.as_user('a');
select throws_ok($$select public.profile_sharing_set('members', true, 'rapide', 'nobody', 'v1')$$, '23505', 'handle_taken', 'pas le pseudo de classement d''un autre membre');
select is(public.profile_sharing_set('members', true, 'Coureuse', 'nobody', 'v1') ->> 'mode', 'members', 'partage aux membres choisi explicitement');
select is((public.profile_publish(0) ->> 'published')::int > 0, true, 'publication explicite');
select tests.logout();

-- Ce que voit un membre
select pg_temp.as_user('b');
insert into r select 'view1', pg_temp.view('coureuse');
select is((select v ->> 'available' from r where label = 'view1'), 'true', 'B voit le profil partagé aux membres');
select ok((select v -> 'elements' ? 'identity' and v -> 'elements' ? ('widget:' || (select id::text from ids where name = 'w1')) from r where label = 'view1'),
  'éléments choisis visibles');
select ok((select not (v -> 'elements' ? ('widget:' || (select id::text from ids where name = 'w2'))) from r where label = 'view1'), 'élément « Moi uniquement » absent');
select ok((select not (v -> 'elements' ? ('widget:' || (select id::text from ids where name = 'w3'))) from r where label = 'view1'),
  'statistique non publiée sans valeur confirmée');
select ok((select (v::text) !~ ('(partage@example|"user_id"|' || (select id::text from ids where name = 'a') || ')') from r where label = 'view1'), 'ni e-mail ni identifiant interne');
select is(public.profile_media_access((select id from ids where name = 'm1'), 'coureuse') ->> 'mime', 'image/jpeg', 'média publié lisible par B');
select is(jsonb_array_length(public.profile_search('cour') -> 'items'), 1, 'recherche par pseudo');
select tests.logout();
select tests.login_anon();
select throws_ok($$select public.profile_view('coureuse')$$, '42501', null, 'session absente : aucun accès');
select tests.logout();

-- Masquer un élément, se retirer de la recherche, valeurs de statistiques confirmées
select pg_temp.as_user('a');
select public.profile_set_visibility(jsonb_build_array(jsonb_build_object('key', 'avatar', 'visibility', 'owner')));
select public.profile_sharing_set('members', false, 'Coureuse', 'nobody');
select public.profile_publish((public.profile_sharing_get() ->> 'epoch')::int, jsonb_build_object('widget:' || (select id from ids where name = 'w3'),
  jsonb_build_object('values', jsonb_build_array(jsonb_build_object('id', 'runs', 'label', 'Courses', 'value', '42', 'period', 'depuis 2025')))));
select tests.logout();
select pg_temp.as_user('b');
select is(public.profile_media_access((select id from ids where name = 'm1'), 'coureuse'), null, 'avatar masqué : média refusé immédiatement');
select is(jsonb_array_length(public.profile_search('cour') -> 'items'), 0, 'hors recherche dès confirmation');
select is(pg_temp.view('coureuse') -> 'elements' -> ('widget:' || (select id::text from ids where name = 'w3')) -> 'values' -> 0 ->> 'value', '42',
  'statistique publiée : valeur confirmée seulement');
select tests.logout();

-- Lien révocable
select pg_temp.as_user('a');
select public.profile_sharing_set('link', false, null, 'nobody');
select public.profile_publish((public.profile_sharing_get() ->> 'epoch')::int);
insert into r select 'token', public.profile_link_create();
select tests.logout();
select pg_temp.as_user('b');
select is(pg_temp.view('coureuse') ->> 'available', 'false', 'mode lien : introuvable par pseudo');
select is(pg_temp.view(null, pg_temp.token()) ->> 'available', 'true', 'mode lien : visible avec le lien');
select tests.logout();
select pg_temp.as_user('a');
select public.profile_link_revoke();
select throws_ok($$select public.profile_publish(0)$$, 'P0001', 'stale_publication', 'une publication fondée sur un état ancien est refusée');
select public.profile_publish((public.profile_sharing_get() ->> 'epoch')::int);
insert into r select 'token2', public.profile_link_create();
select tests.logout();
select pg_temp.as_user('b');
select is(pg_temp.view(null, pg_temp.token()) ->> 'available', 'false', 'lien révoqué invalide, même après republication');
select is(pg_temp.view(null, (select v ->> 'token' from r where label = 'token2')) ->> 'available', 'true', 'nouveau lien valide');
select is(public.profile_block(null, (select v ->> 'token' from r where label = 'token2')) ->> 'blocked', 'true', 'B bloque A');
select is(pg_temp.view(null, (select v ->> 'token' from r where label = 'token2')) ->> 'available', 'false', 'blocage : même réponse générique');
select public.profile_unblock((public.profile_my_blocks() -> 0 ->> 'id')::uuid);
select tests.logout();

-- Signalements : masquage automatique à trois, puis décision motivée
select pg_temp.as_user('c'); select public.profile_report(null, (select v ->> 'token' from r where label = 'token2'), 'identity', 'impersonation'); select tests.logout();
select pg_temp.as_user('d'); select public.profile_report(null, (select v ->> 'token' from r where label = 'token2'), 'identity', 'impersonation'); select tests.logout();
select pg_temp.as_user('e'); select public.profile_report(null, (select v ->> 'token' from r where label = 'token2'), 'identity', 'impersonation'); select tests.logout();
select pg_temp.as_user('b');
select ok(not (pg_temp.view(null, (select v ->> 'token' from r where label = 'token2')) -> 'elements' ? 'identity'), 'trois signalements : élément masqué en attente');
select tests.logout();
select pg_temp.as_admin('support');
select throws_ok($$select public.admin_list_reports()$$, '42501', 'forbidden', 'support sans habilitation de modération : refusé');
select tests.logout();
select pg_temp.as_admin('modo');
insert into r select 'list', public.admin_list_reports();
select is((select (v -> 'items' -> 0 ->> 'reports_count')::int from r where label = 'list'), 3, 'file : signalements regroupés par contenu');
select throws_ok(format($$select public.admin_get_report('%s', null)$$, (select v -> 'items' -> 0 ->> 'id' from r where label = 'list')), '22023', 'reason_required', 'motif exigé');
select is(public.admin_get_report((select (v -> 'items' -> 0 ->> 'id')::uuid from r where label = 'list'), 'support') -> 'element' ->> 'text', 'Camille',
  'contexte strictement nécessaire : l''élément publié');
select is(public.admin_moderate((select (v -> 'items' -> 0 ->> 'id')::uuid from r where label = 'list'), 'remove', 'support', 'Usurpation') ->> 'status', 'actioned', 'décision de retrait');
select tests.logout();
select is((select count(*)::int from private.admin_audit_logs where action in ('moderation.view', 'moderation.decide')), 2, 'consultation et décision journalisées');
select is((select kind from public.profile_notices where user_id = (select id from ids where name = 'a')), 'content_removed', 'le titulaire est notifié');

-- Une publication ancienne ne rétablit pas un retrait ; une nouvelle version, explicitement publiée, oui.
select pg_temp.as_user('a');
select public.profile_publish((public.profile_sharing_get() ->> 'epoch')::int);
select is((select moderation from public.profile_published where element_key = 'identity'), 'removed', 'republication sans changement : retrait maintenu');
select public.profile_save(pg_temp.items(jsonb_build_array(jsonb_build_object('key', 'identity', 'payload', '{"name":"Camille R."}'::jsonb, 'base_revision', 1))));
select public.profile_publish((public.profile_sharing_get() ->> 'epoch')::int);
select is((select moderation from public.profile_published where element_key = 'identity'), 'visible', 'nouvelle version publiée explicitement');
select tests.logout();

-- Coupure du partage : plus de lecture externe, le titulaire garde sa version privée
update public.app_config set value = 'false' where key = 'profile_sharing_enabled';
select pg_temp.as_user('b');
select throws_ok($$select public.profile_view(null, 'x')$$, 'P0001', 'feature_disabled', 'partage coupé : lecture externe indisponible');
select tests.logout();
select pg_temp.as_user('a');
select ok(jsonb_array_length(public.profile_pull() -> 'elements') > 0, 'le titulaire garde l''accès à sa version privée');
select tests.logout();
update public.app_config set value = 'true' where key = 'profile_sharing_enabled';

-- Suppression du compte : retrait immédiat
update private.user_directory set status = 'deleting' where user_id = (select id from ids where name = 'a');
select private.on_account_deleting((select id from ids where name = 'a'));
select pg_temp.as_user('b');
select is(pg_temp.view(null, (select v ->> 'token' from r where label = 'token2')) ->> 'available', 'false', 'compte en suppression : profil retiré');
select tests.logout();
select is((select count(*)::int from public.profile_published where user_id = (select id from ids where name = 'a')), 0, 'version publiée effacée');
select * from finish();
rollback;
