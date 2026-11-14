-- 0008 — Entités secondaires (phase 2b, §7.9) : séances, itinéraires, chaussures, plans.
-- Un document par entité, dernier écrit gagne, suppression prioritaire (tombstone).
-- Les itinéraires contiennent des coordonnées : ils exigent les deux sauvegardes (courses + parcours).

create table public.synced_documents (
  user_id           uuid not null references auth.users(id) on delete cascade,
  kind              text not null check (kind in ('workout','route','shoe','plan')),
  id                text not null check (char_length(id) between 1 and 200),
  payload           jsonb not null check (jsonb_typeof(payload) = 'object' and octet_length(payload::text) <= 262144),
  client_updated_at timestamptz not null,
  server_updated_at timestamptz not null default now(),
  deleted_at        timestamptz,
  primary key (user_id, kind, id)
);
create index synced_documents_sync_idx on public.synced_documents (user_id, server_updated_at, kind, id);
alter table public.synced_documents enable row level security;
revoke all on public.synced_documents from anon, authenticated;
grant all on public.synced_documents to service_role;
grant select on public.synced_documents to authenticated;
create policy synced_documents_select_own on public.synced_documents for select to authenticated
  using (user_id = (select authz.active_uid()));

create or replace function public.sync_push_documents(p_docs jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_uid();
  v_runs boolean := private.has_consent(v_uid, 'cloud_sync_runs');
  v_routes boolean := v_runs and private.has_consent(v_uid, 'cloud_sync_routes');
  v_doc jsonb; v_kind text; v_id text; v_at timestamptz; v_deleted boolean; v_existing record; v_status text; v_out jsonb := '[]'::jsonb; v_server timestamptz;
begin
  if p_docs is null or jsonb_typeof(p_docs) <> 'array' or jsonb_array_length(p_docs) > 100 then
    raise exception 'bad_batch' using errcode = '22023';
  end if;
  for v_doc in select value from jsonb_array_elements(p_docs) loop
    v_kind := v_doc ->> 'kind'; v_id := v_doc ->> 'id'; v_deleted := coalesce((v_doc ->> 'deleted')::boolean, false);
    begin v_at := least((v_doc ->> 'client_updated_at')::timestamptz, now()); exception when others then v_at := null; end;
    if v_kind is null or v_kind not in ('workout','route','shoe','plan') or v_id is null or char_length(v_id) not between 1 and 200 or v_at is null
       or (not v_deleted and (jsonb_typeof(v_doc -> 'payload') <> 'object' or octet_length((v_doc -> 'payload')::text) > 262144)) then
      v_out := v_out || jsonb_build_object('kind', v_kind, 'id', v_id, 'status', 'rejected', 'reason', 'bad_document'); continue;
    end if;
    if not v_runs or (v_kind = 'route' and not v_routes) then
      v_out := v_out || jsonb_build_object('kind', v_kind, 'id', v_id, 'status', 'rejected', 'reason', 'backup_disabled'); continue;
    end if;
    select d.deleted_at, d.client_updated_at into v_existing from public.synced_documents d
     where d.user_id = v_uid and d.kind = v_kind and d.id = v_id for update;
    if found and v_existing.deleted_at is not null then v_status := 'ignored_deleted';
    elsif found and v_existing.client_updated_at >= v_at then v_status := 'ignored_stale';
    else
      insert into public.synced_documents as d (user_id, kind, id, payload, client_updated_at, deleted_at)
      values (v_uid, v_kind, v_id, case when v_deleted then '{}'::jsonb else v_doc -> 'payload' end, v_at, case when v_deleted then now() end)
      on conflict (user_id, kind, id) do update
        set payload = excluded.payload, client_updated_at = excluded.client_updated_at, deleted_at = excluded.deleted_at, server_updated_at = now()
      where d.deleted_at is null and d.client_updated_at < excluded.client_updated_at;
      v_status := 'applied';
    end if;
    select server_updated_at into v_server from public.synced_documents where user_id = v_uid and kind = v_kind and id = v_id;
    v_out := v_out || jsonb_build_object('kind', v_kind, 'id', v_id, 'status', v_status, 'server_updated_at', v_server);
  end loop;
  return v_out;
end $$;

create or replace function public.sync_pull_documents(p_after_ts timestamptz default null, p_after_kind text default null, p_after_id text default null, p_limit int default 200)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_uid();
  v_limit int := least(greatest(coalesce(p_limit, 200), 1), 500);
  v_routes boolean := private.has_consent(v_uid, 'cloud_sync_routes');
  v_items jsonb; v_count int;
begin
  select coalesce(jsonb_agg(jsonb_build_object('kind', d.kind, 'id', d.id, 'deleted', d.deleted_at is not null,
           'client_updated_at', d.client_updated_at, 'server_updated_at', d.server_updated_at,
           'payload', case when d.deleted_at is null then d.payload end) order by d.server_updated_at, d.kind, d.id), '[]'::jsonb),
         count(*)
    into v_items, v_count
    from (select * from public.synced_documents d
          where d.user_id = v_uid and (d.kind <> 'route' or v_routes)
            and (p_after_ts is null or (d.server_updated_at, d.kind, d.id) > (p_after_ts, coalesce(p_after_kind, ''), coalesce(p_after_id, '')))
          order by d.server_updated_at, d.kind, d.id limit v_limit) d;
  return jsonb_build_object('items', v_items, 'next_cursor', case when jsonb_array_length(v_items) = v_limit then
    jsonb_build_object('ts', v_items -> -1 ->> 'server_updated_at', 'kind', v_items -> -1 ->> 'kind', 'id', v_items -> -1 ->> 'id') end);
end $$;

revoke all on function public.sync_push_documents(jsonb), public.sync_pull_documents(timestamptz, text, text, int) from public, anon;
grant execute on function public.sync_push_documents(jsonb), public.sync_pull_documents(timestamptz, text, text, int) to authenticated;
