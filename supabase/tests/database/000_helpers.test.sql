-- Fonctions d'aide aux tests (schéma `tests`, créé uniquement dans la base de test).
-- Ce fichier s'exécute en premier (ordre alphabétique) et n'est pas annulé.
create extension if not exists pgtap with schema extensions;

create schema if not exists tests;
grant usage on schema tests to anon, authenticated, service_role;

-- Crée un utilisateur Auth synthétique et son identité.
create or replace function tests.create_user(p_email text, p_provider text default 'email', p_meta jsonb default '{}'::jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid := gen_random_uuid();
begin
  insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values (v_id, p_email, jsonb_build_object('provider', p_provider, 'providers', jsonb_build_array(p_provider)), p_meta, now(), now());
  -- identities.email est une colonne générée par Supabase à partir de identity_data.
  insert into auth.identities (provider_id, user_id, provider, identity_data, created_at, updated_at)
  values (case when p_provider = 'email' then v_id::text else p_provider || '-' || v_id::text end, v_id, p_provider,
          jsonb_build_object('sub', v_id::text, 'email', p_email), now(), now());
  return v_id;
end $$;

create or replace function tests.create_session(p_user uuid, p_aal text default 'aal1')
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid := gen_random_uuid();
begin
  insert into auth.sessions (id, user_id, aal, created_at, updated_at) values (v_id, p_user, p_aal::auth.aal_level, now(), now());
  return v_id;
end $$;

-- Simule une requête PostgREST authentifiée (rôle + claims JWT pour la transaction).
-- p_auth_age : ancienneté (s) de la dernière authentification réelle, pour les contrôles de réauth.
create or replace function tests.login_as(p_user uuid, p_session uuid default null, p_aal text default 'aal1', p_auth_age int default 3600)
returns void language plpgsql set search_path = '' as $$
declare
  v_session uuid := coalesce(p_session, (select s.id from auth.sessions s where s.user_id = p_user order by s.created_at desc limit 1));
  v_now bigint := extract(epoch from now())::bigint;
begin
  perform set_config('request.jwt.claims', jsonb_build_object(
    'sub', p_user::text, 'role', 'authenticated', 'aud', 'authenticated', 'aal', p_aal,
    'session_id', v_session::text, 'iat', v_now - 10, 'exp', v_now + 3600,
    'amr', jsonb_build_array(jsonb_build_object('method', case when p_aal = 'aal2' then 'totp' else 'otp' end, 'timestamp', v_now - p_auth_age))
  )::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

create or replace function tests.login_anon() returns void language plpgsql set search_path = '' as $$
begin
  perform set_config('request.jwt.claims', jsonb_build_object('role', 'anon')::text, true);
  perform set_config('role', 'anon', true);
end $$;

create or replace function tests.logout() returns void language plpgsql set search_path = '' as $$
begin
  perform set_config('request.jwt.claims', '', true);
  perform set_config('role', 'postgres', true);
end $$;

grant execute on all functions in schema tests to anon, authenticated, service_role;

select plan(1);
select ok(to_regprocedure('tests.login_as(uuid,uuid,text,integer)') is not null, 'fonctions d''aide aux tests installées');
select * from finish();
