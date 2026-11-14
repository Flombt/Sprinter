-- 0015 — Profil personnalisé, version privée (phase 8a, §17.1, §17.3 à §17.6, §17.8, §17.9).
-- Surface distincte du profil de compte (§6.5). En 8a, tout est privé : seul le titulaire lit et écrit.
-- Écritures élément par élément, rejouables (op_id) et contrôlées par révision : deux modifications
-- simultanées d'un même élément sont détectées, des éléments distincts fusionnent sans conflit (§17.6).

-- ---------------------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------------------
create table public.profile_elements (
  user_id uuid not null references auth.users (id) on delete cascade,
  element_key text not null check (element_key ~ '^(identity|appearance|avatar|banner|about|status|layout|widget:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$'),
  kind text generated always as (split_part(element_key, ':', 1)) stored,
  payload jsonb not null default '{}'::jsonb,
  deleted boolean not null default false,
  revision integer not null default 1 check (revision > 0),
  last_op_id uuid,
  client_updated_at timestamptz not null,
  server_updated_at timestamptz not null default now(),
  primary key (user_id, element_key)
);
comment on table public.profile_elements is
  'Profil personnalisé (§17), version privée enregistrée. Un élément : identité de présentation, apparence, avatar, bannière, présentation, statut, disposition ou widget. Distinct du profil de compte (§6.5).';

create table public.profile_media (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  usage text not null check (usage in ('avatar', 'banner', 'gallery')),
  mime text not null,
  bytes integer not null check (bytes > 0),
  width integer not null check (width between 16 and 4096),
  height integer not null check (height between 16 and 4096),
  animated boolean not null default false,
  duration_ms integer check (duration_ms is null or duration_ms between 0 and 60000),
  storage_path text not null unique,
  status text not null default 'pending' check (status in ('pending', 'ready', 'deleted')),
  created_at timestamptz not null default now(),
  ready_at timestamptz
);
create index profile_media_user_idx on public.profile_media (user_id, status);
comment on table public.profile_media is
  'Médias du profil (stockage privé profile-media). pending → ready après vérification du type réel, des dimensions et de l’absence de localisation (fonction profile-media-commit).';

alter table public.profile_elements enable row level security;
alter table public.profile_media enable row level security;
revoke all on public.profile_elements, public.profile_media from anon, authenticated;
grant all on public.profile_elements, public.profile_media to service_role;
grant select on public.profile_elements, public.profile_media to authenticated;
create policy profile_elements_select_own on public.profile_elements for select to authenticated
  using (user_id = (select authz.active_uid()));
create policy profile_media_select_own on public.profile_media for select to authenticated
  using (user_id = (select authz.active_uid()));

-- ---------------------------------------------------------------------------------------
-- Activation (§17.9) : la coupure s'applique côté serveur, sans attendre le cache de l'app.
-- ---------------------------------------------------------------------------------------
create or replace function private.require_profiles() returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := private.require_uid();
begin
  if not (private.flag('accounts_enabled') and private.flag('profiles_enabled')) then
    raise exception 'feature_disabled' using errcode = 'P0001', hint = 'feature_flag';
  end if;
  return v_uid;
end $$;

-- Limites initiales proposées au §17.8 (à confirmer sur appareils avant activation).
create or replace function private.profile_limits() returns jsonb
language sql immutable set search_path = '' as $$
  select jsonb_build_object('image_bytes', 5242880, 'animation_bytes', 8388608, 'animation_ms', 8000,
    'widgets', 8, 'configurations', 5, 'gallery_images', 5, 'media', 20)
$$;

-- Formats acceptés : JPEG, PNG et WebP statiques en 8a (les formats animés arrivent en 8b).
create or replace function private.profile_media_max_bytes(p_mime text, p_animated boolean default false) returns integer
language sql immutable set search_path = '' as $$
  select case when not coalesce(p_animated, false) and p_mime in ('image/jpeg', 'image/png', 'image/webp')
              then (private.profile_limits() ->> 'image_bytes')::int end
$$;
create or replace function private.profile_media_ext(p_mime text) returns text
language sql immutable set search_path = '' as $$
  select case p_mime when 'image/jpeg' then 'jpg' when 'image/png' then 'png' when 'image/webp' then 'webp' when 'image/gif' then 'gif' end
$$;

-- ---------------------------------------------------------------------------------------
-- Validation des contenus : types et styles prédéfinis, textes bornés, aucun HTML interprété (§17.9).
-- ---------------------------------------------------------------------------------------
create or replace function private.profile_keys_ok(p_payload jsonb, p_allowed text[]) returns boolean
language sql immutable set search_path = '' as $$
  select coalesce(bool_and(k = any (p_allowed)), true) from jsonb_object_keys(p_payload) k
$$;
create or replace function private.profile_text_ok(p_value jsonb, p_max int) returns boolean
language sql immutable set search_path = '' as $$
  select p_value is null or p_value = 'null'::jsonb
      or (jsonb_typeof(p_value) = 'string' and char_length(p_value #>> '{}') <= p_max
          and (p_value #>> '{}') !~ '[\x01-\x08\x0b\x0c\x0e-\x1f\x7f]')
$$;
create or replace function private.profile_id_ok(p_value jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select jsonb_typeof(p_value) = 'string' and (p_value #>> '{}') ~ '^[a-z0-9-]{1,32}$'
$$;
create or replace function private.profile_uuid_ok(p_value jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select jsonb_typeof(p_value) = 'string' and (p_value #>> '{}') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
$$;
create or replace function private.profile_hex_ok(p_value jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select jsonb_typeof(p_value) = 'string' and (p_value #>> '{}') ~ '^#[0-9a-fA-F]{6}$'
$$;
create or replace function private.profile_number_between(p_value jsonb, p_min numeric, p_max numeric) returns boolean
language sql immutable set search_path = '' as $$
  select jsonb_typeof(p_value) = 'number' and (p_value #>> '{}')::numeric between p_min and p_max
$$;
create or replace function private.profile_crop_ok(p_value jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select jsonb_typeof(p_value) = 'object'
     and private.profile_keys_ok(p_value, array['x', 'y', 'zoom'])
     and (not p_value ? 'x' or private.profile_number_between(p_value -> 'x', -1, 1))
     and (not p_value ? 'y' or private.profile_number_between(p_value -> 'y', -1, 1))
     and (not p_value ? 'zoom' or private.profile_number_between(p_value -> 'zoom', 1, 4))
$$;
create or replace function private.profile_string_array_ok(p_value jsonb, p_max_items int, p_max_len int) returns boolean
language sql immutable set search_path = '' as $$
  select jsonb_typeof(p_value) = 'array' and jsonb_array_length(p_value) <= p_max_items
     and coalesce((select bool_and(private.profile_text_ok(v, p_max_len) and jsonb_typeof(v) = 'string' and char_length(v #>> '{}') > 0)
                     from jsonb_array_elements(p_value) v), true)
$$;

-- Renvoie null si le contenu est valide, sinon un code court. Redéfinie par les phases suivantes (8b).
create or replace function private.profile_payload_error(p_kind text, p_payload jsonb) returns text
language plpgsql stable set search_path = '' as $$
declare v_source text;
begin
  if jsonb_typeof(p_payload) is distinct from 'object' then return 'payload_type'; end if;
  if octet_length(p_payload::text) > 4096 then return 'payload_size'; end if;
  case p_kind
    when 'identity' then
      if not private.profile_keys_ok(p_payload, array['name']) or not private.profile_text_ok(p_payload -> 'name', 40) then return 'identity'; end if;
    when 'appearance' then
      if not private.profile_keys_ok(p_payload, array['theme', 'accent']) or not private.profile_id_ok(p_payload -> 'theme')
         or (p_payload ? 'accent' and not private.profile_id_ok(p_payload -> 'accent')) then return 'appearance'; end if;
    when 'avatar' then
      v_source := p_payload ->> 'source';
      if not private.profile_keys_ok(p_payload, array['source', 'libraryId', 'mediaId', 'crop'])
         or coalesce(v_source, '') not in ('default', 'library', 'media')
         or (v_source = 'library' and not private.profile_id_ok(p_payload -> 'libraryId'))
         or (v_source = 'media' and not private.profile_uuid_ok(p_payload -> 'mediaId'))
         or (v_source <> 'media' and p_payload ? 'mediaId')
         or (p_payload ? 'crop' and not private.profile_crop_ok(p_payload -> 'crop')) then return 'avatar'; end if;
    when 'banner' then
      v_source := p_payload ->> 'source';
      if not private.profile_keys_ok(p_payload, array['source', 'presetId', 'colors', 'mediaId', 'crop'])
         or coalesce(v_source, '') not in ('default', 'preset', 'color', 'gradient', 'media')
         or (v_source = 'preset' and not private.profile_id_ok(p_payload -> 'presetId'))
         or (v_source in ('color', 'gradient') and not (jsonb_typeof(p_payload -> 'colors') = 'array'
              and jsonb_array_length(p_payload -> 'colors') between (case v_source when 'color' then 1 else 2 end) and 3
              and (select bool_and(private.profile_hex_ok(c)) from jsonb_array_elements(p_payload -> 'colors') c)))
         or (v_source = 'media' and not private.profile_uuid_ok(p_payload -> 'mediaId'))
         or (v_source <> 'media' and p_payload ? 'mediaId')
         or (p_payload ? 'crop' and not private.profile_crop_ok(p_payload -> 'crop')) then return 'banner'; end if;
    when 'about' then
      if not private.profile_keys_ok(p_payload, array['bio']) or not private.profile_text_ok(p_payload -> 'bio', 190) then return 'about'; end if;
    when 'status' then
      if not private.profile_keys_ok(p_payload, array['emoji', 'text', 'expiresAt'])
         or not private.profile_text_ok(p_payload -> 'emoji', 16) or not private.profile_text_ok(p_payload -> 'text', 80)
         or coalesce(nullif(btrim(p_payload ->> 'emoji'), ''), nullif(btrim(p_payload ->> 'text'), '')) is null then return 'status'; end if;
      if p_payload ? 'expiresAt' and p_payload -> 'expiresAt' <> 'null'::jsonb then
        begin
          perform (p_payload ->> 'expiresAt')::timestamptz;
        exception when others then return 'status';
        end;
      end if;
    when 'layout' then
      if not private.profile_keys_ok(p_payload, array['order']) or jsonb_typeof(p_payload -> 'order') is distinct from 'array'
         or jsonb_array_length(p_payload -> 'order') > 8
         or exists (select 1 from jsonb_array_elements_text(p_payload -> 'order') k
                     where k !~ '^widget:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
         or (select count(distinct k) from jsonb_array_elements_text(p_payload -> 'order') k) <> jsonb_array_length(p_payload -> 'order') then
        return 'layout';
      end if;
    when 'widget' then
      if not private.profile_keys_ok(p_payload, array['type', 'title', 'text', 'tags', 'stats'])
         or coalesce(p_payload ->> 'type', '') not in ('text', 'interests', 'stats')
         or not private.profile_text_ok(p_payload -> 'title', 40)
         or (p_payload ? 'text' and (p_payload ->> 'type' <> 'text' or not private.profile_text_ok(p_payload -> 'text', 280)))
         or (p_payload ? 'tags' and (p_payload ->> 'type' <> 'interests' or not private.profile_string_array_ok(p_payload -> 'tags', 12, 24)))
         or (p_payload ? 'stats' and (p_payload ->> 'type' <> 'stats' or jsonb_typeof(p_payload -> 'stats') <> 'array'
              or jsonb_array_length(p_payload -> 'stats') > 4
              or exists (select 1 from jsonb_array_elements_text(p_payload -> 'stats') s where s not in ('seniority', 'runs', 'distance', 'best_effort'))
              or (select count(distinct s) from jsonb_array_elements_text(p_payload -> 'stats') s) <> jsonb_array_length(p_payload -> 'stats'))) then
        return 'widget';
      end if;
    else return 'kind';
  end case;
  return null;
end $$;

-- Médias référencés par un contenu (avatar, bannière ; la galerie s'ajoute en 8b).
create or replace function private.profile_payload_media(p_payload jsonb) returns uuid[]
language sql immutable set search_path = '' as $$
  select case when (p_payload ->> 'mediaId') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
              then array[(p_payload ->> 'mediaId')::uuid] else '{}'::uuid[] end
$$;

-- Un média reste conservé tant qu'un contenu l'utilise (redéfinie en 8b et 8c : configurations, version publiée).
create or replace function private.profile_media_referenced(p_user uuid, p_media uuid) returns boolean
language sql stable set search_path = '' as $$
  select exists (select 1 from public.profile_elements e
                  where e.user_id = p_user and not e.deleted and p_media = any (private.profile_payload_media(e.payload)))
$$;

-- Libère les médias qui ne sont plus utilisés : le fichier part dans la file de purge (§5.6).
create or replace function private.profile_release_media(p_user uuid, p_media uuid[]) returns void
language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_path text;
begin
  foreach v_id in array coalesce(p_media, '{}'::uuid[]) loop
    v_path := null;
    if not private.profile_media_referenced(p_user, v_id) then
      update public.profile_media set status = 'deleted' where id = v_id and user_id = p_user and status <> 'deleted'
      returning storage_path into v_path;
      if v_path is not null then
        insert into private.storage_purge_queue (bucket, path) values ('profile-media', v_path) on conflict (bucket, path) do nothing;
      end if;
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------------------------
-- Écriture : lot d'éléments enregistrés (au plus 40), chacun rejouable et contrôlé par révision.
-- Statuts : applied · conflict (version serveur renvoyée) · deferred (média pas encore prêt) · rejected.
-- ---------------------------------------------------------------------------------------
create or replace function public.profile_save(p_items jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_profiles();
  v_item jsonb; v_key text; v_kind text; v_payload jsonb; v_base int; v_op uuid; v_prev uuid; v_deleted boolean; v_at timestamptz;
  v_row public.profile_elements; v_exists boolean; v_error text; v_media uuid[]; v_old_media uuid[]; v_revision int;
  v_results jsonb := '[]'::jsonb;
begin
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) not between 1 and 40 then
    raise exception 'invalid_parameter:items' using errcode = '22023';
  end if;
  for v_item in select value from jsonb_array_elements(p_items) loop
    v_key := v_item ->> 'key';
    if v_key is null or v_key !~ '^(identity|appearance|avatar|banner|about|status|layout|widget:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$' then
      v_results := v_results || jsonb_build_object('key', v_key, 'status', 'rejected', 'reason', 'key');
      continue;
    end if;
    begin
      v_op := (v_item ->> 'op_id')::uuid;
      v_prev := nullif(v_item ->> 'prev_op_id', '')::uuid;
      v_base := coalesce((v_item ->> 'base_revision')::int, 0);
      v_deleted := coalesce((v_item ->> 'deleted')::boolean, false);
      v_at := least(coalesce((v_item ->> 'client_updated_at')::timestamptz, now()), now() + interval '5 minutes');
    exception when others then
      v_op := null;
    end;
    if v_op is null then
      v_results := v_results || jsonb_build_object('key', v_key, 'status', 'rejected', 'reason', 'format');
      continue;
    end if;
    v_kind := split_part(v_key, ':', 1);
    v_payload := case when v_deleted then '{}'::jsonb else coalesce(v_item -> 'payload', '{}'::jsonb) end;

    select * into v_row from public.profile_elements where user_id = v_uid and element_key = v_key for update;
    v_exists := found;
    -- Rejeu d'une opération déjà appliquée (réponse perdue) : même résultat, aucun effet.
    if v_exists and v_row.last_op_id = v_op then
      v_results := v_results || jsonb_build_object('key', v_key, 'status', 'applied', 'revision', v_row.revision);
      continue;
    end if;
    -- Modification simultanée du même élément : la version serveur est conservée (§17.6).
    -- Exception : la révision vient de l'opération précédente de ce même appareil (réponse perdue puis nouvelle édition).
    if v_exists and v_row.revision <> v_base
       and not (v_prev is not null and v_row.last_op_id = v_prev and v_row.revision = v_base + 1) then
      v_results := v_results || jsonb_build_object('key', v_key, 'status', 'conflict', 'revision', v_row.revision,
        'payload', v_row.payload, 'deleted', v_row.deleted, 'server_updated_at', v_row.server_updated_at);
      continue;
    end if;
    if not v_deleted then
      v_error := private.profile_payload_error(v_kind, v_payload);
      if v_error is not null then
        v_results := v_results || jsonb_build_object('key', v_key, 'status', 'rejected', 'reason', 'invalid:' || v_error);
        continue;
      end if;
      v_media := private.profile_payload_media(v_payload);
      if exists (select 1 from unnest(v_media) m
                  where not exists (select 1 from public.profile_media pm where pm.id = m and pm.user_id = v_uid and pm.status = 'ready')) then
        v_results := v_results || jsonb_build_object('key', v_key, 'status', 'deferred', 'reason', 'media_not_ready');
        continue;
      end if;
      if v_kind = 'widget' and (not v_exists or v_row.deleted)
         and (select count(*) from public.profile_elements e where e.user_id = v_uid and e.kind = 'widget' and not e.deleted)
             >= (private.profile_limits() ->> 'widgets')::int then
        v_results := v_results || jsonb_build_object('key', v_key, 'status', 'rejected', 'reason', 'limit_widgets');
        continue;
      end if;
    end if;
    v_old_media := case when v_exists then private.profile_payload_media(v_row.payload) else '{}'::uuid[] end;
    insert into public.profile_elements as e (user_id, element_key, payload, deleted, revision, last_op_id, client_updated_at)
    values (v_uid, v_key, v_payload, v_deleted, 1, v_op, v_at)
    on conflict (user_id, element_key) do update
      set payload = excluded.payload, deleted = excluded.deleted, revision = e.revision + 1, last_op_id = excluded.last_op_id,
          client_updated_at = excluded.client_updated_at, server_updated_at = now()
    returning e.revision into v_revision;
    -- L'ancien média n'est libéré qu'une fois le remplacement enregistré (§17.6 Médias).
    perform private.profile_release_media(v_uid, v_old_media);
    v_results := v_results || jsonb_build_object('key', v_key, 'status', 'applied', 'revision', v_revision);
  end loop;
  return jsonb_build_object('results', v_results, 'server_time', now());
end $$;

-- Lecture complète de la version privée (le profil est petit : quelques dizaines d'éléments au plus).
create or replace function public.profile_pull() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := private.require_profiles();
begin
  return jsonb_build_object(
    'elements', coalesce((select jsonb_agg(jsonb_build_object('key', e.element_key, 'payload', e.payload, 'deleted', e.deleted,
        'revision', e.revision, 'server_updated_at', e.server_updated_at) order by e.element_key)
      from public.profile_elements e where e.user_id = v_uid), '[]'::jsonb),
    'media', coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'usage', m.usage, 'mime', m.mime, 'bytes', m.bytes,
        'width', m.width, 'height', m.height, 'animated', m.animated, 'path', m.storage_path) order by m.created_at)
      from public.profile_media m where m.user_id = v_uid and m.status = 'ready'), '[]'::jsonb),
    'limits', private.profile_limits(),
    'server_time', now());
end $$;

-- ---------------------------------------------------------------------------------------
-- Médias : réservation idempotente (id choisi par l'app), dépôt dans le dossier du titulaire,
-- puis validation par la fonction profile-media-commit (type réel, dimensions, localisation).
-- ---------------------------------------------------------------------------------------
create or replace function public.profile_media_begin(p_id uuid, p_usage text, p_mime text, p_bytes int, p_width int, p_height int)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := private.require_profiles(); v_row public.profile_media; v_max int; v_path text;
begin
  select * into v_row from public.profile_media where id = p_id;
  if found then
    if v_row.user_id <> v_uid or v_row.status = 'deleted' then raise exception 'invalid_parameter:id' using errcode = '22023'; end if;
    return jsonb_build_object('path', v_row.storage_path, 'status', v_row.status);
  end if;
  if p_id is null then raise exception 'invalid_parameter:id' using errcode = '22023'; end if;
  if coalesce(p_usage, '') not in ('avatar', 'banner', 'gallery') then raise exception 'invalid_parameter:usage' using errcode = '22023'; end if;
  v_max := private.profile_media_max_bytes(p_mime, false);
  if v_max is null then raise exception 'invalid_parameter:mime' using errcode = '22023'; end if;
  if p_bytes is null or p_bytes <= 0 or p_bytes > v_max then raise exception 'media_too_large' using errcode = '22023'; end if;
  if p_width is null or p_height is null or p_width not between 16 and 4096 or p_height not between 16 and 4096 then
    raise exception 'invalid_parameter:dimensions' using errcode = '22023';
  end if;
  if (select count(*) from public.profile_media where user_id = v_uid and status <> 'deleted') >= (private.profile_limits() ->> 'media')::int then
    raise exception 'limit_media' using errcode = 'P0001';
  end if;
  v_path := v_uid::text || '/' || p_id::text || '.' || private.profile_media_ext(p_mime);
  insert into public.profile_media (id, user_id, usage, mime, bytes, width, height, storage_path)
  values (p_id, v_uid, p_usage, p_mime, p_bytes, p_width, p_height, v_path);
  return jsonb_build_object('path', v_path, 'status', 'pending');
end $$;

-- Lue par la fonction profile-media-commit avec le jeton du titulaire : session active, profil activé, média à lui.
create or replace function public.profile_media_pending(p_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := private.require_profiles(); v_row public.profile_media;
begin
  select * into v_row from public.profile_media where id = p_id and user_id = v_uid;
  if not found or v_row.status = 'deleted' then return null; end if;
  return jsonb_build_object('path', v_row.storage_path, 'mime', v_row.mime, 'bytes', v_row.bytes, 'status', v_row.status, 'usage', v_row.usage);
end $$;

-- Résultat de la vérification. Un fichier refusé est purgé ; le visuel précédent reste en place (§17.8).
create or replace function public.service_profile_media_result(
  p_user uuid, p_id uuid, p_ok boolean, p_mime text, p_bytes int, p_width int, p_height int,
  p_animated boolean default false, p_duration_ms int default null, p_reason text default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_row public.profile_media; v_max int;
begin
  select * into v_row from public.profile_media where id = p_id and user_id = p_user for update;
  if not found or v_row.status = 'deleted' then return jsonb_build_object('status', 'rejected', 'reason', 'unknown_media'); end if;
  if v_row.status = 'ready' then return jsonb_build_object('status', 'ready'); end if;
  v_max := private.profile_media_max_bytes(p_mime, p_animated);
  if p_ok and (v_max is null or p_bytes > v_max or p_mime <> v_row.mime or p_width not between 16 and 4096 or p_height not between 16 and 4096
               or (p_animated and coalesce(p_duration_ms, 0) > (private.profile_limits() ->> 'animation_ms')::int)) then
    p_ok := false;
    p_reason := coalesce(p_reason, case when v_max is null then 'format' when p_bytes > v_max then 'too_large'
                                        when p_animated then 'too_long' else 'format' end);
  end if;
  if not p_ok then
    update public.profile_media set status = 'deleted' where id = p_id;
    insert into private.storage_purge_queue (bucket, path) values ('profile-media', v_row.storage_path) on conflict (bucket, path) do nothing;
    return jsonb_build_object('status', 'rejected', 'reason', coalesce(left(p_reason, 40), 'format'));
  end if;
  update public.profile_media
     set status = 'ready', ready_at = now(), bytes = p_bytes, width = p_width, height = p_height,
         animated = coalesce(p_animated, false), duration_ms = p_duration_ms
   where id = p_id;
  return jsonb_build_object('status', 'ready');
end $$;

-- ---------------------------------------------------------------------------------------
-- Stockage privé : dossier <uid>/, dépôt seulement pour une réservation en attente du titulaire.
-- ---------------------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('profile-media', 'profile-media', false, 8388608, array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do update set public = false, file_size_limit = 8388608, allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

create or replace function authz.profile_media_path_ok(p_name text) returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null
     and p_name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp|gif)$'
     and split_part(p_name, '/', 1) = auth.uid()::text
$$;
create or replace function authz.profile_media_upload_allowed(p_name text) returns boolean
language sql stable security definer set search_path = '' as $$
  select authz.session_ok() and authz.profile_media_path_ok(p_name)
     and private.flag('accounts_enabled') and private.flag('profiles_enabled')
     and exists (select 1 from public.profile_media m where m.storage_path = p_name and m.user_id = auth.uid() and m.status = 'pending')
$$;
revoke all on function authz.profile_media_path_ok(text), authz.profile_media_upload_allowed(text) from public, anon;
grant execute on function authz.profile_media_path_ok(text), authz.profile_media_upload_allowed(text) to authenticated, service_role;

create policy profile_media_select_own on storage.objects for select to authenticated
  using (bucket_id = 'profile-media' and authz.session_ok() and authz.profile_media_path_ok(name));
create policy profile_media_insert_own on storage.objects for insert to authenticated
  with check (bucket_id = 'profile-media' and authz.profile_media_upload_allowed(name));
create policy profile_media_update_own on storage.objects for update to authenticated
  using (bucket_id = 'profile-media' and authz.profile_media_upload_allowed(name))
  with check (bucket_id = 'profile-media' and authz.profile_media_upload_allowed(name));
create policy profile_media_delete_own on storage.objects for delete to authenticated
  using (bucket_id = 'profile-media' and authz.session_ok() and authz.profile_media_path_ok(name));

-- Purge : file explicite + fichiers orphelins des deux buckets privés (§5.6).
create or replace function public.service_storage_purge_batch(p_limit int default 200)
returns table (queue_id bigint, bucket text, path text) language sql stable security definer set search_path = '' as $$
  (select q.id, q.bucket, q.path from private.storage_purge_queue q order by q.id limit p_limit)
  union all
  (select null::bigint, o.bucket_id, o.name from storage.objects o
    where o.bucket_id = 'run-tracks' and o.created_at < now() - interval '1 day'
      and not exists (select 1 from public.run_routes r where r.storage_path = o.name)
      and not exists (select 1 from private.storage_purge_queue q where q.bucket = o.bucket_id and q.path = o.name)
    limit p_limit)
  union all
  (select null::bigint, o.bucket_id, o.name from storage.objects o
    where o.bucket_id = 'profile-media' and o.created_at < now() - interval '1 day'
      and not exists (select 1 from public.profile_media m where m.storage_path = o.name and m.status <> 'deleted')
      and not exists (select 1 from private.storage_purge_queue q where q.bucket = o.bucket_id and q.path = o.name)
    limit p_limit);
$$;

-- Nettoyage quotidien : réservations abandonnées (> 24 h) et médias prêts jamais utilisés (> 7 jours).
create or replace function private.job_profile_media() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_pending int; v_unused int;
begin
  with gone as (
    update public.profile_media set status = 'deleted'
     where status = 'pending' and created_at < now() - interval '24 hours' returning storage_path)
  insert into private.storage_purge_queue (bucket, path) select 'profile-media', storage_path from gone on conflict (bucket, path) do nothing;
  get diagnostics v_pending = row_count;
  with gone as (
    update public.profile_media m set status = 'deleted'
     where m.status = 'ready' and m.ready_at < now() - interval '7 days'
       and not private.profile_media_referenced(m.user_id, m.id) returning storage_path)
  insert into private.storage_purge_queue (bucket, path) select 'profile-media', storage_path from gone on conflict (bucket, path) do nothing;
  get diagnostics v_unused = row_count;
  return jsonb_build_object('pending', v_pending, 'unused', v_unused);
end $$;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('profile-media', '20 3 * * *', 'select private.job_profile_media()');
  end if;
end $$;

-- ---------------------------------------------------------------------------------------
-- Droits d'exécution
-- ---------------------------------------------------------------------------------------
revoke all on function
  private.require_profiles(), private.profile_limits(), private.profile_media_max_bytes(text, boolean), private.profile_media_ext(text),
  private.profile_keys_ok(jsonb, text[]), private.profile_text_ok(jsonb, int), private.profile_id_ok(jsonb), private.profile_uuid_ok(jsonb),
  private.profile_hex_ok(jsonb), private.profile_number_between(jsonb, numeric, numeric), private.profile_crop_ok(jsonb),
  private.profile_string_array_ok(jsonb, int, int), private.profile_payload_error(text, jsonb), private.profile_payload_media(jsonb),
  private.profile_media_referenced(uuid, uuid), private.profile_release_media(uuid, uuid[]), private.job_profile_media()
from public, anon, authenticated;
revoke all on function public.profile_save(jsonb), public.profile_pull(), public.profile_media_begin(uuid, text, text, int, int, int),
  public.profile_media_pending(uuid) from public, anon;
grant execute on function public.profile_save(jsonb), public.profile_pull(), public.profile_media_begin(uuid, text, text, int, int, int),
  public.profile_media_pending(uuid) to authenticated;
revoke all on function public.service_profile_media_result(uuid, uuid, boolean, text, int, int, int, boolean, int, text) from public, anon, authenticated;
grant execute on function public.service_profile_media_result(uuid, uuid, boolean, text, int, int, int, boolean, int, text) to service_role;
