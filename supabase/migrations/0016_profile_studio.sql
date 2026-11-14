-- 0016 — Studio de profil avancé (phase 8b, §17.2 à §17.5, §17.8) : configurations enregistrées,
-- apparence fine, décorations, badges officiels, statuts réutilisables, widgets avancés et médias animés.
-- Tout ce qui est propre au studio n'est accepté que si `profile_studio_enabled` est actif (§17.9).

insert into public.app_config (key, value) values ('profile_studio_enabled', 'false'::jsonb) on conflict (key) do nothing;

-- ---------------------------------------------------------------------------------------
-- Clés d'éléments : configurations (≤ 5), décorations, choix de badges, statuts réutilisables.
-- ---------------------------------------------------------------------------------------
create or replace function private.profile_key_ok(p_key text) returns boolean
language sql immutable set search_path = '' as $$
  select coalesce(p_key ~ '^(identity|appearance|avatar|banner|about|status|layout|decorations|badges|statuses|(widget|config):[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$', false)
$$;
alter table public.profile_elements drop constraint profile_elements_element_key_check;
alter table public.profile_elements add constraint profile_elements_element_key_check check (private.profile_key_ok(element_key));

create or replace function private.profile_limits() returns jsonb
language sql immutable set search_path = '' as $$
  select jsonb_build_object('image_bytes', 5242880, 'animation_bytes', 8388608, 'animation_ms', 8000,
    'widgets', 8, 'configurations', 5, 'gallery_images', 5, 'media', 20, 'links', 5, 'status_templates', 10)
$$;

-- Badges officiels : attribués par Sprinter sur des critères vérifiables côté serveur (§17.3).
create or replace function private.profile_badge_catalog() returns text[]
language sql immutable set search_path = '' as $$
  select array['membre_1an', 'membre_3ans', 'courses_10', 'courses_100', 'distance_100', 'distance_1000', 'classement']
$$;

create or replace function private.profile_https_ok(p_value jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select jsonb_typeof(p_value) = 'string' and char_length(p_value #>> '{}') <= 200
     and (p_value #>> '{}') ~ '^https://[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+(:[0-9]{2,5})?(/[^[:space:]<>"]*)?$'
$$;

-- Validation des contenus, version 8b. Les clés avancées sont refusées tant que le studio est coupé.
create or replace function private.profile_payload_error(p_kind text, p_payload jsonb) returns text
language plpgsql stable set search_path = '' as $$
declare
  v_source text; v_type text; v_studio boolean := private.flag('profile_studio_enabled');
  v_common text[] := array['type', 'title', 'size'];
  v_allowed text[]; v_error text;
begin
  if jsonb_typeof(p_payload) is distinct from 'object' then return 'payload_type'; end if;
  if octet_length(p_payload::text) > (case when p_kind = 'config' then 6144 else 4096 end) then return 'payload_size'; end if;
  if not v_studio and (p_kind in ('decorations', 'badges', 'statuses', 'config')
     or (p_kind = 'appearance' and not private.profile_keys_ok(p_payload, array['theme', 'accent']))
     or (p_kind = 'avatar' and (p_payload ?| array['shape', 'frame', 'halo', 'posterId']))
     or (p_kind = 'banner' and (p_payload ?| array['veil', 'particles', 'posterId']))
     or (p_kind = 'about' and (p_payload ?| array['long', 'quote']))
     or (p_kind = 'widget' and (coalesce(p_payload ->> 'type', '') not in ('text', 'interests', 'stats') or p_payload ? 'size'))) then
    return 'studio_disabled';
  end if;
  case p_kind
    when 'identity' then
      if not private.profile_keys_ok(p_payload, array['name']) or not private.profile_text_ok(p_payload -> 'name', 40) then return 'identity'; end if;
    when 'appearance' then
      if not private.profile_keys_ok(p_payload, array['theme', 'accent', 'colors', 'font', 'cards', 'buttons', 'frame'])
         or not private.profile_id_ok(p_payload -> 'theme')
         or (p_payload ? 'accent' and not private.profile_id_ok(p_payload -> 'accent'))
         or (p_payload ? 'colors' and not (jsonb_typeof(p_payload -> 'colors') = 'object'
              and private.profile_keys_ok(p_payload -> 'colors', array['accent', 'secondary', 'background', 'surface'])
              and coalesce((select bool_and(private.profile_hex_ok(e.value)) from jsonb_each(p_payload -> 'colors') e), true)))
         or (p_payload ? 'font' and coalesce(p_payload ->> 'font', '') not in ('system', 'serif', 'mono', 'rounded'))
         or (p_payload ? 'cards' and coalesce(p_payload ->> 'cards', '') not in ('flat', 'outlined', 'raised'))
         or (p_payload ? 'buttons' and coalesce(p_payload ->> 'buttons', '') not in ('pill', 'rounded', 'square'))
         or (p_payload ? 'frame' and jsonb_typeof(p_payload -> 'frame') <> 'boolean') then return 'appearance'; end if;
    when 'avatar' then
      v_source := p_payload ->> 'source';
      if not private.profile_keys_ok(p_payload, array['source', 'libraryId', 'mediaId', 'posterId', 'crop', 'shape', 'frame', 'halo'])
         or coalesce(v_source, '') not in ('default', 'library', 'media')
         or (v_source = 'library' and not private.profile_id_ok(p_payload -> 'libraryId'))
         or (v_source = 'media' and not private.profile_uuid_ok(p_payload -> 'mediaId'))
         or (v_source <> 'media' and (p_payload ? 'mediaId' or p_payload ? 'posterId'))
         or (p_payload ? 'posterId' and not private.profile_uuid_ok(p_payload -> 'posterId'))
         or (p_payload ? 'crop' and not private.profile_crop_ok(p_payload -> 'crop'))
         or (p_payload ? 'shape' and coalesce(p_payload ->> 'shape', '') not in ('circle', 'rounded', 'square'))
         or (p_payload ? 'frame' and coalesce(p_payload ->> 'frame', '') not in ('none', 'thin', 'thick', 'double', 'gradient'))
         or (p_payload ? 'halo' and jsonb_typeof(p_payload -> 'halo') <> 'boolean') then return 'avatar'; end if;
    when 'banner' then
      v_source := p_payload ->> 'source';
      if not private.profile_keys_ok(p_payload, array['source', 'presetId', 'colors', 'mediaId', 'posterId', 'crop', 'veil', 'particles'])
         or coalesce(v_source, '') not in ('default', 'preset', 'color', 'gradient', 'media')
         or (v_source = 'preset' and not private.profile_id_ok(p_payload -> 'presetId'))
         or (v_source in ('color', 'gradient') and not (jsonb_typeof(p_payload -> 'colors') = 'array'
              and jsonb_array_length(p_payload -> 'colors') between (case v_source when 'color' then 1 else 2 end) and 3
              and (select bool_and(private.profile_hex_ok(c)) from jsonb_array_elements(p_payload -> 'colors') c)))
         or (v_source = 'media' and not private.profile_uuid_ok(p_payload -> 'mediaId'))
         or (v_source <> 'media' and (p_payload ? 'mediaId' or p_payload ? 'posterId'))
         or (p_payload ? 'posterId' and not private.profile_uuid_ok(p_payload -> 'posterId'))
         or (p_payload ? 'crop' and not private.profile_crop_ok(p_payload -> 'crop'))
         or (p_payload ? 'veil' and not private.profile_number_between(p_payload -> 'veil', 0, 0.6))
         or (p_payload ? 'particles' and jsonb_typeof(p_payload -> 'particles') <> 'boolean') then return 'banner'; end if;
    when 'about' then
      if not private.profile_keys_ok(p_payload, array['bio', 'long', 'quote']) or not private.profile_text_ok(p_payload -> 'bio', 190)
         or not private.profile_text_ok(p_payload -> 'long', 1000) or not private.profile_text_ok(p_payload -> 'quote', 140) then return 'about'; end if;
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
    when 'statuses' then
      if not private.profile_keys_ok(p_payload, array['items']) or jsonb_typeof(p_payload -> 'items') is distinct from 'array'
         or jsonb_array_length(p_payload -> 'items') > (private.profile_limits() ->> 'status_templates')::int
         or exists (select 1 from jsonb_array_elements(p_payload -> 'items') i
                     where jsonb_typeof(i) <> 'object' or not private.profile_keys_ok(i, array['emoji', 'text'])
                        or not private.profile_text_ok(i -> 'emoji', 16) or not private.profile_text_ok(i -> 'text', 80)
                        or coalesce(nullif(btrim(i ->> 'emoji'), ''), nullif(btrim(i ->> 'text'), '')) is null) then return 'statuses'; end if;
    when 'layout' then
      if not private.profile_keys_ok(p_payload, array['order']) or jsonb_typeof(p_payload -> 'order') is distinct from 'array'
         or jsonb_array_length(p_payload -> 'order') > 8
         or exists (select 1 from jsonb_array_elements_text(p_payload -> 'order') k
                     where k !~ '^widget:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
         or (select count(distinct k) from jsonb_array_elements_text(p_payload -> 'order') k) <> jsonb_array_length(p_payload -> 'order') then
        return 'layout';
      end if;
    when 'decorations' then
      -- Les plaques et icônes choisies ne peuvent pas emprunter le traitement réservé aux distinctions officielles.
      if not private.profile_keys_ok(p_payload, array['title', 'icon', 'plate', 'card', 'entry'])
         or not private.profile_text_ok(p_payload -> 'title', 24)
         or (p_payload ? 'icon' and not private.profile_id_ok(p_payload -> 'icon'))
         or (p_payload ? 'plate' and (not private.profile_id_ok(p_payload -> 'plate') or (p_payload ->> 'plate') ~ '^(officiel|official|badge|sprinter)'))
         or (p_payload ? 'card' and not private.profile_id_ok(p_payload -> 'card'))
         or (p_payload ? 'entry' and coalesce(p_payload ->> 'entry', '') not in ('none', 'fade', 'slide'))
         or (p_payload ? 'title' and (p_payload ->> 'title') ~* '(officiel|certifi|vérifi|verifi|sprinter)') then return 'decorations'; end if;
    when 'badges' then
      if not private.profile_keys_ok(p_payload, array['show']) or jsonb_typeof(p_payload -> 'show') is distinct from 'array'
         or jsonb_array_length(p_payload -> 'show') > 6
         or exists (select 1 from jsonb_array_elements_text(p_payload -> 'show') b where not (b = any (private.profile_badge_catalog()))) then return 'badges'; end if;
    when 'config' then
      if not private.profile_keys_ok(p_payload, array['name', 'appearance', 'avatar', 'banner', 'decorations', 'order', 'sizes'])
         or jsonb_typeof(p_payload -> 'name') is distinct from 'string' or char_length(btrim(p_payload ->> 'name')) not between 1 and 40
         or not private.profile_text_ok(p_payload -> 'name', 40) then return 'config'; end if;
      if p_payload ? 'appearance' and private.profile_payload_error('appearance', p_payload -> 'appearance') is not null then return 'config'; end if;
      if p_payload ? 'banner' and private.profile_payload_error('banner', p_payload -> 'banner') is not null then return 'config'; end if;
      if p_payload ? 'decorations' and private.profile_payload_error('decorations', p_payload -> 'decorations') is not null then return 'config'; end if;
      -- Une configuration garde le style de l'avatar, jamais son image.
      if p_payload ? 'avatar' and (jsonb_typeof(p_payload -> 'avatar') <> 'object' or not private.profile_keys_ok(p_payload -> 'avatar', array['shape', 'frame', 'halo'])
         or private.profile_payload_error('avatar', (p_payload -> 'avatar') || '{"source":"default"}'::jsonb) is not null) then return 'config'; end if;
      if p_payload ? 'order' and private.profile_payload_error('layout', jsonb_build_object('order', p_payload -> 'order')) is not null then return 'config'; end if;
      if p_payload ? 'sizes' and not (jsonb_typeof(p_payload -> 'sizes') = 'object'
         and coalesce((select bool_and(e.key ~ '^widget:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                                       and e.value #>> '{}' in ('compact', 'wide')) from jsonb_each(p_payload -> 'sizes') e), true)) then return 'config'; end if;
    when 'widget' then
      v_type := coalesce(p_payload ->> 'type', '');
      v_allowed := v_common || case v_type
        when 'text' then array['text'] when 'interests' then array['tags'] when 'stats' then array['stats']
        when 'goal' then array['label', 'target', 'unit', 'progress', 'source'] when 'gallery' then array['images']
        when 'links' then array['links'] when 'mood' then array['emoji', 'message'] when 'counter' then array['label', 'value', 'unit']
        when 'favorites' then array['items'] else null end;
      if v_allowed is null or not private.profile_keys_ok(p_payload, v_allowed) or not private.profile_text_ok(p_payload -> 'title', 40)
         or (p_payload ? 'size' and coalesce(p_payload ->> 'size', '') not in ('compact', 'wide')) then return 'widget'; end if;
      v_error := case v_type
        when 'text' then case when private.profile_text_ok(p_payload -> 'text', 280) then null else 'widget' end
        when 'interests' then case when not p_payload ? 'tags' or private.profile_string_array_ok(p_payload -> 'tags', 12, 24) then null else 'widget' end
        when 'stats' then case when not p_payload ? 'stats' or (jsonb_typeof(p_payload -> 'stats') = 'array' and jsonb_array_length(p_payload -> 'stats') <= 4
              and not exists (select 1 from jsonb_array_elements_text(p_payload -> 'stats') s where s not in ('seniority', 'runs', 'distance', 'best_effort'))
              and (select count(distinct s) from jsonb_array_elements_text(p_payload -> 'stats') s) = jsonb_array_length(p_payload -> 'stats')) then null else 'widget' end
        when 'goal' then case when private.profile_text_ok(p_payload -> 'label', 60)
              and (not p_payload ? 'target' or private.profile_number_between(p_payload -> 'target', 0.01, 1000000))
              and (not p_payload ? 'progress' or private.profile_number_between(p_payload -> 'progress', 0, 1000000))
              and coalesce(p_payload ->> 'unit', 'km') in ('km', 'courses', 'minutes', 'jours', 'autre')
              and coalesce(p_payload ->> 'source', 'manual') in ('manual', 'distance_year', 'distance_month', 'runs_year', 'runs_month') then null else 'widget' end
        when 'gallery' then case when not p_payload ? 'images' or (jsonb_typeof(p_payload -> 'images') = 'array'
              and jsonb_array_length(p_payload -> 'images') <= (private.profile_limits() ->> 'gallery_images')::int
              and not exists (select 1 from jsonb_array_elements(p_payload -> 'images') i
                               where jsonb_typeof(i) <> 'object' or not private.profile_keys_ok(i, array['mediaId', 'alt'])
                                  or not private.profile_uuid_ok(i -> 'mediaId') or jsonb_typeof(i -> 'alt') <> 'string'
                                  or char_length(btrim(i ->> 'alt')) not between 1 and 140 or not private.profile_text_ok(i -> 'alt', 140))) then null else 'widget' end
        when 'links' then case when not p_payload ? 'links' or (jsonb_typeof(p_payload -> 'links') = 'array'
              and jsonb_array_length(p_payload -> 'links') <= (private.profile_limits() ->> 'links')::int
              and not exists (select 1 from jsonb_array_elements(p_payload -> 'links') l
                               where jsonb_typeof(l) <> 'object' or not private.profile_keys_ok(l, array['label', 'url'])
                                  or not private.profile_text_ok(l -> 'label', 40) or not private.profile_https_ok(l -> 'url'))) then null else 'widget' end
        when 'mood' then case when private.profile_text_ok(p_payload -> 'emoji', 16) and private.profile_text_ok(p_payload -> 'message', 140) then null else 'widget' end
        when 'counter' then case when private.profile_text_ok(p_payload -> 'label', 40) and private.profile_text_ok(p_payload -> 'unit', 16)
              and (not p_payload ? 'value' or private.profile_number_between(p_payload -> 'value', -1000000000, 1000000000)) then null else 'widget' end
        when 'favorites' then case when not p_payload ? 'items' or (jsonb_typeof(p_payload -> 'items') = 'array' and jsonb_array_length(p_payload -> 'items') <= 6
              and not exists (select 1 from jsonb_array_elements(p_payload -> 'items') f
                               where jsonb_typeof(f) <> 'object' or not private.profile_keys_ok(f, array['kind', 'id'])
                                  or coalesce(f ->> 'kind', '') not in ('theme', 'avatar', 'banner') or not private.profile_id_ok(f -> 'id'))) then null else 'widget' end
      end;
      if v_error is not null then return v_error; end if;
    else return 'kind';
  end case;
  return null;
end $$;

-- Médias cités : avatar, bannière, vignettes fixes, galerie, bannière d'une configuration.
create or replace function private.profile_payload_media(p_payload jsonb) returns uuid[]
language sql immutable set search_path = '' as $$
  select coalesce(array_agg(distinct m::uuid), '{}'::uuid[]) from (
    select p_payload ->> 'mediaId' as m
    union all select p_payload ->> 'posterId'
    union all select p_payload -> 'banner' ->> 'mediaId'
    union all select p_payload -> 'banner' ->> 'posterId'
    union all select i ->> 'mediaId'
      from jsonb_array_elements(case when jsonb_typeof(p_payload -> 'images') = 'array' then p_payload -> 'images' else '[]'::jsonb end) i
  ) s where m ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
$$;

-- Formats animés (GIF, WebP animé) : 8 Mio et 8 s au plus, studio activé uniquement (§17.8).
create or replace function private.profile_media_max_bytes(p_mime text, p_animated boolean default false) returns integer
language sql stable set search_path = '' as $$
  select case
    when not coalesce(p_animated, false) and p_mime in ('image/jpeg', 'image/png', 'image/webp') then (private.profile_limits() ->> 'image_bytes')::int
    when not coalesce(p_animated, false) and p_mime = 'image/gif' and private.flag('profile_studio_enabled') then (private.profile_limits() ->> 'image_bytes')::int
    when coalesce(p_animated, false) and p_mime in ('image/gif', 'image/webp') and private.flag('profile_studio_enabled') then (private.profile_limits() ->> 'animation_bytes')::int
  end
$$;

drop function public.profile_media_begin(uuid, text, text, int, int, int);
create or replace function public.profile_media_begin(
  p_id uuid, p_usage text, p_mime text, p_bytes int, p_width int, p_height int, p_animated boolean default false
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := private.require_profiles(); v_row public.profile_media; v_max int; v_path text;
begin
  select * into v_row from public.profile_media where id = p_id;
  if found then
    if v_row.user_id <> v_uid or v_row.status = 'deleted' then raise exception 'invalid_parameter:id' using errcode = '22023'; end if;
    return jsonb_build_object('path', v_row.storage_path, 'status', v_row.status);
  end if;
  if p_id is null then raise exception 'invalid_parameter:id' using errcode = '22023'; end if;
  if coalesce(p_usage, '') not in ('avatar', 'banner', 'gallery') then raise exception 'invalid_parameter:usage' using errcode = '22023'; end if;
  v_max := private.profile_media_max_bytes(p_mime, p_animated);
  if v_max is null then raise exception 'invalid_parameter:mime' using errcode = '22023'; end if;
  if p_bytes is null or p_bytes <= 0 or p_bytes > v_max then raise exception 'media_too_large' using errcode = '22023'; end if;
  if p_width is null or p_height is null or p_width not between 16 and 4096 or p_height not between 16 and 4096 then
    raise exception 'invalid_parameter:dimensions' using errcode = '22023';
  end if;
  if (select count(*) from public.profile_media where user_id = v_uid and status <> 'deleted') >= (private.profile_limits() ->> 'media')::int then
    raise exception 'limit_media' using errcode = 'P0001';
  end if;
  v_path := v_uid::text || '/' || p_id::text || '.' || private.profile_media_ext(p_mime);
  insert into public.profile_media (id, user_id, usage, mime, bytes, width, height, animated, storage_path)
  values (p_id, v_uid, p_usage, p_mime, p_bytes, p_width, p_height, coalesce(p_animated, false), v_path);
  return jsonb_build_object('path', v_path, 'status', 'pending');
end $$;

-- ---------------------------------------------------------------------------------------
-- Écriture : clés et limites étendues (configurations ≤ 5).
-- ---------------------------------------------------------------------------------------
create or replace function public.profile_save(p_items jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_profiles();
  v_item jsonb; v_key text; v_kind text; v_payload jsonb; v_base int; v_op uuid; v_prev uuid; v_deleted boolean; v_at timestamptz;
  v_row public.profile_elements; v_exists boolean; v_error text; v_media uuid[]; v_old_media uuid[]; v_revision int; v_limit int;
  v_results jsonb := '[]'::jsonb;
begin
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) not between 1 and 40 then
    raise exception 'invalid_parameter:items' using errcode = '22023';
  end if;
  for v_item in select value from jsonb_array_elements(p_items) loop
    v_key := v_item ->> 'key';
    if not private.profile_key_ok(v_key) then
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
    if v_exists and v_row.last_op_id = v_op then
      v_results := v_results || jsonb_build_object('key', v_key, 'status', 'applied', 'revision', v_row.revision);
      continue;
    end if;
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
      v_limit := case v_kind when 'widget' then (private.profile_limits() ->> 'widgets')::int when 'config' then (private.profile_limits() ->> 'configurations')::int end;
      if v_limit is not null and (not v_exists or v_row.deleted)
         and (select count(*) from public.profile_elements e where e.user_id = v_uid and e.kind = v_kind and not e.deleted) >= v_limit then
        v_results := v_results || jsonb_build_object('key', v_key, 'status', 'rejected', 'reason', 'limit_' || v_kind || 's');
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
    perform private.profile_release_media(v_uid, v_old_media);
    v_results := v_results || jsonb_build_object('key', v_key, 'status', 'applied', 'revision', v_revision);
  end loop;
  return jsonb_build_object('results', v_results, 'server_time', now());
end $$;

-- ---------------------------------------------------------------------------------------
-- Badges officiels : recalculés à chaque lecture, jamais saisis par l'utilisateur.
-- ---------------------------------------------------------------------------------------
create or replace function private.profile_badges_for(p_user uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  with stats as (
    select (select u.created_at from auth.users u where u.id = p_user) as since,
           count(*) filter (where r.deleted_at is null and r.validity = 'valid') as runs,
           coalesce(sum(r.distance_m) filter (where r.deleted_at is null and r.validity = 'valid'), 0) as meters
      from public.runs r where r.user_id = p_user and r.source = 'sprinter'
  ), earned as (
    select b.* from stats s, lateral (values
      ('membre_1an', 'Membre depuis plus d’un an', 'Compte créé il y a plus d’un an', s.since <= now() - interval '1 year'),
      ('membre_3ans', 'Membre depuis plus de 3 ans', 'Compte créé il y a plus de trois ans', s.since <= now() - interval '3 years'),
      ('courses_10', '10 courses', '10 courses Sprinter valides sauvegardées', s.runs >= 10),
      ('courses_100', '100 courses', '100 courses Sprinter valides sauvegardées', s.runs >= 100),
      ('distance_100', '100 km', '100 km de courses Sprinter valides sauvegardées', s.meters >= 100000),
      ('distance_1000', '1 000 km', '1 000 km de courses Sprinter valides sauvegardées', s.meters >= 1000000),
      ('classement', 'Classement communautaire', 'Inscrit au classement communautaire',
        exists (select 1 from public.community_members m where m.user_id = p_user and m.hidden_at is null))
    ) as b(id, label, criteria, ok) where b.ok
  )
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'label', label, 'criteria', criteria) order by id), '[]'::jsonb) from earned
$$;

create or replace function public.profile_badges() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := private.require_profiles();
begin
  return private.profile_badges_for(v_uid);
end $$;

-- ---------------------------------------------------------------------------------------
-- Droits
-- ---------------------------------------------------------------------------------------
revoke all on function private.profile_key_ok(text), private.profile_badge_catalog(), private.profile_https_ok(jsonb),
  private.profile_badges_for(uuid) from public, anon, authenticated;
revoke all on function public.profile_media_begin(uuid, text, text, int, int, int, boolean), public.profile_badges() from public, anon;
grant execute on function public.profile_media_begin(uuid, text, text, int, int, int, boolean), public.profile_badges() to authenticated;
