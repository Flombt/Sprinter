begin;
select tests.clear_seed();
select plan(10);
select is(private.run_rules_version(), 1, 'version initiale des règles');
select is(private.recompute_validity(), 0, 'aucun recalcul sans course ancienne');
select throws_ok('select private.recompute_validity(0)', '22023', 'invalid_parameter:batch', 'lot nul refusé');
select throws_ok('select private.recompute_validity(5001)', '22023', 'invalid_parameter:batch', 'lot trop grand refusé');
select ok(not has_function_privilege('authenticated', 'private.recompute_validity(integer)', 'execute'), 'utilisateur exclu du job');
select ok(not has_function_privilege('anon', 'private.recompute_validity(integer)', 'execute'), 'anonyme exclu du job');

create temporary table fixture (id uuid) on commit drop;
insert into fixture select tests.create_user('validity-job@example.test');
insert into public.runs (user_id, id, source, started_at, ended_at, distance_m, active_s, reliable_s, payload, client_updated_at)
select id, 'rules-' || n, 'sprinter', now() - n * interval '1 day', now() - n * interval '1 day' + interval '30 minutes',
       5000, 1800, 1800, '{}'::jsonb, now() from fixture cross join generate_series(1, 2) n;

-- Simule une évolution des règles, annulée avec toute la transaction à la fin du test.
create or replace function private.run_rules_version() returns integer
language sql immutable set search_path = '' as $$ select 2 $$;
select is(private.recompute_validity(1), 1, 'un seul élément par lot');
select is((select count(*)::int from public.runs where rules_version = 2), 1, 'le trigger utilise la nouvelle version');
select is(private.recompute_validity(1), 1, 'la passe suivante reprend le lot restant');
select is(private.recompute_validity(1), 0, 'rejouer le job ne modifie aucune course à jour');
select * from finish();
rollback;
