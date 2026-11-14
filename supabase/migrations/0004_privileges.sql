-- 0004 — Droits et policies (§5.3).
-- Principe : RLS sur toutes les tables de `public`, aucune écriture directe hors des
-- colonnes explicitement accordées, et contrôle « compte actif + session autorisée »
-- sur toute donnée privée, y compris avec un ancien JWT encore valide.

-- 1. Contrôle de session : compte existant et actif, session présente dans auth.sessions.
create or replace function authz.session_ok() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((
      select d.status = 'active'
      from private.user_directory d
      where d.user_id = auth.uid()
    ), false)
    and exists (
      select 1
      from auth.sessions s
      where s.id = case
          when (auth.jwt() ->> 'session_id') ~ '^[0-9a-fA-F-]{36}$' then (auth.jwt() ->> 'session_id')::uuid
        end
        and s.user_id = auth.uid()
        and (s.not_after is null or s.not_after > now())
    )
$$;
comment on function authz.session_ok() is 'Vrai si le JWT courant appartient à un compte actif et à une session non révoquée.';

-- Identifiant à comparer dans les policies : nul si la session n'est pas autorisée.
-- Toujours appelée sous la forme (select authz.active_uid()) pour n'être évaluée qu'une fois.
create or replace function authz.active_uid() returns uuid
language sql stable security definer set search_path = '' as $$
  select case when authz.session_ok() then auth.uid() end
$$;

revoke all on function authz.session_ok(), authz.active_uid() from public, anon;
grant execute on function authz.session_ok(), authz.active_uid() to authenticated, service_role;

-- Variante pour les RPC : lève une erreur explicite au lieu de renvoyer nul.
create or replace function private.require_uid() returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'unauthenticated' using errcode = '28000';
  end if;
  if not authz.session_ok() then
    raise exception 'forbidden' using errcode = '42501', hint = 'account_inactive_or_session_revoked';
  end if;
  return v_uid;
end $$;
revoke all on function private.require_uid() from public, anon, authenticated;

-- 2. RLS partout.
alter table public.profiles         enable row level security;
alter table public.user_preferences enable row level security;
alter table public.consent_log      enable row level security;
alter table public.runs             enable row level security;
alter table public.run_routes       enable row level security;
alter table public.user_devices     enable row level security;
alter table public.activity_days    enable row level security;
alter table public.app_config       enable row level security;
alter table public.support_requests enable row level security;

-- 3. Aucun droit implicite, puis droits minimaux.
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
grant all on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;
grant all on all tables in schema private to service_role;
grant usage, select on all sequences in schema private to service_role;

-- profiles : lecture et mise à jour des seuls champs du profil de compte.
grant select on public.profiles to authenticated;
grant update (display_name, country_code, city, age_band) on public.profiles to authenticated;
create policy profiles_select_own on public.profiles for select to authenticated
  using (user_id = (select authz.active_uid()));
create policy profiles_update_own on public.profiles for update to authenticated
  using (user_id = (select authz.active_uid()))
  with check (user_id = (select authz.active_uid()));

-- Lecture seule pour le propriétaire ; écritures par RPC SECURITY DEFINER.
grant select on public.user_preferences, public.consent_log, public.runs, public.run_routes,
  public.user_devices, public.activity_days to authenticated;
create policy user_preferences_select_own on public.user_preferences for select to authenticated
  using (user_id = (select authz.active_uid()));
create policy consent_log_select_own on public.consent_log for select to authenticated
  using (user_id = (select authz.active_uid()));
create policy runs_select_own on public.runs for select to authenticated
  using (user_id = (select authz.active_uid()));
create policy run_routes_select_own on public.run_routes for select to authenticated
  using (user_id = (select authz.active_uid()));
create policy user_devices_select_own on public.user_devices for select to authenticated
  using (user_id = (select authz.active_uid()));
create policy activity_days_select_own on public.activity_days for select to authenticated
  using (user_id = (select authz.active_uid()));

-- app_config : seule lecture anonyme autorisée, limitée aux valeurs publiques.
grant select (key, value, is_public, updated_at) on public.app_config to anon, authenticated;
create policy app_config_read_public on public.app_config for select to anon, authenticated
  using (is_public);

-- support_requests : projection propriétaire sans la note interne (privilèges de colonnes).
grant select (id, user_id, category, message, platform, app_version, status, created_at, updated_at, closed_at)
  on public.support_requests to authenticated;
create policy support_requests_select_own on public.support_requests for select to authenticated
  using (user_id = (select authz.active_uid()));
