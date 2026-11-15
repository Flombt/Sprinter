begin;
select tests.clear_seed();
select plan(24);

create temporary table discovery_test (name text primary key, value jsonb);
grant select, insert on discovery_test to anon, authenticated, service_role;
insert into discovery_test values
  ('owner', to_jsonb(tests.create_user('discovery-owner@example.test'))),
  ('member', to_jsonb(tests.create_user('discovery-member@example.test'))),
  ('item', '{"id":"fiche-test","market":"nice","countryCode":"FR","kind":"club","state":"published",
    "title":"Club synthétique","summary":"Fiche de test privée.","city":"Nice","officialUrl":"https://www.nice.fr/",
    "sources":[{"kind":"institution","name":"Source de test","url":"https://www.nice.fr/","checkedOn":"2026-11-15"}]}');
select tests.create_session((value #>> '{}')::uuid) from discovery_test where name = 'member';
select tests.create_session((value #>> '{}')::uuid, 'aal2') from discovery_test where name = 'owner';
insert into private.admin_users(user_id, role) select (value #>> '{}')::uuid, 'owner' from discovery_test where name = 'owner';
update public.app_config set value = 'true' where key = 'accounts_enabled';

select ok(not has_table_privilege('anon', 'private.discovery_items', 'select'), 'tables privées pour les visiteurs');
select ok(not has_table_privilege('authenticated', 'private.discovery_candidates', 'select'), 'quarantaine privée');
select ok(not has_function_privilege('authenticated', 'public.service_discovery_begin_v1(text)', 'execute'), 'service seul pour ouvrir un import');

set local role service_role;
select is(public.service_discovery_seed_v1('nice', jsonb_build_array((select value from discovery_test where name = 'item')), 'Initialisation de test'),
  1, 'installation éditoriale autorisée au service');
select is(public.service_discovery_seed_v1('nice', jsonb_build_array((select value || '{"title":"Doublon"}' from discovery_test where name = 'item')), 'Rejeu de test'),
  1, 'rejeu de l’installation idempotent');
insert into discovery_test select 'lease', public.service_discovery_begin_v1('apidae-nice');
select ok((select value->>'id' from discovery_test where name = 'lease') is not null, 'bail d’import acquis');
select is(public.service_discovery_begin_v1('apidae-nice'), null::jsonb, 'le bail protège des déclenchements concurrents');
select is(public.service_discovery_finish_v1('apidae-nice', (select (value->>'id')::uuid from discovery_test where name = 'lease'),
  'ok', '{"url":"https://www.nice.fr/","hash":"test"}', '{"received":1}',
  jsonb_build_array(jsonb_build_object('externalId','apidae-test','fingerprint','club-test|nice', 'item',(select value from discovery_test where name = 'item')))),
  1, 'candidat enregistré et journalisé');
select throws_ok($$select public.service_discovery_finish_v1('apidae-nice', (select (value->>'id')::uuid from discovery_test where name = 'lease'),
  'failed', '{}', '{}', '[]')$$, '40001', 'lost_discovery_lease', 'un ancien bail ne peut remplacer le checkpoint');
reset role;

select tests.login_anon();
select throws_ok($$select public.discovery_feed_v1('nice')$$, '42501', 'permission denied for function discovery_feed_v1', 'lecture réservée aux comptes');
select throws_ok($$select public.service_discovery_begin_v1('apidae-nice')$$, '42501', 'permission denied for function service_discovery_begin_v1', 'import interdit en lecture anonyme');
select tests.logout();

select tests.login_as((select (value #>> '{}')::uuid from discovery_test where name = 'member'));
select is(jsonb_array_length(public.discovery_feed_v1('nice')->'entries'), 1, 'la lecture membre exclut les candidats');
select is(public.discovery_feed_v1('nice')->'entries'->0->'item'->>'title', 'Club synthétique', 'la graine ne remplace pas une fiche existante');
select throws_ok($$select public.admin_discovery_queue_v1('nice')$$, '42501', 'forbidden', 'un compte standard ne peut modérer');
select throws_ok($$select public.admin_discovery_write_v1('nice','fiche-test',(select value from discovery_test where name = 'item'),'archived',1,'Motif de test')$$,
  '42501', 'forbidden', 'un compte standard ne peut retirer une fiche');
select tests.logout();

select tests.login_as((select (value #>> '{}')::uuid from discovery_test where name = 'owner'), null, 'aal2', 3600);
select is(jsonb_array_length(public.admin_discovery_queue_v1('nice')->'candidates'), 1, 'la file est lisible par le propriétaire AAL2');
select throws_ok($$select public.admin_discovery_write_v1('nice','fiche-test',(select value from discovery_test where name = 'item'),'archived',1,'Motif de test')$$,
  '42501', 'reauth_required', 'une réauthentification récente est requise pour publier');
select tests.logout();

select tests.login_as((select (value #>> '{}')::uuid from discovery_test where name = 'owner'), null, 'aal2', 30);
select is(public.admin_discovery_write_v1('nice','draft-test',(select value || '{"id":"draft-test"}' from discovery_test where name = 'item'),
  'draft',0,'Brouillon de test'), 2::bigint, 'le propriétaire peut créer un brouillon');
select is(jsonb_array_length(public.discovery_feed_v1('nice')->'entries'), 1, 'un brouillon inédit est invisible');
select throws_ok($$select public.admin_discovery_write_v1('nice','fiche-test',(select value from discovery_test where name = 'item'),
  'archived',0,'Motif de test')$$, '40001', 'discovery_edit_conflict', 'détecte une édition obsolète');
select is(public.admin_discovery_write_v1('nice','fiche-test',(select value from discovery_test where name = 'item'),
  'archived',1,'Retrait test'), 3::bigint, 'le propriétaire peut retirer une fiche');
select is(jsonb_typeof(public.discovery_feed_v1('nice')->'entries'->0->'item'), 'null', 'un retrait masque la fiche embarquée');
select throws_ok($$select public.discovery_feed_v1('nice','fiche-test',1)$$, '40001', 'catalogue_revision_changed', 'les pages ne mélangent pas les révisions');
select is(jsonb_array_length(public.admin_discovery_queue_v1('nice','', 'fiche-test')->'recentEdits'), 2, 'historique de révision consultable');
select tests.logout();

select * from finish();
rollback;
