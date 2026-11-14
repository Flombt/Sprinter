-- 0014 — Classement communautaire facultatif (phase 7, §14, §9.2, §17.7).
-- Inscription explicite (consent_log community_leaderboard), pseudo volontaire et unique, aucune
-- donnée de lieu, de parcours ni de nom réel ; retrait immédiat ; signalement et masquage.

create table public.community_members (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  handle     text not null check (handle ~ '^[A-Za-z0-9][A-Za-z0-9_.-]{2,19}$'),
  joined_at  timestamptz not null default now(),
  hidden_at  timestamptz,
  hidden_reason text check (char_length(hidden_reason) <= 200)
);
create unique index community_members_handle_unique on public.community_members (lower(handle));
alter table public.community_members enable row level security;
revoke all on public.community_members from anon, authenticated;
grant all on public.community_members to service_role;
grant select (user_id, handle, joined_at, hidden_at) on public.community_members to authenticated;
create policy community_members_select_own on public.community_members for select to authenticated using (user_id = (select authz.active_uid()));

-- Signalements, communs au classement (phase 7) et aux profils partagés (phase 8c).
create table private.reports (
  id          uuid primary key default gen_random_uuid(),
  reporter_id uuid,                                   -- sans FK : le signalement survit au compte qui l'a fait
  target_user uuid not null,
  target_kind text not null check (target_kind in ('handle','profile','profile_element','theme')),
  target_ref  text not null check (char_length(target_ref) <= 200),
  excerpt     text check (char_length(excerpt) <= 280),
  reason      text not null check (reason in ('offensive','impersonation','personal_data','spam','other')),
  note        text check (char_length(note) <= 500),
  status      text not null default 'open' check (status in ('open','actioned','dismissed')),
  decision    text check (decision in ('hide','remove','restore','dismiss')),
  created_at  timestamptz not null default now(),
  handled_at  timestamptz,
  handled_by  uuid
);
create unique index reports_one_per_reporter on private.reports (reporter_id, target_kind, target_ref) where status = 'open';
create index reports_status_idx on private.reports (status, created_at);
grant all on private.reports to service_role;

create or replace function private.reserved_handle(p_handle text) returns boolean
language sql immutable set search_path = '' as $$
  select lower(p_handle) ~ '(admin|sprinter|support|moderat|officiel|official|staff|root|system)'
$$;

create or replace function public.community_join(p_handle text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := private.require_uid(); v_name text;
begin
  if not private.flag('leaderboard_enabled') then raise exception 'leaderboard_disabled' using errcode = 'P0001'; end if;
  if not private.has_consent(v_uid, 'community_leaderboard') then raise exception 'consent_required' using errcode = '42501'; end if;
  if p_handle is null or p_handle !~ '^[A-Za-z0-9][A-Za-z0-9_.-]{2,19}$' or private.reserved_handle(p_handle) then
    raise exception 'invalid_parameter:handle' using errcode = '22023';
  end if;
  -- Le pseudo n'est jamais le nom réel ni l'adresse e-mail du compte.
  select regexp_replace(coalesce(display_name_norm, ''), '[^a-z0-9]', '', 'g') into v_name from private.user_directory where user_id = v_uid;
  if (char_length(v_name) >= 4 and position(v_name in regexp_replace(private.normalize_text(p_handle), '[^a-z0-9]', '', 'g')) > 0)
     or lower(p_handle) = split_part((select email_norm from private.user_directory where user_id = v_uid), '@', 1) then
    raise exception 'invalid_parameter:handle_personal' using errcode = '22023';
  end if;
  begin
    insert into public.community_members (user_id, handle) values (v_uid, p_handle)
    on conflict (user_id) do update set handle = excluded.handle where public.community_members.hidden_at is null;
  exception when unique_violation then raise exception 'handle_taken' using errcode = '23505';
  end;
  return jsonb_build_object('handle', p_handle, 'member', true);
end $$;

create or replace function public.community_leave() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := private.require_uid();
begin
  delete from public.community_members where user_id = v_uid;
  return jsonb_build_object('member', false);
end $$;

-- Retrait du consentement : sortie immédiate du classement.
create or replace function private.community_consent_changed() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.purpose = 'community_leaderboard' and not new.granted then delete from public.community_members where user_id = new.user_id; end if;
  return null;
end $$;
create trigger consent_community_leave after insert on public.consent_log for each row execute function private.community_consent_changed();

-- Classement hebdomadaire (§9.2) : seuls les inscrits visibles, ni lieu, ni parcours, ni nom réel.
create or replace function public.public_leaderboard(p_scope text default 'distance', p_period text default 'week') returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_uid uuid := private.require_uid(); v_start timestamptz; v_end timestamptz; v_top jsonb; v_me jsonb;
begin
  if not private.flag('leaderboard_enabled') then raise exception 'leaderboard_disabled' using errcode = 'P0001'; end if;
  if p_scope not in ('distance','runs','active_days') then raise exception 'invalid_parameter:scope' using errcode = '22023'; end if;
  if p_period not in ('week','last_week') then raise exception 'invalid_parameter:period' using errcode = '22023'; end if;
  v_start := private.paris_start(date_trunc('week', now() at time zone 'Europe/Paris')::date - case when p_period = 'last_week' then 7 else 0 end);
  v_end := v_start + interval '7 days';
  with scores as (
    select m.user_id, m.handle,
      case p_scope when 'distance' then round(sum(r.distance_m) / 1000, 1) when 'runs' then count(*)::numeric
        else count(distinct (r.started_at at time zone coalesce(r.tz, 'Europe/Paris'))::date)::numeric end as value,
      max(r.started_at) as reached_at
    from public.community_members m
    join public.runs r on r.user_id = m.user_id and r.deleted_at is null and r.source = 'sprinter' and r.validity = 'valid'
      and r.distance_m >= 1000 and r.active_s >= 300 and r.started_at >= v_start and r.started_at < v_end
    join private.user_directory d on d.user_id = m.user_id and d.status = 'active'
    where m.hidden_at is null
    group by m.user_id, m.handle
  ), ranked as (select s.*, rank() over (order by value desc, reached_at asc) as position from scores s)
  select coalesce((select jsonb_agg(jsonb_build_object('rank', position, 'handle', handle, 'value', value, 'me', user_id = v_uid) order by position, handle)
                   from ranked where position <= 50), '[]'::jsonb),
         (select jsonb_build_object('rank', position, 'value', value) from ranked where user_id = v_uid)
    into v_top, v_me;
  return jsonb_build_object('scope', p_scope, 'period', p_period, 'from', v_start, 'to', v_end, 'items', v_top, 'me', v_me,
    'member', exists (select 1 from public.community_members where user_id = v_uid),
    'method', 'Courses Sprinter valides d’au moins 1 km et 5 minutes, semaine du lundi au dimanche (heure de Paris).');
end $$;

-- Signalement d'un pseudo : trois signalements distincts masquent le pseudo en attendant l'examen.
create or replace function public.community_report(p_handle text, p_reason text, p_note text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := private.require_uid(); v_target uuid;
begin
  if p_reason not in ('offensive','impersonation','personal_data','spam','other') then raise exception 'invalid_parameter:reason' using errcode = '22023'; end if;
  select user_id into v_target from public.community_members where lower(handle) = lower(p_handle);
  if v_target is null or v_target = v_uid then raise exception 'not_found' using errcode = 'P0002'; end if;
  insert into private.reports (reporter_id, target_user, target_kind, target_ref, excerpt, reason, note)
  values (v_uid, v_target, 'handle', lower(p_handle), p_handle, p_reason, left(p_note, 500))
  on conflict do nothing;
  if (select count(distinct reporter_id) from private.reports where target_kind = 'handle' and target_ref = lower(p_handle) and status = 'open') >= 3 then
    update public.community_members set hidden_at = now(), hidden_reason = 'reports_threshold' where user_id = v_target and hidden_at is null;
  end if;
  return jsonb_build_object('reported', true);
end $$;

-- Suppression du compte : le pseudo disparaît du classement dès la validation (§6.6).
create or replace function private.on_account_deleting(p_user_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.community_members where user_id = p_user_id;
end $$;

revoke all on function private.reserved_handle(text), private.community_consent_changed(), private.on_account_deleting(uuid) from public, anon, authenticated;
revoke all on function public.community_join(text), public.community_leave(), public.public_leaderboard(text, text), public.community_report(text, text, text) from public, anon;
grant execute on function public.community_join(text), public.community_leave(), public.public_leaderboard(text, text), public.community_report(text, text, text) to authenticated;
