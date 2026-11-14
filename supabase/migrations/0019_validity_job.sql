-- Recalcul par lots après évolution des règles (§9.1), repris automatiquement par pg_cron.
create or replace function private.run_rules_version() returns integer
language sql immutable set search_path = '' as $$ select 1 $$;

create index runs_rules_version_pending on public.runs (rules_version, user_id, id)
  where deleted_at is null;

create or replace function private.runs_before_write() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_check record;
begin
  if tg_op = 'UPDATE' and (new.user_id is distinct from old.user_id or new.id is distinct from old.id) then
    raise exception 'immutable_identity' using errcode = '42501';
  end if;
  new.server_updated_at := now();
  new.client_updated_at := least(new.client_updated_at, now());
  new.rules_version := private.run_rules_version();
  if new.deleted_at is not null then
    new.validity := 'invalid'; new.validity_reasons := array['deleted'];
    return new;
  end if;
  new.best_efforts := private.sanitize_best_efforts(new.best_efforts, new.distance_m, new.active_s);
  select * into v_check from private.run_validity(new.source, new.started_at, new.ended_at, new.distance_m, new.active_s, new.reliable_s);
  new.validity := v_check.validity;
  new.validity_reasons := v_check.reasons;
  if new.validity in ('valid', 'suspect') and exists (
    select 1 from public.runs o
    where o.user_id = new.user_id and o.id <> new.id and o.deleted_at is null and o.ended_at is not null and new.ended_at is not null
      and tstzrange(o.started_at, o.ended_at, '[)') && tstzrange(new.started_at, new.ended_at, '[)')
      and (o.started_at < new.started_at or (o.started_at = new.started_at and o.id < new.id))
  ) then
    new.validity := 'suspect';
    new.validity_reasons := array_append(new.validity_reasons, 'overlap');
  end if;
  return new;
end $$;

create or replace function private.recompute_validity(p_batch int default 5000) returns int
language plpgsql security definer set search_path = '' as $$
declare v_count int;
begin
  if p_batch is null or p_batch not between 1 and 5000 then
    raise exception 'invalid_parameter:batch' using errcode = '22023';
  end if;
  if not pg_try_advisory_xact_lock(hashtextextended('sprinter.recompute_validity', 0)) then return 0; end if;
  update public.runs r set rules_version = r.rules_version
  where (r.user_id, r.id) in (
    select pending.user_id, pending.id from public.runs pending
    where pending.deleted_at is null and pending.rules_version < private.run_rules_version()
    order by pending.rules_version, pending.user_id, pending.id
    limit p_batch for update skip locked
  );
  get diagnostics v_count = row_count;
  return v_count;
end $$;

revoke all on function private.run_rules_version(), private.recompute_validity(int) from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('recompute-validity', '*/15 * * * *', 'select private.recompute_validity(5000)');
  end if;
end $$;
