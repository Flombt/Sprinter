-- Phase 4c : classements, analyses, k-anonymat (§9.2, §9.3, §10.4).
begin;
select plan(24);

create temporary table ids (name text primary key, id uuid) on commit drop;
grant select on ids to authenticated;
insert into ids values ('owner', tests.create_user('owner@example.test')), ('analyst', tests.create_user('analyst@example.test'));
insert into ids select 'u' || g, tests.create_user(format('runner%s@example.test', g)) from generate_series(1, 12) g;
insert into private.admin_users (user_id, role) values ((select id from ids where name = 'owner'), 'owner'), ((select id from ids where name = 'analyst'), 'analyst');
select tests.create_session(id) from ids;
-- Une course éligible par coureur (distance croissante), plus des courses non éligibles pour u1.
insert into public.runs (user_id, id, source, started_at, ended_at, active_s, distance_m, reliable_s, best_efforts, payload, client_updated_at)
select (select id from ids where name = 'u' || g), 'e' || g, 'sprinter', now() - interval '1 hour' - (g || ' minutes')::interval,
       now() - interval '1 hour' - (g || ' minutes')::interval + interval '1 minute', 1800, 5000 + g * 100, 1800, '{"1000": 330}', '{}', now()
from generate_series(1, 12) g;
insert into public.runs (user_id, id, source, started_at, ended_at, active_s, distance_m, reliable_s, payload, client_updated_at) values
  ((select id from ids where name = 'u1'), 'suspect', 'sprinter', now() - interval '3 hours', now() - interval '2 hours', 3600, 10000, 1000, '{}', now()),
  ((select id from ids where name = 'u1'), 'short', 'sprinter', now() - interval '5 hours', now() - interval '4 hours 50 minutes', 400, 900, 400, '{}', now()),
  ((select id from ids where name = 'u1'), 'healthkit:0f1e2d3c-4b5a-4968-8776-655443322110', 'healthkit', now() - interval '7 hours', now() - interval '6 hours', 3600, 42000, null, '{}', now());
select is((select validity from public.runs where id = 'suspect'), 'suspect', 'course suspecte (fiabilité GPS) préparée');
create temporary table res (k text primary key, v jsonb) on commit drop;
grant select, insert, update on res to authenticated;

select tests.login_as((select id from ids where name = 'owner'), null, 'aal2', 30);
insert into res values ('nominative', public.admin_leaderboard('distance_total', 'all', '{}', 'nominative', 'technical'));
insert into res values ('aggregate', public.admin_leaderboard('distance_total', 'all'));
insert into res values ('best1k', public.admin_leaderboard('best_effort_1k', 'all', '{}', 'nominative', 'technical'));
select throws_ok($$select public.admin_leaderboard('distance_total', 'all', '{}', 'nominative', null)$$, '22023', 'reason_required', 'nominatif : motif exigé');
select throws_ok($$select public.admin_leaderboard('age', 'all')$$, '22023', 'invalid_parameter:metric', 'métrique hors liste refusée');
select throws_ok($$select public.admin_leaderboard('distance_total', 'all', '{"city":["Lyon"]}')$$, '22023', null, 'filtre hors liste refusé');
insert into res values ('runs', public.admin_runs_stats(current_date - 1, current_date));
insert into res values ('signups', public.admin_analytics('signups', current_date - 6, current_date));
insert into res values ('activity', public.admin_analytics('activity', current_date - 6, current_date));
insert into res values ('hist', public.admin_analytics('distance_histogram', current_date - 6, current_date));
insert into res values ('retention', public.admin_analytics('retention', current_date - 6, current_date));
insert into res values ('platforms', public.admin_analytics('platform_compare', current_date - 6, current_date));
insert into res values ('country', public.admin_analytics('breakdown_country', current_date - 6, current_date));
select tests.logout();

select ok((select (v -> 'items' -> 0 ->> 'value')::numeric = 6.2 from res where k = 'nominative'), 'classement : le premier a la plus grande distance éligible');
select is((select jsonb_array_length(v -> 'items') from res where k = 'nominative'), 12, 'seuls les coureurs éligibles figurent');
select ok((select (v -> 'items') @> jsonb_build_array(jsonb_build_object('short_id', left(replace((select id from ids where name = 'u1')::text, '-', ''), 8), 'value', 5.1)) from res where k = 'nominative'),
  'courses suspecte, trop courte et importée exclues du total de u1');
select ok((select position('@' in v::text) = 0 and position('"points"' in v::text) = 0 from res where k = 'nominative'), 'ni e-mail ni tracé');
select is((select (v ->> 'eligible_users')::int from res where k = 'aggregate'), 12, 'mode agrégé : comptes éligibles');
select ok((select (v -> 'percentiles' ->> 'p50') is not null from res where k = 'aggregate'), 'mode agrégé : centiles');
select ok((select bool_and((b ->> 'users')::int >= 10) from res, jsonb_array_elements(v -> 'histogram') b where k = 'aggregate'), 'histogramme : aucune classe < 10 comptes');
select is((select v -> 'items' -> 0 ->> 'rank' from res where k = 'best1k'), '1', 'meilleurs efforts : rang 1');
select is((select count(*)::int from private.admin_audit_logs where action = 'leaderboard.view_nominative' and reason = 'technical'), 2, 'mode nominatif journalisé avec motif');
select is((select (v -> 'validity' ->> 'suspect')::int from res where k = 'runs'), 1, 'statistiques : courses suspectes comptées à part');
select ok((select v ->> 'method' like '%Σ temps actif ÷ Σ distance%' from res where k = 'runs'), 'méthode de calcul affichée');
select ok((select count(*) = 5 from res where k in ('signups', 'activity', 'hist', 'retention', 'platforms')), 'chaque vue d''analyse répond');

select tests.login_as((select id from ids where name = 'owner'), null, 'aal2', 3600);
select throws_ok($$select public.admin_leaderboard('distance_total', 'all', '{}', 'nominative', 'technical')$$, '42501', 'reauth_required', 'nominatif : ré-authentification exigée');
select tests.logout();
select tests.login_as((select id from ids where name = 'analyst'), null, 'aal2', 30);
select lives_ok($$select public.admin_leaderboard('distance_total', 'all')$$, 'analyst : mode agrégé autorisé');
select throws_ok($$select public.admin_leaderboard('distance_total', 'all', '{}', 'nominative', 'technical')$$, '42501', 'forbidden', 'analyst : mode nominatif refusé');
select tests.logout();

-- k-anonymat : « Autres » vaut 0 ou au moins 10 comptes ; aucune cellule masquée n'est déductible.
select is(private.k_anonymize('[{"key":"A","accounts":15},{"key":"B","accounts":12},{"key":"C","accounts":3}]') -> 'other' ->> 'accounts', '15',
  'une petite cellule entraîne la plus petite cellule visible dans « Autres »');
select is(jsonb_array_length(private.k_anonymize('[{"key":"A","accounts":15},{"key":"B","accounts":12},{"key":"C","accounts":3}]') -> 'rows'), 1, 'seule la cellule restante reste visible');
select ok(private.k_anonymize('[{"key":"A","accounts":15},{"key":"B","accounts":12}]') -> 'other' = 'null'::jsonb, 'aucun regroupement inutile');
select is(private.k_anonymize('[{"key":"A","accounts":5}]') ->> 'suppressed', 'true', 'moins de 10 comptes au total : tout est masqué');
select ok((select coalesce(bool_and((r ->> 'accounts')::int >= 10), true) from res, jsonb_array_elements(v -> 'rows') r where k = 'country')
          and (select v -> 'other' = 'null'::jsonb or (v -> 'other' ->> 'accounts')::int >= 10 from res where k = 'country'), 'ventilation par pays : seuil respecté');
select * from finish();
rollback;
