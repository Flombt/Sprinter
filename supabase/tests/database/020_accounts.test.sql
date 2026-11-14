-- Phase 1 : consentements, appareils, activité, « Mes données », suppression (§6, §14 phase 1).
begin;
select plan(30);

create temporary table ids (name text primary key, id uuid) on commit drop;
grant select on ids to anon, authenticated, service_role;
insert into ids values ('a', tests.create_user('a@example.test', 'apple')), ('b', tests.create_user('b@example.test'));
insert into ids values ('sa', tests.create_session((select id from ids where name = 'a'))),
                       ('sa2', tests.create_session((select id from ids where name = 'a'))),
                       ('sb', tests.create_session((select id from ids where name = 'b')));
insert into ids values ('e1', gen_random_uuid()), ('e2', gen_random_uuid()), ('e3', gen_random_uuid()),
                       ('d1', gen_random_uuid()), ('d2', gen_random_uuid());

-- Consentements ------------------------------------------------------------------------
select tests.login_as((select id from ids where name = 'a'), (select id from ids where name = 'sa'));
select is(public.record_consent('cloud_sync_runs', '2026-11', true, (select id from ids where name = 'e1'), now()) ->> 'status',
  'applied', 'consentement enregistré');
select is(public.record_consent('cloud_sync_runs', '2026-11', true, (select id from ids where name = 'e1'), now()) ->> 'status',
  'duplicate', 'rejouer le même événement ne crée pas de doublon');
select is(public.record_consent('cloud_sync_runs', '2026-11', true, (select id from ids where name = 'e1'), now()) ->> 'status',
  'duplicate', 'troisième rejeu toujours idempotent');
select is((select count(*)::int from public.consent_log where purpose = 'cloud_sync_runs'), 1, 'une seule entrée après trois envois');
select is(public.record_consent('cloud_sync_runs', '2026-11', false, (select id from ids where name = 'e2'), now() + interval '1 hour') ->> 'status',
  'applied', 'retrait enregistré (horodatage client borné à maintenant)');
select is(public.record_consent('cloud_sync_runs', '2026-11', true, (select id from ids where name = 'e3'), now() - interval '1 day') ->> 'status',
  'stale', 'une réactivation obsolète est rejetée');
select is((public.my_consents() -> 'cloud_sync_runs' ->> 'granted')::boolean, false, 'la dernière décision confirmée fait foi');
select throws_ok($$select public.record_consent('marketing', '1', true, gen_random_uuid(), now())$$, '22023', null, 'finalité inconnue refusée');

-- Appareils -----------------------------------------------------------------------------
select is(public.register_device((select id from ids where name = 'd1'), 'ios', '27.0', '1.0.0') ->> 'registered', 'true', 'appareil enregistré');
select lives_ok($$select public.register_device((select id from ids where name = 'd1'), 'ios', '27.1', '1.0.1')$$, 'réenregistrement idempotent');
select is((select count(*)::int from public.user_devices), 1, 'un seul appareil après réenregistrement');
select is(public.touch_activity(current_date) ->> 'day', current_date::text, 'activité du jour enregistrée');
select lives_ok($$select public.touch_activity(current_date); select public.touch_activity(current_date)$$, 'activité idempotente');
select is((select count(*)::int from public.activity_days), 1, 'une ligne par jour');
select throws_ok($$select public.touch_activity(current_date - 5)$$, '22023', null, 'jour hors de [hier, demain] refusé');
select is((public.my_data_summary() -> 'devices' -> 0 ->> 'current')::boolean, true, 'Mes données signale l''appareil courant');
select tests.logout();

-- Un second appareil (autre session) déconnecte le premier à distance.
select tests.login_as((select id from ids where name = 'a'), (select id from ids where name = 'sa2'));
select lives_ok($$select public.register_device((select id from ids where name = 'd2'), 'android', '15', '1.0.0')$$, 'second appareil enregistré');
select is(public.disconnect_device((select id from ids where name = 'd1')) ->> 'session_revoked', 'true', 'déconnexion d''un appareil : session révoquée');
select tests.logout();
select tests.login_as((select id from ids where name = 'a'), (select id from ids where name = 'sa'));
select is((select count(*)::int from public.user_devices), 0, 'l''appareil déconnecté n''a plus accès avec son ancien JWT');
select tests.logout();

-- Isolation et rôles --------------------------------------------------------------------
select tests.login_as((select id from ids where name = 'b'), (select id from ids where name = 'sb'));
select is((public.my_data_summary() ->> 'runs')::int, 0, 'B ne voit que ses propres données');
select is((select count(*)::int from public.consent_log), 0, 'B ne lit pas les consentements de A');
select throws_ok($$select public.service_begin_account_deletion(auth.uid(), 'app', gen_random_uuid())$$, '42501', null,
  'fonction de service inaccessible à un utilisateur');
select tests.logout();
select tests.login_anon();
select throws_ok($$select public.my_consents()$$, '42501', null, 'anon ne peut rien appeler');
select tests.logout();

-- Suppression reprenable -------------------------------------------------------------------
select is(public.service_begin_account_deletion((select id from ids where name = 'b'), 'app', (select id from ids where name = 'e1')) ->> 'status',
  'processing', 'suppression validée');
select is((select status from private.user_directory where user_id = (select id from ids where name = 'b')), 'deleting', 'compte passé en suppression');
select is((select count(*)::int from auth.sessions where user_id = (select id from ids where name = 'b')), 0, 'sessions révoquées');
select tests.login_as((select id from ids where name = 'b'), (select id from ids where name = 'sb'));
select throws_ok($$select public.my_data_summary()$$, '42501', null, 'ancien JWT encore valide : aucune donnée privée');
select tests.logout();
select is((public.service_begin_account_deletion((select id from ids where name = 'b'), 'app', gen_random_uuid()) ->> 'attempts')::int, 1,
  'reprise après interruption sans rouvrir les accès');
delete from auth.users where id = (select id from ids where name = 'b');
select is(public.service_finish_account_deletion((select id from ids where name = 'b'), (select id from ids where name = 'e1')) ->> 'status', 'done', 'suppression terminée');
select is((select count(*)::int from private.admin_audit_logs where target_user_id = (select id from ids where name = 'b')
           and action in ('account.deletion_requested', 'account.deleted')), 2, 'audit système minimal');

select * from finish();
rollback;
