-- 0005 — Triggers de base et configuration initiale (flags éteints).

-- Création du compte : profil vide + entrée d'annuaire (état actif).
create or replace function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (user_id) values (new.id) on conflict (user_id) do nothing;
  insert into private.user_directory (user_id, email_norm, providers, signed_up_at)
  values (
    new.id,
    lower(new.email),
    coalesce((select array_agg(distinct p order by p)
              from jsonb_array_elements_text(coalesce(new.raw_app_meta_data -> 'providers', '[]'::jsonb)) as p), '{}'),
    coalesce(new.created_at, now())
  )
  on conflict (user_id) do nothing;
  return new;
end $$;

create or replace function private.handle_user_updated() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update private.user_directory
     set email_norm = lower(new.email)
   where user_id = new.id and email_norm is distinct from lower(new.email);
  return new;
end $$;

-- Les fournisseurs reflètent les identités réellement liées (ajout et retrait de méthode).
create or replace function private.handle_identity_change() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_user uuid := coalesce(new.user_id, old.user_id);
begin
  update private.user_directory d
     set providers = coalesce((select array_agg(distinct i.provider order by i.provider)
                               from auth.identities i where i.user_id = v_user), '{}')
   where d.user_id = v_user;
  return null;
end $$;

-- Nom normalisé pour la recherche admin, calculé avec les droits du propriétaire.
create or replace function private.handle_profile_name() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update private.user_directory
     set display_name_norm = private.normalize_text(new.display_name)
   where user_id = new.user_id;
  return null;
end $$;

revoke all on function private.handle_new_user(), private.handle_user_updated(), private.handle_identity_change(),
  private.handle_profile_name() from public, anon, authenticated;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();
create trigger on_auth_user_updated after update of email on auth.users
  for each row execute function private.handle_user_updated();
create trigger on_auth_identity_changed after insert or update or delete on auth.identities
  for each row execute function private.handle_identity_change();

create trigger profiles_directory_name after insert or update of display_name on public.profiles
  for each row execute function private.handle_profile_name();
create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function private.set_updated_at();
create trigger support_requests_set_updated_at before update on public.support_requests
  for each row execute function private.set_updated_at();
create trigger user_preferences_set_updated_at before update on public.user_preferences
  for each row execute function private.set_updated_at();
create trigger app_config_set_updated_at before update on public.app_config
  for each row execute function private.set_updated_at();

-- Configuration initiale : tout nouveau comportement reste éteint (décision 21).
insert into public.app_config (key, value) values
  ('accounts_enabled', 'false'::jsonb),
  ('sync_enabled', 'false'::jsonb)
on conflict (key) do nothing;
