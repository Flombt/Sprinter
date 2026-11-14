-- Phase 8d : bibliothèque communautaire de thèmes (styles autorisés seulement, favoris, signalement, modération).
begin;
select plan(17);
create temporary table ids (name text primary key, id uuid) on commit drop;
grant select on ids to authenticated;
insert into ids select n, tests.create_user(format('%s-themes@example.test', n)) from unnest(array['a', 'b', 'c', 'd', 'e', 'modo']) n;
insert into ids values ('t1', gen_random_uuid()), ('t2', gen_random_uuid());
select tests.create_session(id, case when name = 'modo' then 'aal2' else 'aal1' end) from ids where name not in ('t1', 't2');
insert into private.admin_users (user_id, role, moderation) values ((select id from ids where name = 'modo'), 'owner', false);
update public.app_config set value = 'true' where key in ('accounts_enabled', 'profiles_enabled', 'profile_studio_enabled');
create temporary table r (label text primary key, v jsonb) on commit drop;
grant all on r to authenticated;
create or replace function pg_temp.style(p_extra jsonb default '{}'::jsonb) returns jsonb language sql as $$
  select '{"appearance":{"theme":"neon","font":"mono"},"banner":{"source":"gradient","colors":["#39FF14","#00E5FF"],"veil":0.2},"avatar":{"shape":"rounded","halo":true},"decorations":{"icon":"eclair","entry":"fade"}}'::jsonb || p_extra
$$;

select tests.login_as((select id from ids where name = 'a'));
select throws_ok(format($$select public.theme_publish('%s', 'Néon nocturne', 'neon', pg_temp.style())$$, (select id from ids where name = 't1')), 'P0001', 'feature_disabled',
  'bibliothèque éteinte : rien n''est publié');
select tests.logout();
update public.app_config set value = 'true' where key = 'theme_library_enabled';
select tests.login_as((select id from ids where name = 'a'));
select is(public.theme_publish((select id from ids where name = 't1'), 'Néon nocturne', 'neon', pg_temp.style()) ->> 'status', 'visible', 'thème publié sur choix explicite');
select throws_ok(format($$select public.theme_publish('%s', 'Photo', 'autre', '{"banner":{"source":"media","mediaId":"%s"}}')$$, gen_random_uuid(), gen_random_uuid()),
  '22023', 'invalid_style:banner', 'aucune photo personnelle dans un thème');
select throws_ok(format($$select public.theme_publish('%s', 'Texte', 'autre', '{"decorations":{"title":"Camille"}}')$$, gen_random_uuid()),
  '22023', 'invalid_style:decorations', 'aucun texte personnel dans un thème');
select throws_ok(format($$select public.theme_publish('%s', 'Bio', 'autre', '{"about":{"bio":"x"}}')$$, gen_random_uuid()), '22023', 'invalid_style:style', 'contenu hors style refusé');
select throws_ok(format($$select public.theme_publish('%s', 'Sprinter officiel', 'autre', '{}')$$, gen_random_uuid()), '22023', 'invalid_parameter:name', 'nom trompeur refusé');
select tests.logout();

select tests.login_as((select id from ids where name = 'b'));
insert into r select 'list', public.theme_list();
select is((select jsonb_array_length(v -> 'items') from r where label = 'list'), 1, 'B parcourt la bibliothèque');
select ok((select (v::text) !~ (select id::text from ids where name = 'a') and (v -> 'items' -> 0 -> 'style') = pg_temp.style() from r where label = 'list'),
  'uniquement le style autorisé, jamais l''auteur');
select is(public.theme_favorite((select id from ids where name = 't1'), true) ->> 'favorite', 'true', 'ajout aux favoris');
select is((public.theme_list(null, 'favorites') -> 'items' -> 0 ->> 'favorites')::int, 1, 'favoris comptés');
select tests.logout();

-- Signalement : masqué à trois signalants, puis décision motivée
select tests.login_as((select id from ids where name = 'c')); select public.theme_report((select id from ids where name = 't1'), 'offensive'); select tests.logout();
select tests.login_as((select id from ids where name = 'd')); select public.theme_report((select id from ids where name = 't1'), 'offensive'); select tests.logout();
select tests.login_as((select id from ids where name = 'e')); select public.theme_report((select id from ids where name = 't1'), 'offensive'); select tests.logout();
select tests.login_as((select id from ids where name = 'b'));
select is(jsonb_array_length(public.theme_list() -> 'items'), 0, 'trois signalements : thème masqué en attente');
select tests.logout();
select tests.login_as((select id from ids where name = 'modo'), null, 'aal2', 60);
insert into r select 'reports', public.admin_list_reports();
select is((select v -> 'items' -> 0 ->> 'element_kind' from r where label = 'reports'), 'theme', 'le thème rejoint la file de modération');
select is(public.admin_moderate((select (v -> 'items' -> 0 ->> 'id')::uuid from r where label = 'reports'), 'restore', 'support', 'Pas de problème') ->> 'status', 'actioned',
  'rétablissement motivé');
select tests.logout();
select tests.login_as((select id from ids where name = 'b'));
select is(jsonb_array_length(public.theme_list() -> 'items'), 1, 'thème rétabli');
select tests.logout();

-- Blocage, retrait par l'auteur, suppression du compte
select tests.login_as((select id from ids where name = 'a'));
select public.theme_publish((select id from ids where name = 't2'), 'Pastel doux', 'pastel', '{"appearance":{"theme":"pastel"}}');
select public.theme_withdraw((select id from ids where name = 't1'));
select tests.logout();
insert into private.profile_blocks (blocker_id, blocked_id, handle_snapshot) values ((select id from ids where name = 'b'), (select id from ids where name = 'a'), 'a');
select tests.login_as((select id from ids where name = 'b'));
select is(jsonb_array_length(public.theme_list() -> 'items'), 0, 'auteur bloqué : ses thèmes disparaissent');
select tests.logout();
delete from private.profile_blocks;
select tests.login_as((select id from ids where name = 'b'));
select is(public.theme_list() -> 'items' -> 0 ->> 'name', 'Pastel doux', 'le thème retiré par son auteur n''est plus proposé');
select tests.logout();
select private.on_account_deleting((select id from ids where name = 'a'));
select is((select count(*)::int from public.theme_library where status = 'visible'), 0, 'compte en suppression : thèmes retirés');
select * from finish();
rollback;
