-- 0017 — Partage et découverte du profil (phase 8c, §17.7, §17.9) : publication volontaire, visibilité par
-- élément, lien révocable, recherche facultative, blocage, signalement, modération et lecture contrôlée.
-- Le visiteur ne lit jamais une table : toutes les lectures passent par des fonctions qui vérifient, à chaque
-- appel, l'activation, la session, le mode de partage, le blocage, la modération et l'état du compte.

insert into public.app_config (key, value) values ('profile_sharing_enabled', 'false'::jsonb) on conflict (key) do nothing;

-- ---------------------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------------------
alter table public.profile_elements add column visibility text not null default 'owner' check (visibility in ('owner', 'audience'));

create table public.profile_sharing (
  user_id           uuid primary key references auth.users (id) on delete cascade,
  mode              text not null default 'private' check (mode in ('private', 'link', 'members')),
  searchable        boolean not null default false,
  handle            text check (handle ~ '^[A-Za-z0-9][A-Za-z0-9_.-]{2,19}$'),
  handle_norm       text unique,
  presence_audience text not null default 'nobody' check (presence_audience in ('nobody', 'audience')),
  last_seen_at      timestamptz,
  rules_version     text,
  rules_accepted_at timestamptz,
  publication_epoch integer not null default 0,
  published_at      timestamptz,
  moderation        text not null default 'visible' check (moderation in ('visible', 'hidden', 'removed')),
  updated_at        timestamptz not null default now()
);
comment on table public.profile_sharing is 'Choix de partage du profil (§17.7). Privé par défaut ; pseudo de profil distinct du nom de compte et du pseudo de classement.';

create table public.profile_published (
  user_id          uuid not null references auth.users (id) on delete cascade,
  element_key      text not null,
  kind             text generated always as (split_part(element_key, ':', 1)) stored,
  payload          jsonb not null,
  source_revision  integer not null,
  published_at     timestamptz not null default now(),
  moderation       text not null default 'visible' check (moderation in ('visible', 'hidden', 'removed')),
  removed_revision integer,
  primary key (user_id, element_key)
);
comment on table public.profile_published is 'Version visible du profil, mise à jour seulement par « Publier » ; les retraits et la modération s’appliquent tout de suite.';

create table private.profile_links (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  token_hash bytea not null unique,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);
create unique index profile_links_one_active on private.profile_links (user_id) where revoked_at is null;

create table private.profile_blocks (
  id              uuid primary key default gen_random_uuid(),
  blocker_id      uuid not null references auth.users (id) on delete cascade,
  blocked_id      uuid not null references auth.users (id) on delete cascade,
  handle_snapshot text not null check (char_length(handle_snapshot) <= 40),
  created_at      timestamptz not null default now(),
  unique (blocker_id, blocked_id)
);
create index profile_blocks_blocked on private.profile_blocks (blocked_id);

create table public.profile_notices (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  kind        text not null check (kind in ('content_hidden', 'content_removed', 'content_restored', 'profile_removed')),
  element_key text,
  reason      text check (char_length(reason) <= 120),
  created_at  timestamptz not null default now(),
  read_at     timestamptz
);
create index profile_notices_user on public.profile_notices (user_id, created_at desc);

create table private.moderation_decisions (
  id          uuid primary key default gen_random_uuid(),
  report_id   uuid not null,
  target_user uuid,
  target_kind text not null,
  target_ref  text not null,
  decision    text not null check (decision in ('hide', 'remove', 'restore', 'dismiss')),
  reason      text not null,
  note        text check (char_length(note) <= 200),
  admin_id    uuid not null,
  at          timestamptz not null default now()
);
create index moderation_decisions_target on private.moderation_decisions (target_kind, target_ref, at desc);

create table private.profile_search_log (user_id uuid not null, at timestamptz not null default now());
create index profile_search_log_user on private.profile_search_log (user_id, at desc);

alter table public.profile_sharing enable row level security;
alter table public.profile_published enable row level security;
alter table public.profile_notices enable row level security;
revoke all on public.profile_sharing, public.profile_published, public.profile_notices from anon, authenticated;
grant all on public.profile_sharing, public.profile_published, public.profile_notices to service_role;
grant select on public.profile_sharing, public.profile_published, public.profile_notices to authenticated;
create policy profile_sharing_select_own on public.profile_sharing for select to authenticated using (user_id = (select authz.active_uid()));
create policy profile_published_select_own on public.profile_published for select to authenticated using (user_id = (select authz.active_uid()));
create policy profile_notices_select_own on public.profile_notices for select to authenticated using (user_id = (select authz.active_uid()));

-- ---------------------------------------------------------------------------------------
-- Règles communes
-- ---------------------------------------------------------------------------------------
create or replace function private.require_sharing() returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := private.require_profiles();
begin
  if not private.flag('profile_sharing_enabled') then raise exception 'feature_disabled' using errcode = 'P0001', hint = 'feature_flag'; end if;
  return v_uid;
end $$;

-- Éléments publiables par choix (visibilité « audience ») et éléments de style publiés avec la page.
create or replace function private.profile_content_kind(p_kind text) returns boolean
language sql immutable set search_path = '' as $$ select p_kind in ('identity', 'avatar', 'banner', 'about', 'status', 'widget') $$;
create or replace function private.profile_style_kind(p_kind text) returns boolean
language sql immutable set search_path = '' as $$ select p_kind in ('appearance', 'decorations', 'layout', 'badges') $$;

create or replace function private.profile_blocked(p_a uuid, p_b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from private.profile_blocks b where (b.blocker_id = p_a and b.blocked_id = p_b) or (b.blocker_id = p_b and b.blocked_id = p_a))
$$;

-- Pseudo de profil : mêmes garde-fous que le classement, et jamais le pseudo de classement d'un autre membre.
create or replace function private.profile_handle_error(p_uid uuid, p_handle text) returns text
language plpgsql stable security definer set search_path = '' as $$
declare v_name text;
begin
  if p_handle is null or p_handle !~ '^[A-Za-z0-9][A-Za-z0-9_.-]{2,19}$' or private.reserved_handle(p_handle) then return 'invalid_parameter:handle'; end if;
  select regexp_replace(coalesce(display_name_norm, ''), '[^a-z0-9]', '', 'g') into v_name from private.user_directory where user_id = p_uid;
  if (char_length(coalesce(v_name, '')) >= 4 and position(v_name in regexp_replace(private.normalize_text(p_handle), '[^a-z0-9]', '', 'g')) > 0)
     or lower(p_handle) = split_part((select email_norm from private.user_directory where user_id = p_uid), '@', 1) then
    return 'invalid_parameter:handle_personal';
  end if;
  if exists (select 1 from public.community_members m where lower(m.handle) = lower(p_handle) and m.user_id <> p_uid)
     or exists (select 1 from public.profile_sharing s where s.handle_norm = lower(p_handle) and s.user_id <> p_uid) then
    return 'handle_taken';
  end if;
  return null;
end $$;

-- Un média est conservé tant que la version privée, une configuration ou la version publiée l'utilise.
create or replace function private.profile_media_referenced(p_user uuid, p_media uuid) returns boolean
language sql stable set search_path = '' as $$
  select exists (select 1 from public.profile_elements e
                  where e.user_id = p_user and not e.deleted and p_media = any (private.profile_payload_media(e.payload)))
      or exists (select 1 from public.profile_published p
                  where p.user_id = p_user and p_media = any (private.profile_payload_media(p.payload)))
$$;

-- Cible d'une lecture visiteur : renvoie l'identifiant interne seulement si tout est autorisé, sinon null.
-- Un profil privé, retiré, inexistant, bloqué ou d'un compte inactif donne le même résultat (§17.7).
create or replace function private.profile_target(p_viewer uuid, p_handle text, p_token text) returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare v_target uuid; v_sharing public.profile_sharing;
begin
  if nullif(p_token, '') is not null then
    select l.user_id into v_target from private.profile_links l
     where l.token_hash = extensions.digest(p_token, 'sha256') and l.revoked_at is null;
  elsif nullif(p_handle, '') is not null then
    select s.user_id into v_target from public.profile_sharing s where s.handle_norm = lower(p_handle) and s.mode = 'members';
  else
    v_target := p_viewer;  -- « Voir comme un visiteur » : sa propre version publiée, avec la modération en vigueur
  end if;
  if v_target is null then return null; end if;
  select * into v_sharing from public.profile_sharing where user_id = v_target;
  if not found or v_sharing.mode = 'private' or v_sharing.published_at is null or v_sharing.moderation <> 'visible' then return null; end if;
  if v_target <> p_viewer and private.profile_blocked(p_viewer, v_target) then return null; end if;
  if not exists (select 1 from private.user_directory d where d.user_id = v_target and d.status = 'active') then return null; end if;
  return v_target;
end $$;

-- ---------------------------------------------------------------------------------------
-- Titulaire : réglages de partage, visibilité, publication, lien
-- ---------------------------------------------------------------------------------------
create or replace function public.profile_sharing_get() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := private.require_profiles(); v_row public.profile_sharing;
begin
  select * into v_row from public.profile_sharing where user_id = v_uid;
  return jsonb_build_object(
    'enabled', private.flag('profile_sharing_enabled'),
    'mode', coalesce(v_row.mode, 'private'), 'searchable', coalesce(v_row.searchable, false), 'handle', v_row.handle,
    'presence', coalesce(v_row.presence_audience, 'nobody'), 'rules_accepted', v_row.rules_accepted_at is not null,
    'epoch', coalesce(v_row.publication_epoch, 0), 'published_at', v_row.published_at, 'moderation', coalesce(v_row.moderation, 'visible'),
    'link_active', exists (select 1 from private.profile_links l where l.user_id = v_uid and l.revoked_at is null),
    'visibility', coalesce((select jsonb_object_agg(e.element_key, e.visibility) from public.profile_elements e
                             where e.user_id = v_uid and not e.deleted and private.profile_content_kind(e.kind)), '{}'::jsonb),
    'published', coalesce((select jsonb_object_agg(p.element_key, p.moderation) from public.profile_published p where p.user_id = v_uid), '{}'::jsonb),
    'notices', coalesce((select jsonb_agg(jsonb_build_object('id', n.id, 'kind', n.kind, 'element_key', n.element_key, 'reason', n.reason, 'created_at', n.created_at)
                         order by n.created_at desc) from public.profile_notices n where n.user_id = v_uid and n.read_at is null), '[]'::jsonb));
end $$;

-- Mode, recherche, pseudo, présence, règles. Un passage en privé ou hors recherche s'applique tout de suite.
create or replace function public.profile_sharing_set(
  p_mode text, p_searchable boolean, p_handle text default null, p_presence text default 'nobody', p_rules_version text default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := private.require_sharing(); v_row public.profile_sharing; v_error text;
begin
  if coalesce(p_mode, '') not in ('private', 'link', 'members') then raise exception 'invalid_parameter:mode' using errcode = '22023'; end if;
  if coalesce(p_presence, '') not in ('nobody', 'audience') then raise exception 'invalid_parameter:presence' using errcode = '22023'; end if;
  if nullif(p_handle, '') is not null then
    v_error := private.profile_handle_error(v_uid, p_handle);
    if v_error = 'handle_taken' then raise exception 'handle_taken' using errcode = '23505'; end if;
    if v_error is not null then raise exception '%', v_error using errcode = '22023'; end if;
  end if;
  if p_mode = 'members' and nullif(p_handle, '') is null then raise exception 'invalid_parameter:handle_required' using errcode = '22023'; end if;
  insert into public.profile_sharing as s (user_id) values (v_uid) on conflict (user_id) do nothing;
  select * into v_row from public.profile_sharing where user_id = v_uid for update;
  update public.profile_sharing set
    mode = p_mode,
    searchable = p_mode = 'members' and coalesce(p_searchable, false),
    handle = nullif(p_handle, ''), handle_norm = lower(nullif(p_handle, '')),
    presence_audience = p_presence,
    rules_version = coalesce(p_rules_version, rules_version),
    rules_accepted_at = case when p_rules_version is not null then now() else rules_accepted_at end,
    -- Rendre privé retire tout de suite la version visible ; une nouvelle publication sera nécessaire.
    publication_epoch = publication_epoch + case when p_mode = 'private' and v_row.mode <> 'private' then 1 else 0 end,
    published_at = case when p_mode = 'private' then null else published_at end,
    updated_at = now()
  where user_id = v_uid;
  if p_mode = 'private' then delete from public.profile_published where user_id = v_uid and moderation <> 'removed'; end if;
  return public.profile_sharing_get();
end $$;

-- Visibilité par élément. « Moi uniquement » retire l'élément de la version visible dès confirmation.
create or replace function public.profile_set_visibility(p_items jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := private.require_profiles(); v_item jsonb; v_key text; v_visibility text; v_results jsonb := '[]'::jsonb;
begin
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) not between 1 and 40 then
    raise exception 'invalid_parameter:items' using errcode = '22023';
  end if;
  for v_item in select value from jsonb_array_elements(p_items) loop
    v_key := v_item ->> 'key'; v_visibility := v_item ->> 'visibility';
    if not private.profile_key_ok(v_key) or not private.profile_content_kind(split_part(v_key, ':', 1)) or coalesce(v_visibility, '') not in ('owner', 'audience') then
      v_results := v_results || jsonb_build_object('key', v_key, 'status', 'rejected');
      continue;
    end if;
    update public.profile_elements set visibility = v_visibility where user_id = v_uid and element_key = v_key;
    if not found then v_results := v_results || jsonb_build_object('key', v_key, 'status', 'missing'); continue; end if;
    if v_visibility = 'owner' then delete from public.profile_published where user_id = v_uid and element_key = v_key and moderation <> 'removed'; end if;
    v_results := v_results || jsonb_build_object('key', v_key, 'status', 'applied', 'visibility', v_visibility);
  end loop;
  return jsonb_build_object('results', v_results);
end $$;

-- Publication explicite. p_epoch = époque connue de l'app : tout retrait intervenu depuis impose un nouveau choix.
-- p_snapshots : valeurs calculées sur l'appareil que le titulaire a confirmé partager (statistiques, objectifs).
create or replace function public.profile_publish(p_epoch int, p_snapshots jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_sharing(); v_row public.profile_sharing; v_element record; v_payload jsonb; v_snapshot jsonb; v_count int := 0;
  v_existing public.profile_published; v_order jsonb;
begin
  select * into v_row from public.profile_sharing where user_id = v_uid for update;
  if not found or v_row.mode = 'private' then raise exception 'sharing_private' using errcode = 'P0001'; end if;
  if v_row.rules_accepted_at is null then raise exception 'rules_required' using errcode = 'P0001'; end if;
  if v_row.moderation = 'removed' then raise exception 'moderation_removed' using errcode = 'P0001'; end if;
  if p_epoch is distinct from v_row.publication_epoch then raise exception 'stale_publication' using errcode = 'P0001'; end if;
  if jsonb_typeof(coalesce(p_snapshots, '{}'::jsonb)) <> 'object' then raise exception 'invalid_parameter:snapshots' using errcode = '22023'; end if;

  -- Éléments qui ne sont plus éligibles : retirés de la version visible (sauf décision de retrait conservée).
  delete from public.profile_published p where p.user_id = v_uid and p.moderation <> 'removed'
     and not exists (select 1 from public.profile_elements e where e.user_id = v_uid and e.element_key = p.element_key and not e.deleted
                      and (private.profile_style_kind(e.kind) or (private.profile_content_kind(e.kind) and e.visibility = 'audience')));

  for v_element in
    select e.* from public.profile_elements e
     where e.user_id = v_uid and not e.deleted
       and (private.profile_style_kind(e.kind) or (private.profile_content_kind(e.kind) and e.visibility = 'audience'))
  loop
    v_payload := v_element.payload;
    if private.profile_payload_error(v_element.kind, v_payload) is not null then continue; end if;
    -- Valeurs calculées sur l'appareil : seulement celles confirmées, limitées à la valeur, au libellé et à la période.
    if v_element.kind = 'widget' and v_payload ->> 'type' = 'stats' then
      v_snapshot := p_snapshots -> v_element.element_key;
      if jsonb_typeof(v_snapshot -> 'values') is distinct from 'array' then continue; end if;
      if exists (select 1 from jsonb_array_elements(v_snapshot -> 'values') v
                  where jsonb_typeof(v) <> 'object' or not private.profile_keys_ok(v, array['id', 'label', 'value', 'period'])
                     or coalesce(v ->> 'id', '') not in ('seniority', 'runs', 'distance', 'best_effort')
                     or not private.profile_text_ok(v -> 'label', 40) or not private.profile_text_ok(v -> 'value', 40) or not private.profile_text_ok(v -> 'period', 60))
         or jsonb_array_length(v_snapshot -> 'values') > 4 then continue; end if;
      v_payload := jsonb_strip_nulls(jsonb_build_object('type', 'stats', 'title', v_payload -> 'title', 'size', v_payload -> 'size', 'values', v_snapshot -> 'values'));
    elsif v_element.kind = 'widget' and v_payload ->> 'type' = 'goal' and coalesce(v_payload ->> 'source', 'manual') <> 'manual' then
      v_snapshot := p_snapshots -> v_element.element_key;
      if not private.profile_number_between(v_snapshot -> 'progress', 0, 1000000) then
        v_payload := v_payload - 'source';  -- sans valeur confirmée, la progression n'est pas publiée
      else
        v_payload := (v_payload - 'source') || jsonb_build_object('progress', v_snapshot -> 'progress', 'computed', true);
      end if;
    elsif v_element.kind = 'status' and v_payload ? 'expiresAt' and v_payload ->> 'expiresAt' is not null
          and (v_payload ->> 'expiresAt')::timestamptz <= now() then
      continue;
    elsif v_element.kind = 'layout' then
      select coalesce(jsonb_agg(k), '[]'::jsonb) into v_order from jsonb_array_elements_text(v_payload -> 'order') k
       where exists (select 1 from public.profile_elements w where w.user_id = v_uid and w.element_key = k and not w.deleted and w.visibility = 'audience');
      v_payload := jsonb_build_object('order', v_order);
    end if;
    select * into v_existing from public.profile_published where user_id = v_uid and element_key = v_element.element_key;
    if found and v_existing.moderation = 'removed' and v_existing.removed_revision >= v_element.revision then continue; end if;
    if found and v_existing.moderation = 'hidden' and v_existing.source_revision >= v_element.revision then continue; end if;
    insert into public.profile_published as p (user_id, element_key, payload, source_revision, published_at, moderation, removed_revision)
    values (v_uid, v_element.element_key, v_payload, v_element.revision, now(), 'visible', null)
    on conflict (user_id, element_key) do update
      set payload = excluded.payload, source_revision = excluded.source_revision, published_at = now(), moderation = 'visible', removed_revision = null;
    v_count := v_count + 1;
  end loop;
  update public.profile_sharing set published_at = now(), updated_at = now() where user_id = v_uid;
  return jsonb_build_object('published', v_count, 'epoch', v_row.publication_epoch, 'published_at', now());
end $$;

-- Lien révocable : un seul actif ; le jeton n'est rendu qu'une fois ; un lien révoqué ne revit jamais.
create or replace function public.profile_link_create() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := private.require_sharing(); v_token text;
begin
  if coalesce((select mode from public.profile_sharing where user_id = v_uid), 'private') = 'private' then raise exception 'sharing_private' using errcode = 'P0001'; end if;
  update private.profile_links set revoked_at = now() where user_id = v_uid and revoked_at is null;
  v_token := translate(encode(extensions.gen_random_bytes(24), 'base64'), '+/=', '-_');
  insert into private.profile_links (user_id, token_hash) values (v_uid, extensions.digest(v_token, 'sha256'));
  return jsonb_build_object('token', v_token);
end $$;

create or replace function public.profile_link_revoke() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := private.require_profiles();
begin
  update private.profile_links set revoked_at = now() where user_id = v_uid and revoked_at is null;
  update public.profile_sharing set publication_epoch = publication_epoch + 1, updated_at = now() where user_id = v_uid;
  return jsonb_build_object('revoked', true);
end $$;

create or replace function public.profile_touch_presence() returns void
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := private.require_sharing();
begin
  update public.profile_sharing set last_seen_at = now() where user_id = v_uid and presence_audience = 'audience';
end $$;

create or replace function public.profile_notice_read(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := private.require_profiles();
begin
  update public.profile_notices set read_at = now() where id = p_id and user_id = v_uid;
end $$;

-- ---------------------------------------------------------------------------------------
-- Visiteur : page, médias, recherche, blocage, signalement
-- ---------------------------------------------------------------------------------------
create or replace function public.profile_view(p_handle text default null, p_token text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_sharing(); v_target uuid := private.profile_target(v_uid, p_handle, p_token);
  v_sharing public.profile_sharing; v_elements jsonb; v_show jsonb;
begin
  if v_target is null then return jsonb_build_object('available', false); end if;
  select * into v_sharing from public.profile_sharing where user_id = v_target;
  select coalesce(jsonb_object_agg(p.element_key, p.payload), '{}'::jsonb) into v_elements from public.profile_published p
   where p.user_id = v_target and p.moderation = 'visible'
     and not (p.kind = 'status' and p.payload ? 'expiresAt' and p.payload ->> 'expiresAt' is not null and (p.payload ->> 'expiresAt')::timestamptz <= now());
  v_show := v_elements -> 'badges' -> 'show';
  return jsonb_build_object(
    'available', true, 'self', v_target = v_uid, 'handle', case when v_sharing.mode = 'members' then v_sharing.handle end,
    'elements', v_elements - 'badges',
    'badges', coalesce((select jsonb_agg(b) from jsonb_array_elements(private.profile_badges_for(v_target)) b
                         where v_show is not null and v_show ? (b ->> 'id')), '[]'::jsonb),
    'presence', case when v_sharing.presence_audience = 'audience' and v_sharing.last_seen_at > now() - interval '5 minutes' then 'online' end,
    'media', coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'mime', m.mime, 'width', m.width, 'height', m.height, 'animated', m.animated))
                         from public.profile_media m
                        where m.user_id = v_target and m.status = 'ready'
                          and exists (select 1 from public.profile_published p where p.user_id = v_target and p.moderation = 'visible'
                                       and m.id = any (private.profile_payload_media(p.payload)))), '[]'::jsonb));
end $$;

-- Autorisation de lecture d'un média, pour la fonction profile-media : relue à chaque demande, même avec une
-- adresse obtenue avant un retrait. Ne renvoie jamais le chemin de stockage (il contient l'identifiant interne).
create or replace function public.profile_media_access(p_media_id uuid, p_handle text default null, p_token text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := private.require_sharing(); v_target uuid; v_row public.profile_media;
begin
  select * into v_row from public.profile_media where id = p_media_id and status = 'ready';
  if not found then return null; end if;
  if v_row.user_id <> v_uid then
    v_target := private.profile_target(v_uid, p_handle, p_token);
    if v_target is null or v_target <> v_row.user_id then return null; end if;
    if not exists (select 1 from public.profile_published p where p.user_id = v_target and p.moderation = 'visible'
                    and p_media_id = any (private.profile_payload_media(p.payload))) then return null; end if;
  end if;
  return jsonb_build_object('mime', v_row.mime, 'animated', v_row.animated);
end $$;

-- Rôle service uniquement : chemin d'un média déjà autorisé par profile_media_access.
create or replace function public.service_profile_media_path(p_media_id uuid) returns text
language sql stable security definer set search_path = '' as $$
  select storage_path from public.profile_media where id = p_media_id and status = 'ready'
$$;
revoke all on function public.service_profile_media_path(uuid) from public, anon, authenticated;
grant execute on function public.service_profile_media_path(uuid) to service_role;

-- Recherche réservée aux membres connectés : pseudo seulement, profils « membres » qui l'ont choisi, pas de compte bloqué.
create or replace function public.profile_search(p_query text, p_after text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := private.require_sharing(); v_query text := lower(btrim(coalesce(p_query, '')));
begin
  if char_length(v_query) < 2 or char_length(v_query) > 20 or v_query !~ '^[a-z0-9_.-]+$' then raise exception 'invalid_parameter:query' using errcode = '22023'; end if;
  if (select count(*) from private.profile_search_log l where l.user_id = v_uid and l.at > now() - interval '10 minutes') >= 60 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;
  insert into private.profile_search_log (user_id) values (v_uid);
  delete from private.profile_search_log where at < now() - interval '1 day';
  return jsonb_build_object('items', coalesce((
    select jsonb_agg(jsonb_build_object('handle', r.handle, 'name', r.name, 'avatar', r.avatar) order by r.handle_norm) from (
      select s.handle, s.handle_norm,
             (select p.payload ->> 'name' from public.profile_published p where p.user_id = s.user_id and p.element_key = 'identity' and p.moderation = 'visible') as name,
             (select p.payload -> 'libraryId' from public.profile_published p where p.user_id = s.user_id and p.element_key = 'avatar' and p.moderation = 'visible'
                 and p.payload ->> 'source' = 'library') as avatar
        from public.profile_sharing s
        join private.user_directory d on d.user_id = s.user_id and d.status = 'active'
       where s.mode = 'members' and s.searchable and s.published_at is not null and s.moderation = 'visible'
         and s.handle_norm like v_query || '%' and (p_after is null or s.handle_norm > lower(p_after)) and s.user_id <> v_uid
         and not private.profile_blocked(v_uid, s.user_id)
       order by s.handle_norm limit 20) r), '[]'::jsonb));
end $$;

create or replace function public.profile_block(p_handle text default null, p_token text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := private.require_sharing(); v_target uuid := private.profile_target(v_uid, p_handle, p_token); v_label text;
begin
  if v_target is null or v_target = v_uid then return jsonb_build_object('blocked', false); end if;
  v_label := coalesce((select handle from public.profile_sharing where user_id = v_target and mode = 'members'), 'Profil partagé par lien');
  insert into private.profile_blocks (blocker_id, blocked_id, handle_snapshot) values (v_uid, v_target, v_label) on conflict do nothing;
  return jsonb_build_object('blocked', true);
end $$;

create or replace function public.profile_my_blocks() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := private.require_profiles();
begin
  return coalesce((select jsonb_agg(jsonb_build_object('id', b.id, 'label', b.handle_snapshot, 'created_at', b.created_at) order by b.created_at desc)
                     from private.profile_blocks b where b.blocker_id = v_uid), '[]'::jsonb);
end $$;

create or replace function public.profile_unblock(p_block_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := private.require_profiles();
begin
  delete from private.profile_blocks where id = p_block_id and blocker_id = v_uid;
end $$;

-- Signalement d'un profil ou d'un élément visible. Trois signalants distincts : l'élément est masqué en attendant l'examen.
create or replace function public.profile_report(p_handle text, p_token text, p_element_key text, p_reason text, p_note text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_sharing(); v_target uuid := private.profile_target(v_uid, p_handle, p_token);
  v_published public.profile_published; v_ref text; v_excerpt text;
begin
  if p_reason not in ('offensive', 'impersonation', 'personal_data', 'spam', 'other') then raise exception 'invalid_parameter:reason' using errcode = '22023'; end if;
  if v_target is null or v_target = v_uid then raise exception 'not_found' using errcode = 'P0002'; end if;
  if p_element_key is not null then
    select * into v_published from public.profile_published where user_id = v_target and element_key = p_element_key and moderation = 'visible';
    if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
    v_excerpt := coalesce(left(coalesce(v_published.payload ->> 'text', v_published.payload ->> 'bio', v_published.payload ->> 'name',
                   v_published.payload ->> 'message', v_published.payload ->> 'label', v_published.payload ->> 'title'), 280),
                   case when v_published.payload ? 'mediaId' then 'média ' || (v_published.payload ->> 'mediaId') end, v_published.kind);
  else
    v_excerpt := coalesce((select handle from public.profile_sharing where user_id = v_target), 'profil');
  end if;
  v_ref := v_target::text || ':' || coalesce(p_element_key, 'profile');
  insert into private.reports (reporter_id, target_user, target_kind, target_ref, excerpt, reason, note)
  values (v_uid, v_target, case when p_element_key is null then 'profile' else 'profile_element' end, v_ref, left(v_excerpt, 280), p_reason, left(p_note, 500))
  on conflict do nothing;
  if p_element_key is not null and (select count(distinct reporter_id) from private.reports where target_ref = v_ref and status = 'open') >= 3 then
    update public.profile_published set moderation = 'hidden' where user_id = v_target and element_key = p_element_key and moderation = 'visible';
  end if;
  return jsonb_build_object('reported', true);
end $$;

-- ---------------------------------------------------------------------------------------
-- Sprinter Admin : file de signalements (moderation.read / moderation.decide, AAL2, motif, audit)
-- ---------------------------------------------------------------------------------------
create or replace function private.report_item(p_report private.reports) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('id', p_report.id, 'created_at', p_report.created_at, 'status', p_report.status, 'reason', p_report.reason,
    'target_short', private.short_id(p_report.target_user),
    'element_kind', case p_report.target_kind when 'profile_element' then split_part(split_part(p_report.target_ref, ':', 2), ':', 1) else p_report.target_kind end,
    'excerpt', left(p_report.excerpt, 280),
    'reports_count', (select count(*) from private.reports r where r.target_kind = p_report.target_kind and r.target_ref = p_report.target_ref and r.status = p_report.status))
$$;

create or replace function public.admin_list_reports(p_status text[] default array['open'], p_cursor jsonb default null, p_limit int default 50)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_admin record; v_rows private.reports[]; v_last private.reports;
begin
  select * into v_admin from private.assert_admin('moderation.read');
  if p_status is null or cardinality(p_status) = 0 or not (p_status <@ array['open', 'actioned', 'dismissed']) then raise exception 'invalid_parameter:status' using errcode = '22023'; end if;
  if p_limit is null or p_limit not between 1 and 100 then raise exception 'invalid_parameter:limit' using errcode = '22023'; end if;
  select array_agg(s.x order by (s.x).created_at desc, (s.x).id desc) into v_rows from (
    select x from private.reports x
     where x.status = any (p_status)
       and (p_cursor is null or (x.created_at, x.id) < ((p_cursor ->> 'created_at')::timestamptz, (p_cursor ->> 'id')::uuid))
     order by x.created_at desc, x.id desc limit p_limit + 1) s;
  v_rows := coalesce(v_rows, '{}');
  if cardinality(v_rows) > p_limit then v_last := v_rows[p_limit]; v_rows := v_rows[1:p_limit]; end if;
  return jsonb_build_object('items', coalesce((select jsonb_agg(private.report_item(x)) from unnest(v_rows) x), '[]'::jsonb),
    'next_cursor', case when v_last.id is not null then jsonb_build_object('created_at', v_last.created_at, 'id', v_last.id) end);
end $$;

create or replace function public.admin_get_report(p_report_id uuid, p_reason text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_admin record; v_reason text; v_report private.reports; v_published public.profile_published; v_key text; v_text text;
begin
  select * into v_admin from private.assert_admin('moderation.read');
  v_reason := private.check_reason(p_reason, null);
  select * into v_report from private.reports where id = p_report_id;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  perform private.audit('moderation.view', v_report.target_user, v_reason, jsonb_build_object('report_id', p_report_id));
  if v_report.target_kind = 'profile_element' then
    v_key := substr(v_report.target_ref, position(':' in v_report.target_ref) + 1);
    select * into v_published from public.profile_published where user_id = v_report.target_user and element_key = v_key;
    -- Contexte strictement nécessaire : l'élément publié signalé, jamais le brouillon ni les données privées.
    v_text := left(coalesce(v_published.payload ->> 'text', v_published.payload ->> 'bio', v_published.payload ->> 'name', v_published.payload ->> 'message',
               v_published.payload ->> 'label', v_published.payload ->> 'title', v_published.payload ->> 'long', v_report.excerpt), 2000);
  end if;
  return jsonb_build_object(
    'report', private.report_item(v_report),
    'element', jsonb_build_object('kind', coalesce(v_published.kind, v_report.target_kind), 'text', coalesce(v_text, v_report.excerpt),
      'media_ref', case when v_published.payload ? 'mediaId' then 'profile-media:' || (v_published.payload ->> 'mediaId') end, 'media_url', null,
      'visibility', v_published.moderation, 'published_at', v_published.published_at),
    'history', coalesce((select jsonb_agg(jsonb_build_object('at', d.at, 'decision', d.decision, 'reason', d.reason, 'admin_short', private.short_id(d.admin_id), 'note', d.note)
                         order by d.at desc) from private.moderation_decisions d where d.target_kind = v_report.target_kind and d.target_ref = v_report.target_ref), '[]'::jsonb));
end $$;

create or replace function public.admin_moderate(p_report_id uuid, p_decision text, p_reason text, p_note text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_admin record; v_reason text; v_report private.reports; v_key text; v_status text; v_revision int;
begin
  select * into v_admin from private.assert_admin('moderation.decide');
  if coalesce(p_decision, '') not in ('hide', 'remove', 'restore', 'dismiss') then raise exception 'invalid_parameter:decision' using errcode = '22023'; end if;
  v_reason := private.check_reason(p_reason, p_note);
  select * into v_report from private.reports where id = p_report_id for update;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  v_key := substr(v_report.target_ref, position(':' in v_report.target_ref) + 1);
  if v_report.target_kind = 'profile_element' then
    select e.revision into v_revision from public.profile_elements e where e.user_id = v_report.target_user and e.element_key = v_key;
    update public.profile_published set
      moderation = case p_decision when 'hide' then 'hidden' when 'remove' then 'removed' when 'restore' then 'visible' else moderation end,
      removed_revision = case p_decision when 'remove' then greatest(coalesce(v_revision, source_revision), source_revision) when 'restore' then null else removed_revision end
     where user_id = v_report.target_user and element_key = v_key;
  elsif v_report.target_kind = 'profile' then
    update public.profile_sharing set
      moderation = case p_decision when 'hide' then 'hidden' when 'remove' then 'removed' when 'restore' then 'visible' else moderation end,
      publication_epoch = publication_epoch + case when p_decision in ('hide', 'remove') then 1 else 0 end, updated_at = now()
     where user_id = v_report.target_user;
    if p_decision = 'remove' then delete from public.profile_published where user_id = v_report.target_user; end if;
  elsif v_report.target_kind = 'handle' then
    update public.community_members set hidden_at = case when p_decision in ('hide', 'remove') then coalesce(hidden_at, now()) when p_decision = 'restore' then null else hidden_at end,
      hidden_reason = case when p_decision in ('hide', 'remove') then 'moderation' when p_decision = 'restore' then null else hidden_reason end
     where user_id = v_report.target_user;
  end if;
  if p_decision in ('hide', 'remove', 'restore') and v_report.target_kind in ('profile', 'profile_element') then
    insert into public.profile_notices (user_id, kind, element_key, reason)
    values (v_report.target_user, case p_decision when 'hide' then 'content_hidden' when 'restore' then 'content_restored'
              else case when v_report.target_kind = 'profile' then 'profile_removed' else 'content_removed' end end,
            case when v_report.target_kind = 'profile_element' then v_key end, v_report.reason);
  end if;
  v_status := case when p_decision = 'dismiss' then 'dismissed' else 'actioned' end;
  update private.reports set status = v_status, decision = p_decision, handled_at = now(), handled_by = auth.uid()
   where target_kind = v_report.target_kind and target_ref = v_report.target_ref and status = 'open';
  insert into private.moderation_decisions (report_id, target_user, target_kind, target_ref, decision, reason, note, admin_id)
  values (p_report_id, v_report.target_user, v_report.target_kind, v_report.target_ref, p_decision, p_reason, left(p_note, 200), auth.uid());
  perform private.audit('moderation.decide', v_report.target_user, v_reason, jsonb_build_object('report_id', p_report_id, 'decision', p_decision));
  return jsonb_build_object('report_id', p_report_id, 'decision', p_decision, 'status', v_status);
end $$;

-- ---------------------------------------------------------------------------------------
-- Suppression du compte : profil et accès retirés dès la validation de la demande (§17.9).
-- ---------------------------------------------------------------------------------------
create or replace function private.on_account_deleting(p_user_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.community_members where user_id = p_user_id;
  delete from public.profile_published where user_id = p_user_id;
  update public.profile_sharing set mode = 'private', searchable = false, published_at = null, publication_epoch = publication_epoch + 1 where user_id = p_user_id;
  update private.profile_links set revoked_at = now() where user_id = p_user_id and revoked_at is null;
end $$;

-- ---------------------------------------------------------------------------------------
-- Droits
-- ---------------------------------------------------------------------------------------
revoke all on function private.require_sharing(), private.profile_content_kind(text), private.profile_style_kind(text), private.profile_blocked(uuid, uuid),
  private.profile_handle_error(uuid, text), private.profile_target(uuid, text, text), private.report_item(private.reports) from public, anon, authenticated;
revoke all on function public.profile_sharing_get(), public.profile_sharing_set(text, boolean, text, text, text), public.profile_set_visibility(jsonb),
  public.profile_publish(int, jsonb), public.profile_link_create(), public.profile_link_revoke(), public.profile_touch_presence(), public.profile_notice_read(uuid),
  public.profile_view(text, text), public.profile_media_access(uuid, text, text), public.profile_search(text, text), public.profile_block(text, text),
  public.profile_my_blocks(), public.profile_unblock(uuid), public.profile_report(text, text, text, text, text),
  public.admin_list_reports(text[], jsonb, int), public.admin_get_report(uuid, text), public.admin_moderate(uuid, text, text, text) from public, anon;
grant execute on function public.profile_sharing_get(), public.profile_sharing_set(text, boolean, text, text, text), public.profile_set_visibility(jsonb),
  public.profile_publish(int, jsonb), public.profile_link_create(), public.profile_link_revoke(), public.profile_touch_presence(), public.profile_notice_read(uuid),
  public.profile_view(text, text), public.profile_media_access(uuid, text, text), public.profile_search(text, text), public.profile_block(text, text),
  public.profile_my_blocks(), public.profile_unblock(uuid), public.profile_report(text, text, text, text, text),
  public.admin_list_reports(text[], jsonb, int), public.admin_get_report(uuid, text), public.admin_moderate(uuid, text, text, text) to authenticated;
