-- 0018 — Bibliothèque communautaire de thèmes (phase 8d, §17.11) : publication sur choix explicite, styles
-- autorisés seulement (aucune photo, aucun texte personnel, aucun badge, aucune valeur de widget), favoris,
-- copie indépendante côté app, signalement et modération. Flag `theme_library_enabled` (et cartes : `profile_cards_enabled`).

insert into public.app_config (key, value) values ('theme_library_enabled', 'false'::jsonb), ('profile_cards_enabled', 'false'::jsonb)
on conflict (key) do nothing;

create table public.theme_library (
  id              uuid primary key,
  author_id       uuid not null references auth.users (id) on delete cascade,
  name            text not null check (char_length(btrim(name)) between 2 and 40),
  category        text not null check (category in ('espace', 'cyberpunk', 'nature', 'retro', 'pixel', 'minimaliste', 'neon', 'sombre', 'pastel', 'saisonnier', 'autre')),
  style           jsonb not null,
  status          text not null default 'visible' check (status in ('visible', 'hidden', 'removed', 'withdrawn')),
  favorites_count integer not null default 0,
  created_at      timestamptz not null default now()
);
create index theme_library_recent on public.theme_library (created_at desc, id) where status = 'visible';
create index theme_library_author on public.theme_library (author_id);
comment on table public.theme_library is 'Thèmes publiés volontairement (§17.11) : paramètres visuels autorisés et références au catalogue uniquement.';

create table private.theme_favorites (
  user_id    uuid not null references auth.users (id) on delete cascade,
  theme_id   uuid not null references public.theme_library (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, theme_id)
);

alter table public.theme_library enable row level security;
revoke all on public.theme_library from anon, authenticated;
grant all on public.theme_library to service_role;
grant select on public.theme_library to authenticated;
create policy theme_library_select_own on public.theme_library for select to authenticated using (author_id = (select authz.active_uid()));

create or replace function private.require_library() returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := private.require_profiles();
begin
  if not private.flag('theme_library_enabled') then raise exception 'feature_disabled' using errcode = 'P0001', hint = 'feature_flag'; end if;
  return v_uid;
end $$;

-- Style partageable : apparence, bannière sans image, style d'avatar sans image, décorations sans texte.
create or replace function private.theme_style_error(p_style jsonb) returns text
language plpgsql stable set search_path = '' as $$
begin
  if jsonb_typeof(p_style) is distinct from 'object' or octet_length(p_style::text) > 3072
     or not private.profile_keys_ok(p_style, array['appearance', 'banner', 'avatar', 'decorations']) then return 'style'; end if;
  if p_style ? 'appearance' and private.profile_payload_error('appearance', p_style -> 'appearance') is not null then return 'appearance'; end if;
  if p_style ? 'banner' and (coalesce(p_style -> 'banner' ->> 'source', '') not in ('default', 'preset', 'color', 'gradient')
     or private.profile_payload_error('banner', p_style -> 'banner') is not null) then return 'banner'; end if;
  if p_style ? 'avatar' and (jsonb_typeof(p_style -> 'avatar') <> 'object' or not private.profile_keys_ok(p_style -> 'avatar', array['shape', 'frame', 'halo'])
     or private.profile_payload_error('avatar', (p_style -> 'avatar') || '{"source":"default"}'::jsonb) is not null) then return 'avatar'; end if;
  if p_style ? 'decorations' and (jsonb_typeof(p_style -> 'decorations') <> 'object' or not private.profile_keys_ok(p_style -> 'decorations', array['icon', 'plate', 'card', 'entry'])
     or private.profile_payload_error('decorations', p_style -> 'decorations') is not null) then return 'decorations'; end if;
  return null;
end $$;

create or replace function public.theme_publish(p_id uuid, p_name text, p_category text, p_style jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := private.require_library(); v_error text; v_row public.theme_library;
begin
  select * into v_row from public.theme_library where id = p_id;
  if found then
    if v_row.author_id <> v_uid then raise exception 'invalid_parameter:id' using errcode = '22023'; end if;
    return jsonb_build_object('id', v_row.id, 'status', v_row.status);
  end if;
  if p_id is null or p_name is null or char_length(btrim(p_name)) not between 2 and 40 or not private.profile_text_ok(to_jsonb(p_name), 40)
     or p_name ~* '(officiel|official|sprinter|admin|moderat|certifi)' then raise exception 'invalid_parameter:name' using errcode = '22023'; end if;
  if coalesce(p_category, '') not in ('espace', 'cyberpunk', 'nature', 'retro', 'pixel', 'minimaliste', 'neon', 'sombre', 'pastel', 'saisonnier', 'autre') then
    raise exception 'invalid_parameter:category' using errcode = '22023';
  end if;
  v_error := private.theme_style_error(p_style);
  if v_error is not null then raise exception 'invalid_style:%', v_error using errcode = '22023'; end if;
  if (select count(*) from public.theme_library where author_id = v_uid and status in ('visible', 'hidden')) >= 10 then
    raise exception 'limit_themes' using errcode = 'P0001';
  end if;
  insert into public.theme_library (id, author_id, name, category, style) values (p_id, v_uid, btrim(p_name), p_category, p_style);
  return jsonb_build_object('id', p_id, 'status', 'visible');
end $$;

-- Parcours : membres connectés ; jamais l'auteur ; sans les auteurs bloqués ni les comptes inactifs.
create or replace function public.theme_list(p_category text default null, p_sort text default 'recent', p_offset int default 0) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := private.require_library();
begin
  if coalesce(p_sort, '') not in ('recent', 'popular', 'favorites') or p_offset is null or p_offset not between 0 and 1000 then
    raise exception 'invalid_parameter' using errcode = '22023';
  end if;
  return jsonb_build_object('items', coalesce((
    select jsonb_agg(jsonb_build_object('id', t.id, 'name', t.name, 'category', t.category, 'style', t.style, 'favorites', t.favorites_count,
      'favorite', exists (select 1 from private.theme_favorites f where f.user_id = v_uid and f.theme_id = t.id), 'mine', t.author_id = v_uid)
      order by case when p_sort = 'popular' then t.favorites_count end desc nulls last, t.created_at desc, t.id)
    from (select * from public.theme_library t
           where t.status = 'visible' and (p_category is null or t.category = p_category)
             and (p_sort <> 'favorites' or exists (select 1 from private.theme_favorites f where f.user_id = v_uid and f.theme_id = t.id))
             and exists (select 1 from private.user_directory d where d.user_id = t.author_id and d.status = 'active')
             and not private.profile_blocked(v_uid, t.author_id)
           order by case when p_sort = 'popular' then t.favorites_count end desc nulls last, t.created_at desc, t.id
           offset p_offset limit 30) t), '[]'::jsonb));
end $$;

create or replace function public.theme_favorite(p_id uuid, p_on boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := private.require_library(); v_changed int;
begin
  if not exists (select 1 from public.theme_library where id = p_id and status = 'visible') then raise exception 'not_found' using errcode = 'P0002'; end if;
  if p_on then
    insert into private.theme_favorites (user_id, theme_id) values (v_uid, p_id) on conflict do nothing;
    get diagnostics v_changed = row_count;
    update public.theme_library set favorites_count = favorites_count + v_changed where id = p_id;
  else
    delete from private.theme_favorites where user_id = v_uid and theme_id = p_id;
    get diagnostics v_changed = row_count;
    update public.theme_library set favorites_count = greatest(0, favorites_count - v_changed) where id = p_id;
  end if;
  return jsonb_build_object('favorite', p_on);
end $$;

create or replace function public.theme_withdraw(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := private.require_profiles();
begin
  update public.theme_library set status = 'withdrawn' where id = p_id and author_id = v_uid and status in ('visible', 'hidden');
end $$;

create or replace function public.theme_report(p_id uuid, p_reason text, p_note text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := private.require_library(); v_theme public.theme_library;
begin
  if p_reason not in ('offensive', 'impersonation', 'personal_data', 'spam', 'other') then raise exception 'invalid_parameter:reason' using errcode = '22023'; end if;
  select * into v_theme from public.theme_library where id = p_id and status = 'visible';
  if not found or v_theme.author_id = v_uid then raise exception 'not_found' using errcode = 'P0002'; end if;
  insert into private.reports (reporter_id, target_user, target_kind, target_ref, excerpt, reason, note)
  values (v_uid, v_theme.author_id, 'theme', p_id::text, left(v_theme.name || ' · ' || v_theme.category, 280), p_reason, left(p_note, 500))
  on conflict do nothing;
  if (select count(distinct reporter_id) from private.reports where target_kind = 'theme' and target_ref = p_id::text and status = 'open') >= 3 then
    update public.theme_library set status = 'hidden' where id = p_id and status = 'visible';
  end if;
  return jsonb_build_object('reported', true);
end $$;

-- ---------------------------------------------------------------------------------------
-- Modération : les thèmes rejoignent la file (mêmes règles que les profils, §17.9).
-- ---------------------------------------------------------------------------------------
create or replace function public.admin_get_report(p_report_id uuid, p_reason text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_admin record; v_reason text; v_report private.reports; v_published public.profile_published; v_theme public.theme_library; v_key text; v_text text;
begin
  select * into v_admin from private.assert_admin('moderation.read');
  v_reason := private.check_reason(p_reason, null);
  select * into v_report from private.reports where id = p_report_id;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  perform private.audit('moderation.view', v_report.target_user, v_reason, jsonb_build_object('report_id', p_report_id));
  if v_report.target_kind = 'profile_element' then
    v_key := substr(v_report.target_ref, position(':' in v_report.target_ref) + 1);
    select * into v_published from public.profile_published where user_id = v_report.target_user and element_key = v_key;
    v_text := left(coalesce(v_published.payload ->> 'text', v_published.payload ->> 'bio', v_published.payload ->> 'name', v_published.payload ->> 'message',
               v_published.payload ->> 'label', v_published.payload ->> 'title', v_published.payload ->> 'long', v_report.excerpt), 2000);
  elsif v_report.target_kind = 'theme' then
    select * into v_theme from public.theme_library where id = v_report.target_ref::uuid;
    v_text := left(v_theme.name || ' · ' || v_theme.category || ' · ' || v_theme.style::text, 2000);
  end if;
  return jsonb_build_object(
    'report', private.report_item(v_report),
    'element', jsonb_build_object('kind', coalesce(v_published.kind, v_report.target_kind), 'text', coalesce(v_text, v_report.excerpt),
      'media_ref', case when v_published.payload ? 'mediaId' then 'profile-media:' || (v_published.payload ->> 'mediaId') end, 'media_url', null,
      'visibility', coalesce(v_published.moderation, v_theme.status), 'published_at', coalesce(v_published.published_at, v_theme.created_at)),
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
  elsif v_report.target_kind = 'theme' then
    update public.theme_library set status = case p_decision when 'hide' then 'hidden' when 'remove' then 'removed' when 'restore' then 'visible' else status end
     where id = v_report.target_ref::uuid and status <> 'withdrawn';
  elsif v_report.target_kind = 'handle' then
    update public.community_members set hidden_at = case when p_decision in ('hide', 'remove') then coalesce(hidden_at, now()) when p_decision = 'restore' then null else hidden_at end,
      hidden_reason = case when p_decision in ('hide', 'remove') then 'moderation' when p_decision = 'restore' then null else hidden_reason end
     where user_id = v_report.target_user;
  end if;
  if p_decision in ('hide', 'remove', 'restore') and v_report.target_kind in ('profile', 'profile_element', 'theme') then
    insert into public.profile_notices (user_id, kind, element_key, reason)
    values (v_report.target_user, case p_decision when 'hide' then 'content_hidden' when 'restore' then 'content_restored'
              else case when v_report.target_kind = 'profile' then 'profile_removed' else 'content_removed' end end,
            case when v_report.target_kind = 'profile_element' then v_key when v_report.target_kind = 'theme' then 'theme:' || v_report.target_ref end, v_report.reason);
  end if;
  v_status := case when p_decision = 'dismiss' then 'dismissed' else 'actioned' end;
  update private.reports set status = v_status, decision = p_decision, handled_at = now(), handled_by = auth.uid()
   where target_kind = v_report.target_kind and target_ref = v_report.target_ref and status = 'open';
  insert into private.moderation_decisions (report_id, target_user, target_kind, target_ref, decision, reason, note, admin_id)
  values (p_report_id, v_report.target_user, v_report.target_kind, v_report.target_ref, p_decision, p_reason, left(p_note, 200), auth.uid());
  perform private.audit('moderation.decide', v_report.target_user, v_reason, jsonb_build_object('report_id', p_report_id, 'decision', p_decision));
  return jsonb_build_object('report_id', p_report_id, 'decision', p_decision, 'status', v_status);
end $$;

-- Suppression du compte : thèmes retirés de la bibliothèque dès la validation de la demande.
create or replace function private.on_account_deleting(p_user_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.community_members where user_id = p_user_id;
  delete from public.profile_published where user_id = p_user_id;
  update public.profile_sharing set mode = 'private', searchable = false, published_at = null, publication_epoch = publication_epoch + 1 where user_id = p_user_id;
  update private.profile_links set revoked_at = now() where user_id = p_user_id and revoked_at is null;
  update public.theme_library set status = 'withdrawn' where author_id = p_user_id and status in ('visible', 'hidden');
end $$;

revoke all on function private.require_library(), private.theme_style_error(jsonb) from public, anon, authenticated;
revoke all on function public.theme_publish(uuid, text, text, jsonb), public.theme_list(text, text, int), public.theme_favorite(uuid, boolean),
  public.theme_withdraw(uuid), public.theme_report(uuid, text, text) from public, anon;
grant execute on function public.theme_publish(uuid, text, text, jsonb), public.theme_list(text, text, int), public.theme_favorite(uuid, boolean),
  public.theme_withdraw(uuid), public.theme_report(uuid, text, text) to authenticated;
