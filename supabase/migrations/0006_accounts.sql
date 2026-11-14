-- 0006 — Comptes (phase 1) : consentements, appareils, mesure d'usage, « Mes données »,
-- suppression reprenable et conservation chiffrée du jeton Apple.

-- ---------------------------------------------------------------------------------------
-- Consentements (§6.5) : ajout idempotent, la dernière décision confirmée fait foi.
-- ---------------------------------------------------------------------------------------
create or replace function public.record_consent(
  p_purpose text, p_version text, p_granted boolean, p_client_event_id uuid, p_client_at timestamptz
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_uid();
  v_at timestamptz := least(p_client_at, now());
  v_row public.consent_log;
begin
  if p_purpose is null or p_purpose not in ('terms','privacy_policy','cloud_sync_runs','cloud_sync_routes','community_leaderboard') then
    raise exception 'invalid_parameter:purpose' using errcode = '22023';
  end if;
  if p_version is null or p_version !~ '^[A-Za-z0-9._-]{1,20}$' then
    raise exception 'invalid_parameter:version' using errcode = '22023';
  end if;
  if p_granted is null or p_client_event_id is null or p_client_at is null then
    raise exception 'invalid_parameter:event' using errcode = '22023';
  end if;
  -- Sérialise les décisions d'un même compte pour une même finalité.
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text || ':' || p_purpose, 0));

  select * into v_row from public.consent_log where user_id = v_uid and client_event_id = p_client_event_id;
  if found then
    return jsonb_build_object('status', 'duplicate', 'purpose', v_row.purpose, 'granted', v_row.granted,
                              'version', v_row.version, 'at', v_row.client_at, 'effective', private.current_consent(v_uid, p_purpose));
  end if;

  select * into v_row from public.consent_log
   where user_id = v_uid and purpose = p_purpose order by client_at desc, id desc limit 1;
  if found and v_row.client_at > v_at then
    -- Décision plus récente déjà confirmée ailleurs : le titulaire doit choisir à nouveau.
    return jsonb_build_object('status', 'stale', 'purpose', p_purpose, 'effective', private.current_consent(v_uid, p_purpose));
  end if;

  insert into public.consent_log (user_id, purpose, version, granted, client_event_id, client_at)
  values (v_uid, p_purpose, p_version, p_granted, p_client_event_id, v_at)
  returning * into v_row;
  return jsonb_build_object('status', 'applied', 'purpose', v_row.purpose, 'granted', v_row.granted,
                            'version', v_row.version, 'at', v_row.client_at, 'effective', private.current_consent(v_uid, p_purpose));
end $$;

create or replace function private.current_consent(p_user uuid, p_purpose text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce((
    select jsonb_build_object('granted', c.granted, 'version', c.version, 'at', c.client_at)
    from public.consent_log c
    where c.user_id = p_user and c.purpose = p_purpose
    order by c.client_at desc, c.id desc limit 1), 'null'::jsonb)
$$;

create or replace function private.has_consent(p_user uuid, p_purpose text) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((private.current_consent(p_user, p_purpose) ->> 'granted')::boolean, false)
$$;

create or replace function public.my_consents() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_uid uuid := private.require_uid();
begin
  return (select jsonb_object_agg(p, private.current_consent(v_uid, p))
          from unnest(array['terms','privacy_policy','cloud_sync_runs','cloud_sync_routes','community_leaderboard']) as p);
end $$;

-- ---------------------------------------------------------------------------------------
-- Appareils (§6.3, §6.5) : une session par appareil, déconnexion à distance.
-- ---------------------------------------------------------------------------------------
alter table public.user_devices add column session_id uuid;

create or replace function public.register_device(
  p_device_id uuid, p_platform text, p_os_version text default null, p_app_version text default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_uid();
  v_session uuid := case when (auth.jwt() ->> 'session_id') ~ '^[0-9a-fA-F-]{36}$' then (auth.jwt() ->> 'session_id')::uuid end;
begin
  if p_device_id is null then raise exception 'invalid_parameter:device_id' using errcode = '22023'; end if;
  if p_platform is null or p_platform not in ('ios','android') then raise exception 'invalid_parameter:platform' using errcode = '22023'; end if;
  insert into public.user_devices (user_id, device_id, platform, os_version, app_version, last_seen_at, session_id)
  values (v_uid, p_device_id, p_platform, left(p_os_version, 32), left(p_app_version, 32), now(), v_session)
  on conflict (user_id, device_id) do update
    set platform = excluded.platform, os_version = excluded.os_version, app_version = excluded.app_version,
        last_seen_at = now(), session_id = excluded.session_id;
  -- Au plus 20 appareils : les plus anciens sortent de la liste.
  delete from public.user_devices
   where user_id = v_uid and device_id in (
     select device_id from public.user_devices where user_id = v_uid order by last_seen_at desc offset 20);
  return jsonb_build_object('device_id', p_device_id, 'registered', true);
end $$;

create or replace function public.disconnect_device(p_device_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_uid();
  v_session uuid;
  v_revoked int := 0;
begin
  delete from public.user_devices where user_id = v_uid and device_id = p_device_id returning session_id into v_session;
  if not found then return jsonb_build_object('disconnected', false); end if;
  if v_session is not null then
    delete from auth.sessions where id = v_session and user_id = v_uid;
    get diagnostics v_revoked = row_count;
  end if;
  return jsonb_build_object('disconnected', true, 'session_revoked', v_revoked > 0);
end $$;

-- ---------------------------------------------------------------------------------------
-- Mesure d'usage minimale (§5, décision 13) : un jour local, borné à [hier, demain].
-- ---------------------------------------------------------------------------------------
create or replace function public.touch_activity(p_day date, p_device_id uuid default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := private.require_uid();
begin
  if p_day is null or p_day < current_date - 1 or p_day > current_date + 1 then
    raise exception 'invalid_parameter:day' using errcode = '22023';
  end if;
  insert into public.activity_days (user_id, day) values (v_uid, p_day) on conflict (user_id, day) do nothing;
  update private.user_directory set last_active_day = greatest(coalesce(last_active_day, p_day), p_day) where user_id = v_uid;
  if p_device_id is not null then
    update public.user_devices set last_seen_at = now() where user_id = v_uid and device_id = p_device_id;
  end if;
  return jsonb_build_object('day', p_day);
end $$;

-- ---------------------------------------------------------------------------------------
-- « Mes données » (§6.5) : uniquement les données du titulaire.
-- ---------------------------------------------------------------------------------------
create or replace function public.my_data_summary() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_uid uuid := private.require_uid();
begin
  return jsonb_build_object(
    'runs', (select count(*) from public.runs where user_id = v_uid and deleted_at is null),
    'routes', (select count(*) from public.run_routes where user_id = v_uid),
    'online_bytes', coalesce((select sum(octet_length(payload::text)) from public.runs where user_id = v_uid and deleted_at is null), 0)
                    + coalesce((select sum(bytes) from public.run_routes where user_id = v_uid), 0),
    'devices', coalesce((select jsonb_agg(jsonb_build_object(
        'device_id', d.device_id, 'platform', d.platform, 'os_version', d.os_version, 'app_version', d.app_version,
        'last_seen_at', d.last_seen_at, 'last_sync_at', d.last_sync_at, 'last_sync_status', d.last_sync_status,
        'current', d.session_id is not distinct from case when (auth.jwt() ->> 'session_id') ~ '^[0-9a-fA-F-]{36}$' then (auth.jwt() ->> 'session_id')::uuid end)
        order by d.last_seen_at desc) from public.user_devices d where d.user_id = v_uid), '[]'::jsonb),
    'consents', coalesce((select jsonb_agg(jsonb_build_object('purpose', c.purpose, 'granted', c.granted, 'version', c.version, 'at', c.client_at)
        order by c.client_at desc, c.id desc) from (select * from public.consent_log where user_id = v_uid order by client_at desc, id desc limit 100) c), '[]'::jsonb),
    'support_requests', (select count(*) from public.support_requests where user_id = v_uid)
  );
end $$;

-- ---------------------------------------------------------------------------------------
-- Suppression de compte (§6.6) : accès retirés dès la validation, nettoyage reprenable.
-- ---------------------------------------------------------------------------------------
create table private.deletion_requests (
  user_id      uuid primary key,   -- sans FK : la trace minimale survit à la suppression
  source       text not null check (source in ('app','web','admin')),
  operation_id uuid not null,
  status       text not null default 'pending' check (status in ('pending','processing','done','failed')),
  requested_at timestamptz not null default now(),
  attempts     int not null default 0,
  last_error   text check (char_length(last_error) <= 200),
  completed_at timestamptz
);
comment on table private.deletion_requests is 'Trace technique minimale (aucune donnée de contenu) permettant de reprendre une suppression interrompue.';

-- Jeton de rafraîchissement Apple chiffré par l'Edge Function apple-link (clé hors base).
create table private.apple_tokens (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  ciphertext  text not null check (char_length(ciphertext) <= 4096),
  key_version int not null default 1,
  updated_at  timestamptz not null default now()
);

create or replace function public.service_begin_account_deletion(p_user_id uuid, p_source text, p_operation_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_request private.deletion_requests;
begin
  if p_source not in ('app','web','admin') or p_operation_id is null then
    raise exception 'invalid_parameter' using errcode = '22023';
  end if;
  select * into v_request from private.deletion_requests where user_id = p_user_id for update;
  if found and v_request.status = 'done' then
    return jsonb_build_object('status', 'done', 'operation_id', v_request.operation_id);
  end if;
  if not found then
    if not exists (select 1 from auth.users where id = p_user_id) then
      return jsonb_build_object('status', 'not_found');
    end if;
    insert into private.deletion_requests (user_id, source, operation_id, status)
    values (p_user_id, p_source, p_operation_id, 'processing')
    returning * into v_request;
    insert into private.admin_audit_logs (admin_id, action, target_user_id, metadata)
    values (null, 'account.deletion_requested', p_user_id, jsonb_build_object('source', p_source, 'operation_id', p_operation_id));
  else
    update private.deletion_requests set status = 'processing', attempts = attempts + 1 where user_id = p_user_id
    returning * into v_request;
  end if;
  -- Accès retirés immédiatement et sans retour possible, même si le nettoyage échoue ensuite.
  update private.user_directory set status = 'deleting', status_changed_at = now() where user_id = p_user_id;
  delete from auth.sessions where user_id = p_user_id;
  perform private.on_account_deleting(p_user_id);
  return jsonb_build_object('status', 'processing', 'operation_id', v_request.operation_id, 'attempts', v_request.attempts);
end $$;

-- Point d'extension : les phases suivantes retirent ici les publications (classement, profil).
create or replace function private.on_account_deleting(p_user_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform p_user_id;
end $$;

create or replace function public.service_finish_account_deletion(p_user_id uuid, p_operation_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  update private.deletion_requests
     set status = 'done', completed_at = now(), last_error = null
   where user_id = p_user_id and operation_id = p_operation_id and status <> 'done';
  if found then
    insert into private.admin_audit_logs (admin_id, action, target_user_id, metadata)
    values (null, 'account.deleted', p_user_id, jsonb_build_object('operation_id', p_operation_id));
  end if;
  return jsonb_build_object('status', 'done');
end $$;

create or replace function public.service_fail_account_deletion(p_user_id uuid, p_error text)
returns void language sql security definer set search_path = '' as $$
  update private.deletion_requests
     set status = 'failed', last_error = left(regexp_replace(coalesce(p_error, 'unknown'), '[^a-zA-Z0-9_.: -]', '', 'g'), 200)
   where user_id = p_user_id and status <> 'done';
$$;

create or replace function public.service_pending_deletions(p_limit int default 20)
returns table (user_id uuid, operation_id uuid, source text, attempts int)
language sql stable security definer set search_path = '' as $$
  select d.user_id, d.operation_id, d.source, d.attempts
  from private.deletion_requests d
  where d.status in ('pending','processing','failed') and d.attempts < 20
    and (d.status <> 'processing' or d.requested_at < now() - interval '10 minutes')
  order by d.requested_at
  limit least(greatest(coalesce(p_limit, 20), 1), 100);
$$;

create or replace function public.service_store_apple_token(p_user_id uuid, p_ciphertext text, p_key_version int default 1)
returns void language sql security definer set search_path = '' as $$
  insert into private.apple_tokens (user_id, ciphertext, key_version, updated_at)
  values (p_user_id, p_ciphertext, coalesce(p_key_version, 1), now())
  on conflict (user_id) do update set ciphertext = excluded.ciphertext, key_version = excluded.key_version, updated_at = now();
$$;

create or replace function public.service_get_apple_token(p_user_id uuid)
returns table (ciphertext text, key_version int)
language sql stable security definer set search_path = '' as $$
  select t.ciphertext, t.key_version from private.apple_tokens t where t.user_id = p_user_id;
$$;

-- Suivi par l'app d'une suppression validée (le titulaire n'a plus de session) :
-- l'identifiant d'opération, aléatoire et connu du seul demandeur, ne renvoie qu'un statut.
create or replace function public.service_deletion_status(p_operation_id uuid) returns text
language sql stable security definer set search_path = '' as $$
  select status from private.deletion_requests where operation_id = p_operation_id;
$$;

create or replace function public.service_account_state(p_user_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'status', (select status from private.user_directory where user_id = p_user_id),
    'deletion', (select jsonb_build_object('status', status, 'operation_id', operation_id, 'attempts', attempts)
                 from private.deletion_requests where user_id = p_user_id))
$$;

-- ---------------------------------------------------------------------------------------
-- Droits d'exécution.
-- ---------------------------------------------------------------------------------------
revoke all on function public.record_consent(text, text, boolean, uuid, timestamptz), public.my_consents(),
  public.register_device(uuid, text, text, text), public.disconnect_device(uuid), public.touch_activity(date, uuid),
  public.my_data_summary() from public, anon;
grant execute on function public.record_consent(text, text, boolean, uuid, timestamptz), public.my_consents(),
  public.register_device(uuid, text, text, text), public.disconnect_device(uuid), public.touch_activity(date, uuid),
  public.my_data_summary() to authenticated;

revoke all on function public.service_begin_account_deletion(uuid, text, uuid), public.service_finish_account_deletion(uuid, uuid),
  public.service_fail_account_deletion(uuid, text), public.service_pending_deletions(int), public.service_store_apple_token(uuid, text, int),
  public.service_get_apple_token(uuid), public.service_account_state(uuid), public.service_deletion_status(uuid) from public, anon, authenticated;
grant execute on function public.service_begin_account_deletion(uuid, text, uuid), public.service_finish_account_deletion(uuid, uuid),
  public.service_fail_account_deletion(uuid, text), public.service_pending_deletions(int), public.service_store_apple_token(uuid, text, int),
  public.service_get_apple_token(uuid), public.service_account_state(uuid), public.service_deletion_status(uuid) to service_role;

revoke all on function private.current_consent(uuid, text), private.has_consent(uuid, text), private.on_account_deleting(uuid)
  from public, anon, authenticated;
grant all on private.deletion_requests, private.apple_tokens to service_role;
