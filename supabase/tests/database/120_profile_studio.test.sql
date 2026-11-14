-- Phase 8b : studio avancé (configurations, widgets avancés, décorations, badges officiels, médias animés).
begin;
select plan(26);
create temporary table ids (name text primary key, id uuid) on commit drop;
grant select on ids to authenticated;
insert into ids values ('a', tests.create_user('studio-a@example.test')), ('img', gen_random_uuid()), ('gif', gen_random_uuid()), ('banner', gen_random_uuid());
select tests.create_session(id) from ids where name = 'a';
update public.app_config set value = 'true' where key in ('accounts_enabled', 'profiles_enabled');
create or replace function pg_temp.save(p_key text, p_payload jsonb, p_base int default 0) returns jsonb language sql as $$
  select public.profile_save(jsonb_build_array(jsonb_build_object('key', p_key, 'payload', p_payload, 'op_id', gen_random_uuid(),
    'base_revision', p_base, 'client_updated_at', now()))) -> 'results' -> 0
$$;
create or replace function pg_temp.reason(p_key text, p_payload jsonb, p_base int default 0) returns text language sql as $$
  select coalesce(r ->> 'reason', r ->> 'status') from (select pg_temp.save(p_key, p_payload, p_base) as r) s
$$;

-- Studio coupé : seules les fonctions 8a passent
select tests.login_as((select id from ids where name = 'a'));
select is(pg_temp.reason('decorations', '{"title":"Traileuse"}'), 'invalid:studio_disabled', 'décorations refusées sans le studio');
select is(pg_temp.reason('widget:' || gen_random_uuid(), '{"type":"goal","label":"Semi","target":21}'), 'invalid:studio_disabled', 'widget avancé refusé sans le studio');
select is(pg_temp.reason('appearance', '{"theme":"espace","font":"serif"}'), 'invalid:studio_disabled', 'typographie refusée sans le studio');
select is(pg_temp.reason('appearance', '{"theme":"espace"}'), 'applied', 'apparence essentielle toujours acceptée');
select throws_ok(format($$select public.profile_media_begin('%s', 'avatar', 'image/gif', 1000, 64, 64, true)$$, gen_random_uuid()),
  '22023', 'invalid_parameter:mime', 'animation refusée sans le studio');
select tests.logout();
update public.app_config set value = 'true' where key = 'profile_studio_enabled';

-- Studio actif
select tests.login_as((select id from ids where name = 'a'));
select is(pg_temp.reason('appearance', '{"theme":"espace","font":"serif","cards":"raised","buttons":"square","frame":true,"colors":{"accent":"#FF00AA","background":"#101010"}}', 1),
  'applied', 'palette, typographie et cartes enregistrées');
select is(pg_temp.reason('appearance', '{"theme":"espace","colors":{"accent":"rouge"}}', 2), 'invalid:appearance', 'couleur hors format refusée');
select is(pg_temp.reason('decorations', '{"title":"Traileuse du dimanche","icon":"leaf","plate":"aurore","entry":"fade"}'), 'applied', 'décorations personnelles');
select is(pg_temp.reason('decorations', '{"plate":"officiel-or"}', 1), 'invalid:decorations', 'une plaque ne peut pas imiter une distinction officielle');
select is(pg_temp.reason('decorations', '{"title":"Coureur certifié"}', 1), 'invalid:decorations', 'un titre ne peut pas se dire certifié');
select is(pg_temp.reason('badges', '{"show":["courses_10","champion"]}'), 'invalid:badges', 'badge hors catalogue officiel refusé');
select is(pg_temp.reason('statuses', '{"items":[{"emoji":"🏁","text":"Course ce week-end"},{"text":"Au repos"}]}'), 'applied', 'statuts réutilisables');

-- Widgets avancés
select is(pg_temp.reason('widget:' || gen_random_uuid(), '{"type":"goal","label":"Semi en 1 h 45","target":21.1,"unit":"km","source":"distance_month","size":"wide"}'),
  'applied', 'objectif calculé, carte large');
select is(pg_temp.reason('widget:' || gen_random_uuid(), '{"type":"links","links":[{"label":"Blog","url":"http://exemple.fr"}]}'), 'invalid:widget', 'lien non HTTPS refusé');
select is(pg_temp.reason('widget:' || gen_random_uuid(), '{"type":"links","links":[{"label":"Blog","url":"https://exemple.fr/courses"}]}'), 'applied', 'lien HTTPS accepté');
select is(pg_temp.reason('widget:' || gen_random_uuid(), '{"type":"counter","label":"Dossards","value":42,"text":"x"}'), 'invalid:widget', 'champ étranger au compteur refusé');
select is(pg_temp.reason('widget:' || gen_random_uuid(), jsonb_build_object('type', 'gallery', 'images',
  (select jsonb_agg(jsonb_build_object('mediaId', gen_random_uuid(), 'alt', 'Photo')) from generate_series(1, 6)))), 'invalid:widget', 'six images : galerie refusée');
select is(pg_temp.reason('widget:' || gen_random_uuid(), jsonb_build_object('type', 'gallery', 'images',
  jsonb_build_array(jsonb_build_object('mediaId', (select id from ids where name = 'img'), 'alt', 'Arrivée du semi')))), 'media_not_ready', 'galerie en attente du média');
select is(pg_temp.reason('widget:' || gen_random_uuid(), '{"type":"gallery","images":[{"mediaId":"00000000-0000-4000-8000-000000000001","alt":"  "}]}'),
  'invalid:widget', 'description d''image obligatoire');

-- Configurations : cinq au plus, sans image d'avatar
select is(pg_temp.reason('config:' || gen_random_uuid(), '{"name":"Minimaliste","appearance":{"theme":"minimaliste"},"avatar":{"shape":"rounded","frame":"thin"},"order":[],"sizes":{}}'),
  'applied', 'configuration enregistrée');
select is(pg_temp.reason('config:' || gen_random_uuid(), '{"name":"Avec photo","avatar":{"mediaId":"00000000-0000-4000-8000-000000000001"}}'), 'invalid:config',
  'une configuration ne contient pas la photo de l''avatar');
select public.profile_save((select jsonb_agg(jsonb_build_object('key', 'config:' || gen_random_uuid(), 'payload', jsonb_build_object('name', 'Style ' || g),
  'op_id', gen_random_uuid(), 'base_revision', 0)) from generate_series(1, 4) g));
select is(pg_temp.reason('config:' || gen_random_uuid(), '{"name":"Sixième"}'), 'limit_configs', 'sixième configuration refusée');

-- Médias animés : 8 Mio, 8 s
select is(public.profile_media_begin((select id from ids where name = 'gif'), 'avatar', 'image/gif', 7000000, 200, 200, true) ->> 'status', 'pending', 'GIF animé réservé');
select tests.logout();
select is(public.service_profile_media_result((select id from ids where name = 'a'), (select id from ids where name = 'gif'), true, 'image/gif', 7000000, 200, 200, true, 9000)
  ->> 'reason', 'too_long', 'animation de plus de 8 s refusée');

-- Badges officiels recalculés côté serveur
insert into public.runs (user_id, id, source, started_at, ended_at, active_s, distance_m, reliable_s, payload, client_updated_at)
select (select id from ids where name = 'a'), 'b' || g, 'sprinter', now() - (g || ' days')::interval - interval '1 hour', now() - (g || ' days')::interval, 1800, 5000, 1800, '{}', now()
from generate_series(1, 12) g;
select tests.login_as((select id from ids where name = 'a'));
select is((select jsonb_agg(b ->> 'id') from jsonb_array_elements(public.profile_badges()) b), '["courses_10"]'::jsonb, 'badge mérité, et lui seul');
select tests.logout();
select ok(not private.profile_key_ok('config:pas-un-uuid') and private.profile_key_ok('statuses'), 'clés d''éléments du studio');
select * from finish();
rollback;
