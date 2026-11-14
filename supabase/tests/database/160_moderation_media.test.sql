begin;
select tests.clear_seed();
select plan(10);
create temporary table ids (name text primary key, id uuid) on commit drop;
grant select on ids to authenticated;
insert into ids select n, tests.create_user(n || '-media-review@example.test') from unnest(array['owner', 'member', 'moderator', 'support']) n;
insert into ids values ('media', gen_random_uuid()), ('report', gen_random_uuid());
select tests.create_session(id) from ids where name in ('owner', 'member', 'moderator', 'support');
insert into private.admin_users(user_id, role, moderation) values
  ((select id from ids where name = 'moderator'), 'support', true), ((select id from ids where name = 'support'), 'support', false);
update public.app_config set value = 'true' where key in ('accounts_enabled', 'profiles_enabled', 'profile_sharing_enabled');
insert into public.profile_sharing(user_id, mode) select id, 'members' from ids where name = 'owner';
insert into public.profile_media(id, user_id, usage, mime, bytes, width, height, storage_path, status, ready_at)
values ((select id from ids where name = 'media'), (select id from ids where name = 'owner'), 'avatar', 'image/png', 1000, 64, 64,
  (select id::text from ids where name = 'owner') || '/avatar.png', 'ready', now());
insert into public.profile_elements(user_id, element_key, payload, visibility, client_updated_at)
select id, 'avatar', jsonb_build_object('source', 'media', 'mediaId', (select id from ids where name = 'media')), 'audience', now()
from ids where name = 'owner';
insert into public.profile_published(user_id, element_key, payload, source_revision)
select user_id, element_key, payload, revision from public.profile_elements;
insert into private.reports(id, reporter_id, target_user, target_kind, target_ref, reason)
values ((select id from ids where name = 'report'), (select id from ids where name = 'member'),
  (select id from ids where name = 'owner'), 'profile_element', (select id::text from ids where name = 'owner') || ':avatar', 'personal_data');

select tests.login_as((select id from ids where name = 'member'));
select throws_ok($$select public.admin_report_media((select id from ids where name = 'report'), 'support')$$, '42501', 'forbidden', 'membre exclu');
select tests.logout();
select tests.login_as((select id from ids where name = 'support'), null, 'aal2');
select throws_ok($$select public.admin_report_media((select id from ids where name = 'report'), 'support')$$, '42501', 'forbidden', 'support sans habilitation exclu');
select tests.logout();
select tests.login_as((select id from ids where name = 'moderator'));
select throws_ok($$select public.admin_report_media((select id from ids where name = 'report'), 'support')$$, '42501', 'aal2_required', 'AAL2 requis');
select tests.logout();
select tests.login_as((select id from ids where name = 'moderator'), null, 'aal2');
select throws_ok($$select public.admin_report_media((select id from ids where name = 'report'), null)$$, '22023', 'reason_required', 'motif requis');
select is(public.admin_report_media((select id from ids where name = 'report'), 'support') ->> 'media_id',
  (select id::text from ids where name = 'media'), 'seul le média publié signalé est autorisé');
select tests.logout();
select is((select count(*)::int from private.admin_audit_logs where action = 'moderation.media'), 1, 'lecture du média journalisée');

update public.profile_published set moderation = 'hidden';
select tests.login_as((select id from ids where name = 'moderator'), null, 'aal2');
select lives_ok($$select public.admin_report_media((select id from ids where name = 'report'), 'support')$$, 'un contenu masqué reste examinable');
select tests.logout();
update public.profile_elements set visibility = 'owner';
select tests.login_as((select id from ids where name = 'moderator'), null, 'aal2');
select throws_ok($$select public.admin_report_media((select id from ids where name = 'report'), 'support')$$, 'P0002', 'not_found', 'retrait de visibilité appliqué immédiatement');
select tests.logout();
update public.profile_elements set visibility = 'audience';
update public.profile_sharing set mode = 'private';
select tests.login_as((select id from ids where name = 'moderator'), null, 'aal2');
select throws_ok($$select public.admin_report_media((select id from ids where name = 'report'), 'support')$$, 'P0002', 'not_found', 'profil devenu privé inaccessible');
select tests.logout();
update public.profile_sharing set mode = 'members';
update private.user_directory set status = 'deleting' where user_id = (select id from ids where name = 'owner');
select tests.login_as((select id from ids where name = 'moderator'), null, 'aal2');
select throws_ok($$select public.admin_report_media((select id from ids where name = 'report'), 'support')$$, 'P0002', 'not_found', 'compte en suppression inaccessible');
select tests.logout();
select * from finish();
rollback;
