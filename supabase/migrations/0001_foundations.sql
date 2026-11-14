-- 0001 — Fondations : schémas, extensions, fonctions utilitaires.
-- Règles (§5.1) : `public` est le seul schéma exposé par l'API ; `private` n'est jamais
-- accessible aux rôles client ; `authz` ne contient que les fonctions de contrôle
-- appelées par les policies RLS (droit d'exécution limité à `authenticated`).

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to service_role;

-- Les policies RLS s'évaluent avec les droits du rôle client : leurs fonctions d'aide
-- vivent dans un schéma séparé, non exposé, sans aucune table.
create schema if not exists authz;
revoke all on schema authz from public, anon;
grant usage on schema authz to authenticated, service_role;

create extension if not exists pg_trgm with schema extensions;
create extension if not exists unaccent with schema extensions;

-- Aucune fonction créée par les migrations n'est exécutable par défaut (Postgres accorde
-- EXECUTE à PUBLIC). Chaque fonction reçoit ensuite des droits explicites.
alter default privileges in schema public revoke execute on functions from public;
alter default privileges in schema private revoke execute on functions from public;
alter default privileges in schema authz revoke execute on functions from public;
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;

create or replace function private.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;
revoke all on function private.set_updated_at() from public, anon, authenticated;

-- Normalisation pour la recherche (sans accents ni casse). Déclarée IMMUTABLE avec un
-- dictionnaire explicite pour pouvoir servir dans un index d'expression.
create or replace function private.normalize_text(p_value text) returns text
language sql immutable strict parallel safe set search_path = '' as $$
  select lower(extensions.unaccent('extensions.unaccent'::regdictionary, p_value))
$$;
revoke all on function private.normalize_text(text) from public, anon, authenticated;
grant execute on function private.normalize_text(text) to service_role;

-- Identifiant court affiché dans l'admin (8 premiers caractères hexadécimaux).
create or replace function private.short_id(p_id uuid) returns text
language sql immutable strict parallel safe set search_path = '' as $$
  select left(replace(p_id::text, '-', ''), 8)
$$;
revoke all on function private.short_id(uuid) from public, anon, authenticated;

-- Masquage d'e-mail pour les listes admin : f***@gmail.com
create or replace function private.mask_email(p_email text) returns text
language sql immutable parallel safe set search_path = '' as $$
  select case
    when p_email is null or position('@' in p_email) < 2 then null
    else left(p_email, 1) || '***' || substr(p_email, position('@' in p_email))
  end
$$;
revoke all on function private.mask_email(text) from public, anon, authenticated;
