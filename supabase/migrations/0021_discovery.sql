-- Catalogue territorial (lecture membre bornée, édition propriétaire, ingestion sous bail).
create table private.discovery_markets (
  id text primary key check (id ~ '^[a-z0-9][a-z0-9-]{1,98}[a-z0-9]$'),
  country_code text not null check (country_code ~ '^[A-Z]{2}$'),
  revision bigint not null default 0
);
insert into private.discovery_markets (id, country_code) values ('nice', 'FR');

create table private.discovery_items (
  market text not null references private.discovery_markets(id),
  id text collate "C" not null check (id ~ '^[a-z0-9][a-z0-9-]{1,98}[a-z0-9]$'),
  state text not null check (state in ('draft', 'pending_review', 'published', 'stale', 'cancelled', 'postponed', 'archived', 'rejected')),
  payload jsonb not null check (jsonb_typeof(payload) = 'object' and octet_length(payload::text) <= 240000),
  public_once boolean not null,
  revision bigint not null,
  updated_at timestamptz not null default now(),
  primary key (market, id)
);
create index discovery_public_index on private.discovery_items (market, id) where public_once;

create table private.discovery_revisions (
  id bigint generated always as identity primary key,
  market text not null,
  item_id text not null,
  editor uuid references auth.users(id) on delete set null,
  at timestamptz not null default now(),
  reason text not null,
  before jsonb,
  after jsonb not null
);
create index discovery_revisions_market on private.discovery_revisions (market, id desc);

create table private.discovery_sources (
  id text primary key,
  market text not null references private.discovery_markets(id),
  source_url text,
  etag text,
  modified text,
  payload_hash text,
  last_started_at timestamptz,
  last_success_at timestamptz,
  lease uuid,
  lease_until timestamptz
);
insert into private.discovery_sources (id, market) values ('apidae-nice', 'nice');

create table private.discovery_import_runs (
  id uuid primary key,
  source text not null references private.discovery_sources(id),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  state text not null check (state in ('running', 'ok', 'unchanged', 'failed', 'expired')),
  metrics jsonb not null default '{}'::jsonb,
  error_code text
);
create index discovery_import_runs_source on private.discovery_import_runs (source, started_at desc);

create table private.discovery_candidates (
  source text not null references private.discovery_sources(id),
  external_id text not null,
  fingerprint text not null,
  payload jsonb not null,
  state text not null default 'pending_review' check (state in ('pending_review', 'accepted', 'rejected')),
  updated_at timestamptz not null default now(),
  review_note text,
  reviewed_by uuid references auth.users(id) on delete set null,
  item_id text,
  primary key (source, external_id)
);
create index discovery_review_queue on private.discovery_candidates (source, state, external_id);
create index discovery_candidate_fingerprint on private.discovery_candidates (source, fingerprint);

alter table private.discovery_markets enable row level security;
alter table private.discovery_items enable row level security;
alter table private.discovery_revisions enable row level security;
alter table private.discovery_sources enable row level security;
alter table private.discovery_import_runs enable row level security;
alter table private.discovery_candidates enable row level security;
revoke all on private.discovery_markets, private.discovery_items, private.discovery_revisions,
  private.discovery_sources, private.discovery_import_runs, private.discovery_candidates from public, anon, authenticated;

create function public.discovery_feed_v1(p_market text, p_after text default null, p_revision bigint default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_revision bigint; v_entries jsonb; v_next text;
begin
  perform private.require_uid();
  select m.revision into v_revision from private.discovery_markets m where m.id = p_market;
  if not found or (p_after is not null and (p_after !~ '^[a-z0-9][a-z0-9-]{1,98}[a-z0-9]$' or p_revision is null)) then
    raise exception 'invalid_catalogue_cursor' using errcode = '22023';
  end if;
  if p_revision is not null and p_revision <> v_revision then
    raise exception 'catalogue_revision_changed' using errcode = '40001';
  end if;
  with page as (
    select d.id, d.state, d.payload from private.discovery_items d
    where d.market = p_market and d.public_once and d.id > coalesce(p_after, '') collate "C"
    order by d.id limit 21
  ), numbered as (
    select *, row_number() over (order by id) as rn from page
  )
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'item',
      case when state in ('published', 'stale', 'cancelled', 'postponed') then jsonb_set(payload, '{state}', to_jsonb(state)) end
    ) order by id) filter (where rn <= 20), '[]'::jsonb),
    case when count(*) > 20 then max(id) filter (where rn = 20) end
  into v_entries, v_next from numbered;
  return jsonb_build_object('version', 1, 'revision', v_revision, 'entries', v_entries, 'nextCursor', v_next);
end $$;

-- Editors validate the entire versioned payload via the authoring tool. SQL also enforces the
-- public projection's bounds, mandatory source evidence and absence of arbitrary provider fields.
create function private.discovery_payload_ok(p_market text, p_id text, p_payload jsonb) returns boolean
language plpgsql stable set search_path = '' as $$
declare evidence jsonb; v_country text;
begin
  select m.country_code into v_country from private.discovery_markets m where m.id = p_market;
  if not found or p_payload is null or jsonb_typeof(p_payload) <> 'object' or octet_length(p_payload::text) > 240000 then return false; end if;
  if not (p_payload ?& array['id','market','countryCode','title','summary','city','kind','state','officialUrl','sources'])
    or (p_payload - array['id','market','countryCode','title','summary','city','kind','state','officialUrl','sources','schedule','dateNote',
      'reviewBy','point','venue','address','terrain','setting','distancesKm','elevationGainM','organizer','clubId','beginner',
      'accessible','registration','price','facts','mediaKey','track','featured']) <> '{}'::jsonb
    or p_payload->>'id' is distinct from p_id or p_payload->>'market' is distinct from p_market
    or p_payload->>'countryCode' is distinct from v_country
    or coalesce(p_payload->>'kind', '') not in ('race','club_run','training','club','place','route')
    or coalesce(p_payload->>'state', '') not in ('published','stale','cancelled','postponed')
    or coalesce(p_payload->>'officialUrl', '') !~ '^https://[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(/|\?|#|$)'
    or coalesce(length(trim(p_payload->>'title')), 0) not between 1 and 120
    or coalesce(length(trim(p_payload->>'summary')), 0) not between 1 and 500
    or coalesce(length(trim(p_payload->>'city')), 0) not between 1 and 100
    or jsonb_typeof(p_payload->'sources') is distinct from 'array' then return false; end if;
  if jsonb_array_length(p_payload->'sources') not between 1 and 6 then return false; end if;
  for evidence in select value from jsonb_array_elements(p_payload->'sources') loop
    if jsonb_typeof(evidence) <> 'object' or (evidence - array['kind','url','name','checkedOn','license','externalId']) <> '{}'::jsonb
      or coalesce(evidence->>'kind', '') not in ('organizer','institution','open_data')
      or coalesce(evidence->>'checkedOn', '') !~ '^\d{4}-\d{2}-\d{2}$'
      or coalesce(length(trim(evidence->>'name')), 0) not between 1 and 140
      or coalesce(evidence->>'url', '') !~ '^https://[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(/|\?|#|$)' then return false; end if;
  end loop;
  return true;
end $$;

create function private.discovery_write(p_market text, p_id text, p_item jsonb, p_state text,
  p_expected bigint, p_reason text, p_editor uuid, p_seed boolean) returns bigint
language plpgsql set search_path = '' as $$
declare previous private.discovery_items; saved private.discovery_items; v_revision bigint; v_public boolean;
begin
  if p_id is null or p_id !~ '^[a-z0-9][a-z0-9-]{1,98}[a-z0-9]$' or not private.discovery_payload_ok(p_market, p_id, p_item)
    or p_state is null or p_state not in ('draft','pending_review','published','stale','cancelled','postponed','archived','rejected')
    or coalesce(length(trim(p_reason)), 0) not between 5 and 400 then raise exception 'invalid_discovery_edit' using errcode = '22023'; end if;
  select revision into v_revision from private.discovery_markets where id = p_market for update;
  select * into previous from private.discovery_items d where d.market = p_market and d.id = p_id;
  if p_seed and found then return previous.revision; end if;
  if coalesce(previous.revision, 0) is distinct from p_expected then
    raise exception 'discovery_edit_conflict' using errcode = '40001';
  end if;
  if previous.state = p_state and previous.payload = p_item then return previous.revision; end if;
  v_public := coalesce(previous.public_once, false) or p_state in ('published','stale','cancelled','postponed');
  if v_public and not coalesce(previous.public_once, false) and
    (select count(*) from private.discovery_items where market = p_market and public_once) >= 600 then
    raise exception 'discovery_market_full' using errcode = '22023';
  end if;
  update private.discovery_markets set revision = revision + 1 where id = p_market returning revision into v_revision;
  insert into private.discovery_items (market, id, state, payload, public_once, revision)
    values (p_market, p_id, p_state, p_item, v_public, v_revision)
  on conflict (market, id) do update set state = excluded.state, payload = excluded.payload,
    public_once = excluded.public_once, revision = excluded.revision, updated_at = now()
  returning * into saved;
  insert into private.discovery_revisions (market, item_id, editor, reason, before, after)
    values (p_market, p_id, p_editor, trim(p_reason), case when previous.id is not null then to_jsonb(previous) end, to_jsonb(saved));
  return v_revision;
end $$;

create function public.service_discovery_seed_v1(p_market text, p_items jsonb, p_reason text) returns integer
language plpgsql security definer set search_path = '' as $$
declare item jsonb;
begin
  if jsonb_typeof(p_items) is distinct from 'array' then raise exception 'invalid_seed' using errcode = '22023'; end if;
  if jsonb_array_length(p_items) not between 1 and 80 then raise exception 'invalid_seed' using errcode = '22023'; end if;
  -- Lock in the same order as the editor, and never overwrite a decision already taken online.
  for item in select value from jsonb_array_elements(p_items) order by value->>'id' loop
    perform private.discovery_write(p_market, item->>'id', item, item->>'state', 0, p_reason, null, true);
  end loop;
  return jsonb_array_length(p_items);
end $$;

create function public.admin_discovery_write_v1(p_market text, p_id text, p_item jsonb, p_state text, p_expected bigint, p_reason text)
returns bigint language plpgsql security definer set search_path = '' as $$
declare actor uuid;
begin
  select admin_id into actor from private.assert_admin(null, true) where role = 'owner';
  if not found then raise exception 'forbidden' using errcode = '42501'; end if;
  return private.discovery_write(p_market, p_id, p_item, p_state, p_expected, p_reason, actor, false);
end $$;

create function public.admin_discovery_queue_v1(p_market text, p_after text default '', p_item_id text default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform 1 from private.assert_admin(null, false) where role = 'owner';
  if not found then raise exception 'forbidden' using errcode = '42501'; end if;
  return jsonb_build_object(
    'candidates', coalesce((select jsonb_agg(to_jsonb(q) order by q.external_id) from (
      select c.*, array(select d.id from private.discovery_items d where d.market = p_market
        and d.payload->'schedule'->>'day' = c.payload->'schedule'->>'day'
        and lower(d.payload->>'city') = lower(c.payload->>'city')) as same_day_ids,
        exists(select 1 from private.discovery_candidates cd where cd.source = c.source and cd.fingerprint = c.fingerprint
          and cd.external_id <> c.external_id) as potential_duplicate
      from private.discovery_candidates c join private.discovery_sources s on s.id = c.source
      where s.market = p_market and c.state = 'pending_review' and c.external_id > p_after order by c.external_id limit 25
    ) q), '[]'::jsonb),
    'imports', coalesce((select jsonb_agg(to_jsonb(r) order by r.started_at desc) from (
      select r.* from private.discovery_import_runs r join private.discovery_sources s on s.id = r.source
      where s.market = p_market order by r.started_at desc limit 20
    ) r), '[]'::jsonb),
    'sources', coalesce((select jsonb_agg(to_jsonb(s) - 'lease') from private.discovery_sources s where s.market = p_market), '[]'::jsonb),
    'item', (select to_jsonb(d) from private.discovery_items d where d.market = p_market and d.id = p_item_id),
    'recentEdits', coalesce((select jsonb_agg(to_jsonb(a) order by a.id desc) from (
      select a.* from private.discovery_revisions a where a.market = p_market and (p_item_id is null or a.item_id = p_item_id) order by a.id desc limit 12
    ) a), '[]'::jsonb)
  );
end $$;

create function public.admin_discovery_review_v1(p_source text, p_external_id text, p_decision text, p_expected timestamptz,
  p_item_id text, p_reason text) returns void language plpgsql security definer set search_path = '' as $$
declare actor uuid;
begin
  select admin_id into actor from private.assert_admin(null, true) where role = 'owner';
  if not found then raise exception 'forbidden' using errcode = '42501'; end if;
  if coalesce(p_decision, '') not in ('accepted','rejected') or coalesce(length(trim(p_reason)), 0) not between 5 and 400
    or (p_decision = 'accepted' and not exists (
      select 1 from private.discovery_items d join private.discovery_sources s on s.market = d.market
      where s.id = p_source and d.id = p_item_id and d.public_once
    )) then raise exception 'invalid_review' using errcode = '22023'; end if;
  update private.discovery_candidates set state = p_decision, item_id = case when p_decision = 'accepted' then p_item_id end,
    review_note = p_reason, reviewed_by = actor where source = p_source and external_id = p_external_id and updated_at = p_expected and state = 'pending_review';
  if not found then raise exception 'discovery_review_conflict' using errcode = '40001'; end if;
  perform private.audit('discovery.review', null, p_reason,
    jsonb_build_object('source', p_source, 'external_id', p_external_id, 'decision', p_decision, 'item_id', p_item_id));
end $$;

create function public.service_discovery_begin_v1(p_source text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare s private.discovery_sources; job uuid;
begin
  select * into s from private.discovery_sources where id = p_source for update;
  if not found then raise exception 'unknown_discovery_source' using errcode = '22023'; end if;
  if s.lease_until > now() or s.last_started_at > now() - interval '5 minutes' then return null; end if;
  update private.discovery_import_runs set state = 'expired', ended_at = now(), error_code = 'lease_expired'
    where id = s.lease and state = 'running';
  job := gen_random_uuid();
  update private.discovery_sources set lease = job, lease_until = now() + interval '3 minutes', last_started_at = now() where id = p_source;
  insert into private.discovery_import_runs(id, source, state) values (job, p_source, 'running');
  return jsonb_build_object('id', job, 'url', s.source_url, 'etag', s.etag, 'modified', s.modified, 'hash', s.payload_hash);
end $$;

create function public.service_discovery_finish_v1(p_source text, p_lease uuid, p_state text, p_checkpoint jsonb,
  p_metrics jsonb, p_rows jsonb, p_error text default null) returns integer
language plpgsql security definer set search_path = '' as $$
declare s private.discovery_sources; candidate jsonb; v_count integer := 0;
begin
  select * into s from private.discovery_sources where id = p_source for update;
  if not found or p_lease is null or p_lease is distinct from s.lease or s.lease_until <= now() then
    raise exception 'lost_discovery_lease' using errcode = '40001';
  end if;
  if coalesce(p_state, '') not in ('ok','unchanged','failed') or jsonb_typeof(p_rows) is distinct from 'array'
    or jsonb_typeof(p_metrics) is distinct from 'object' or octet_length(p_metrics::text) > 1000
    or coalesce(length(p_error), 0) > 100 then raise exception 'invalid_discovery_result' using errcode = '22023'; end if;
  if jsonb_array_length(p_rows) > 400 or (p_state <> 'ok' and jsonb_array_length(p_rows) <> 0) then
    raise exception 'import_too_large' using errcode = '22023';
  end if;
  if p_state = 'ok' then
    for candidate in select value from jsonb_array_elements(p_rows) loop
      if coalesce(candidate->>'externalId', '') !~ '^[a-zA-Z0-9_-]{1,100}$'
        or coalesce(length(candidate->>'fingerprint'), 0) not between 1 and 250
        or not private.discovery_payload_ok(s.market, candidate->'item'->>'id', candidate->'item') then
        raise exception 'invalid_discovery_candidate' using errcode = '22023';
      end if;
      insert into private.discovery_candidates(source, external_id, fingerprint, payload)
        values (p_source, candidate->>'externalId', candidate->>'fingerprint', candidate->'item')
      on conflict (source, external_id) do update set fingerprint = excluded.fingerprint, payload = excluded.payload,
        state = 'pending_review', updated_at = now()
      where private.discovery_candidates.fingerprint is distinct from excluded.fingerprint
        or private.discovery_candidates.payload - 'sources' is distinct from excluded.payload - 'sources';
      if found then v_count := v_count + 1; end if;
    end loop;
  end if;
  update private.discovery_sources set lease = null, lease_until = null,
    source_url = case when p_state <> 'failed' then p_checkpoint->>'url' else source_url end,
    etag = case when p_state <> 'failed' then p_checkpoint->>'etag' else etag end,
    modified = case when p_state <> 'failed' then p_checkpoint->>'modified' else modified end,
    payload_hash = case when p_state <> 'failed' then p_checkpoint->>'hash' else payload_hash end,
    last_success_at = case when p_state <> 'failed' then now() else last_success_at end
  where id = p_source;
  update private.discovery_import_runs set state = p_state, ended_at = now(), metrics = p_metrics || jsonb_build_object('changed', v_count), error_code = p_error
    where id = p_lease;
  return v_count;
end $$;

revoke all on function private.discovery_payload_ok(text,text,jsonb),
  private.discovery_write(text,text,jsonb,text,bigint,text,uuid,boolean) from public, anon, authenticated;
revoke all on function public.discovery_feed_v1(text,text,bigint), public.admin_discovery_write_v1(text,text,jsonb,text,bigint,text),
  public.admin_discovery_queue_v1(text,text,text), public.admin_discovery_review_v1(text,text,text,timestamptz,text,text),
  public.service_discovery_seed_v1(text,jsonb,text), public.service_discovery_begin_v1(text),
  public.service_discovery_finish_v1(text,uuid,text,jsonb,jsonb,jsonb,text) from public, anon, authenticated;
grant execute on function public.discovery_feed_v1(text,text,bigint) to authenticated;
grant execute on function public.admin_discovery_write_v1(text,text,jsonb,text,bigint,text), public.admin_discovery_queue_v1(text,text,text),
  public.admin_discovery_review_v1(text,text,text,timestamptz,text,text) to authenticated;
grant execute on function public.service_discovery_seed_v1(text,jsonb,text), public.service_discovery_begin_v1(text),
  public.service_discovery_finish_v1(text,uuid,text,jsonb,jsonb,jsonb,text) to service_role;
