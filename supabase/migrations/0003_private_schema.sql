-- 0003 — Administration, état des comptes et agrégats (schéma private, jamais exposé).

create table private.admin_users (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  role       text not null check (role in ('owner','support','analyst')),
  moderation boolean not null default false,  -- habilitation de modération dédiée (§17.9)
  created_at timestamptz not null default now()
);
comment on table private.admin_users is 'Seule source du rôle administrateur. Ni user_metadata ni app_metadata ne comptent (§13.5).';

create table private.admin_audit_logs (
  id             bigint generated always as identity primary key,
  at             timestamptz not null default now(),
  admin_id       uuid,           -- sans FK : l'historique survit aux suppressions
  action         text not null check (action ~ '^[a-z_]+\.[a-z_]+$'),
  target_user_id uuid,           -- sans FK
  reason         text check (char_length(reason) <= 500),
  metadata       jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object' and octet_length(metadata::text) <= 8192)
);
comment on column private.admin_audit_logs.metadata is 'JAMAIS d''e-mail, de texte de recherche ni de jeton.';
create index admin_audit_logs_at_idx on private.admin_audit_logs (at desc, id desc);
create index admin_audit_logs_target_idx on private.admin_audit_logs (target_user_id, at desc);

create or replace function private.audit_immutable() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' and current_setting('private.purging_audit', true) = 'on' then
    return old;
  end if;
  raise exception 'admin_audit_logs is append-only' using errcode = '42501';
end $$;
revoke all on function private.audit_immutable() from public, anon, authenticated;
create trigger audit_append_only before update or delete on private.admin_audit_logs
  for each row execute function private.audit_immutable();
create trigger audit_no_truncate before truncate on private.admin_audit_logs
  for each statement execute function private.audit_immutable();

create table private.daily_metrics (
  day         date not null,
  metric      text not null,
  dim         text not null default '',
  value       numeric not null,
  computed_at timestamptz not null default now(),
  primary key (day, metric, dim)
);

-- Copie minimale pour la recherche admin et l'état du compte, alimentée par triggers (0005).
create table private.user_directory (
  user_id         uuid primary key references auth.users(id) on delete cascade,
  email_norm      text,
  display_name_norm text,          -- nom affiché sans accents ni casse (trigger sur profiles)
  providers       text[] not null default '{}',
  status          text not null default 'active' check (status in ('active','disabled','deleting')),
  status_changed_at timestamptz,
  signed_up_at    timestamptz not null,
  last_active_day date
);
comment on column private.user_directory.status is 'active : accès normal · disabled : désactivé par l''admin · deleting : suppression validée, accès retirés (§6.6).';
create index user_directory_email_trgm on private.user_directory using gin (email_norm extensions.gin_trgm_ops);
create index user_directory_name_trgm on private.user_directory using gin (display_name_norm extensions.gin_trgm_ops);
create index user_directory_email_prefix on private.user_directory (email_norm text_pattern_ops);
create index user_directory_signed_up_idx on private.user_directory (signed_up_at desc, user_id);
create index user_directory_id_prefix on private.user_directory ((replace(user_id::text, '-', '')) text_pattern_ops);
