-- Phase 7 : classement communautaire facultatif.
begin;
select plan(17);
create temporary table ids (name text primary key, id uuid) on commit drop;
grant select on ids to authenticated;
insert into ids select 'u' || g, tests.create_user(format('camille%s@example.test', g)) from generate_series(1, 5) g;
select tests.create_session(id) from ids;
update public.profiles set display_name = 'Camille Martin' where user_id = (select id from ids where name = 'u1');
insert into public.runs (user_id, id, source, started_at, ended_at, active_s, distance_m, reliable_s, payload, client_updated_at)
select (select id from ids where name = 'u' || g), 'w' || g, 'sprinter', greatest(date_trunc('week', now() at time zone 'Europe/Paris') at time zone 'Europe/Paris' + interval '1 hour', now() - interval '2 hours'),
       greatest(date_trunc('week', now() at time zone 'Europe/Paris') at time zone 'Europe/Paris' + interval '2 hours', now() - interval '1 hour'), 1800, 4000 + g * 1000, 1800, '{}', now()
from generate_series(1, 5) g;

select tests.login_as((select id from ids where name = 'u1'));
select throws_ok($$select public.community_join('Rapide')$$, 'P0001', 'leaderboard_disabled', 'flag éteint : classement indisponible');
select tests.logout();
update public.app_config set value = 'true' where key = 'leaderboard_enabled';
select tests.login_as((select id from ids where name = 'u1'));
select throws_ok($$select public.community_join('Rapide')$$, '42501', 'consent_required', 'inscription explicite exigée');
select public.record_consent('community_leaderboard', '2026-11', true, gen_random_uuid(), now() - interval '1 hour');
select throws_ok($$select public.community_join('CamilleMartin')$$, '22023', 'invalid_parameter:handle_personal', 'le pseudo n''est pas le nom réel');
select throws_ok($$select public.community_join('camille1')$$, '22023', 'invalid_parameter:handle_personal', 'ni la partie locale de l''e-mail');
select throws_ok($$select public.community_join('AdminSprinter')$$, '22023', 'invalid_parameter:handle', 'pseudos réservés refusés');
select is(public.community_join('Rapide') ->> 'member', 'true', 'inscription au classement');
select tests.logout();
select tests.login_as((select id from ids where name = 'u2'));
select public.record_consent('community_leaderboard', '2026-11', true, gen_random_uuid(), now() - interval '1 hour');
select throws_ok($$select public.community_join('rapide')$$, '23505', 'handle_taken', 'pseudo unique sans tenir compte de la casse');
select public.community_join('Endurant');
create temporary table board (v jsonb) on commit drop;
grant insert, select, delete on board to authenticated;
insert into board select public.public_leaderboard('distance', 'week');
select is((select jsonb_array_length(v -> 'items') from board), 2, 'seuls les inscrits figurent');
select is((select v -> 'items' -> 0 ->> 'handle' from board), 'Endurant', 'tri par distance de la semaine');
select ok((select position('@' in v::text) = 0 and position('Camille' in v::text) = 0 and position('user_id' in v::text) = 0 from board), 'ni e-mail, ni nom réel, ni identifiant');
select tests.logout();

-- Signalements : trois signalements distincts masquent le pseudo.
select tests.login_as((select id from ids where name = 'u3'));
select is(public.community_report('Rapide', 'offensive') ->> 'reported', 'true', 'signalement enregistré');
select lives_ok($$select public.community_report('Rapide', 'offensive')$$, 'signalement rejoué sans doublon');
select tests.logout();
select tests.login_as((select id from ids where name = 'u4')); select public.community_report('Rapide', 'spam'); select tests.logout();
select tests.login_as((select id from ids where name = 'u5')); select public.community_report('Rapide', 'offensive'); select tests.logout();
select ok((select hidden_at is not null from public.community_members where handle = 'Rapide'), 'pseudo masqué après trois signalements');
select tests.login_as((select id from ids where name = 'u2'));
delete from board; insert into board select public.public_leaderboard('distance', 'week');
select is((select jsonb_array_length(v -> 'items') from board), 1, 'pseudo masqué absent du classement');
select is(public.community_leave() ->> 'member', 'false', 'retrait immédiat');
delete from board; insert into board select public.public_leaderboard('distance', 'week');
select is((select jsonb_array_length(v -> 'items') from board), 0, 'après retrait : plus de ligne');
select tests.logout();
select tests.login_as((select id from ids where name = 'u1'));
select public.record_consent('community_leaderboard', '2026-11', false, gen_random_uuid(), now());
select tests.logout();
select is((select count(*)::int from public.community_members where user_id = (select id from ids where name = 'u1')), 0, 'retrait du consentement : sortie immédiate');
select * from finish();
rollback;
