-- 0002 — Données utilisateur (schéma public, protégé par RLS en 0004).
-- Horodatages en UTC, unités SI (mètres, secondes, secondes/km).

create table public.profiles (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  display_name text check (char_length(display_name) between 1 and 50),
  country_code text check (country_code ~ '^[A-Z]{2}$'),
  city         text check (char_length(city) between 1 and 80),
  age_band     text check (age_band in ('16-24','25-34','35-44','45-54','55+')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
comment on table public.profiles is 'Profil de compte minimal (§6.5). Tous les champs sont facultatifs. La forme normalisée du nom, utilisée par la recherche admin, vit dans private.user_directory.';

create table public.user_preferences (
  user_id           uuid primary key references auth.users(id) on delete cascade,
  data              jsonb not null default '{}'::jsonb check (jsonb_typeof(data) = 'object' and octet_length(data::text) <= 65536),
  schema_version    int not null default 1 check (schema_version between 1 and 100),
  client_updated_at timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
comment on table public.user_preferences is 'Réglages portables uniquement (§7.5), dernier écrit gagne.';

create table public.consent_log (
  id              bigint generated always as identity primary key,
  user_id         uuid not null references auth.users(id) on delete cascade,
  purpose         text not null check (purpose in ('terms','privacy_policy','cloud_sync_runs','cloud_sync_routes','community_leaderboard')),
  version         text not null check (char_length(version) between 1 and 20),
  granted         boolean not null,
  client_event_id uuid not null,
  client_at       timestamptz not null,
  created_at      timestamptz not null default now(),
  unique (user_id, client_event_id)
);
comment on table public.consent_log is 'Journal append-only des choix et acceptations (§6.5). Rejouer un même événement ne crée qu''une entrée.';
create index consent_log_current_idx on public.consent_log (user_id, purpose, client_at desc, id desc);

create table public.runs (
  user_id           uuid not null references auth.users(id) on delete cascade,
  id                text not null check (char_length(id) between 1 and 100),
  source            text not null default 'sprinter' check (source in ('sprinter','healthkit','gpx')),
  started_at        timestamptz not null,
  ended_at          timestamptz,
  tz                text check (char_length(tz) <= 64),
  active_s          integer not null check (active_s >= 0),
  total_s           integer check (total_s >= 0),
  distance_m        numeric(10,1) not null check (distance_m >= 0),
  reliable_s        integer check (reliable_s >= 0),
  best_pace_s_km    numeric(7,2) check (best_pace_s_km > 0),
  ascent_m          numeric(7,1) check (ascent_m >= 0),
  session_type      text check (char_length(session_type) <= 40),
  platform          text check (platform in ('ios','android')),
  app_version       text check (char_length(app_version) <= 32),
  best_efforts      jsonb check (best_efforts is null or jsonb_typeof(best_efforts) = 'object'),
  payload           jsonb not null check (jsonb_typeof(payload) = 'object' and octet_length(payload::text) <= 524288 and not (payload ? 'points')),
  has_route         boolean not null default false,
  validity          text not null default 'valid' check (validity in ('valid','suspect','invalid')),
  validity_reasons  text[] not null default '{}',
  rules_version     int not null default 1,
  client_updated_at timestamptz not null,
  server_updated_at timestamptz not null default now(),
  created_at        timestamptz not null default now(),
  deleted_at        timestamptz,
  primary key (user_id, id)
);
comment on table public.runs is 'Courses synchronisées, sans points GPS (§5.2). Écritures uniquement par RPC sync_push_* (§2 décision 8).';
create index runs_user_started_idx on public.runs (user_id, started_at desc) where deleted_at is null;
create index runs_sync_idx on public.runs (user_id, server_updated_at, id);
create index runs_started_idx on public.runs (started_at) where deleted_at is null;

create table public.run_routes (
  user_id          uuid not null,
  run_id           text not null,
  storage_path     text not null check (char_length(storage_path) <= 300),
  points_count     integer not null check (points_count >= 0),
  bytes            integer not null check (bytes > 0 and bytes <= 8388608),
  preview_polyline text check (char_length(preview_polyline) <= 20000),
  created_at       timestamptz not null default now(),
  primary key (user_id, run_id),
  foreign key (user_id, run_id) references public.runs(user_id, id) on delete cascade
);
comment on table public.run_routes is 'Références des tracés stockés dans le bucket privé run-tracks (§8). Le serveur ne lit jamais leur contenu.';

create table public.user_devices (
  user_id              uuid not null references auth.users(id) on delete cascade,
  device_id            uuid not null,
  platform             text not null check (platform in ('ios','android')),
  os_version           text check (char_length(os_version) <= 32),
  app_version          text check (char_length(app_version) <= 32),
  last_seen_at         timestamptz not null default now(),
  last_sync_at         timestamptz,
  last_sync_status     text check (last_sync_status in ('ok','partial','error')),
  last_sync_error_code text check (last_sync_error_code ~ '^[a-z0-9_.:-]{1,64}$'),
  created_at           timestamptz not null default now(),
  primary key (user_id, device_id)
);

create table public.activity_days (
  user_id    uuid not null references auth.users(id) on delete cascade,
  day        date not null,
  runs_count integer not null default 0 check (runs_count >= 0),
  primary key (user_id, day)
);
comment on table public.activity_days is 'Seule mesure d''usage : une ligne par utilisateur et par jour local (§5, décision 13).';
create index activity_days_day_idx on public.activity_days (day);

create table public.app_config (
  key        text primary key check (key ~ '^[a-z][a-z0-9_]{1,62}$'),
  value      jsonb not null,
  is_public  boolean not null default true,
  updated_at timestamptz not null default now()
);
comment on table public.app_config is 'Flags et configuration lus par l''app (cache 24 h, échec ouvert). Modifiable via admin_set_config uniquement.';

create table public.support_requests (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  category      text not null check (category in ('account','sync','bug','data_request','other')),
  message       text not null check (char_length(message) between 1 and 4000),
  platform      text check (platform in ('ios','android','web')),
  app_version   text check (char_length(app_version) <= 32),
  status        text not null default 'open' check (status in ('open','in_progress','resolved','closed')),
  internal_note text check (char_length(internal_note) <= 2000),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  closed_at     timestamptz
);
create index support_requests_user_idx on public.support_requests (user_id, created_at desc);
create index support_requests_status_idx on public.support_requests (status, created_at desc);
