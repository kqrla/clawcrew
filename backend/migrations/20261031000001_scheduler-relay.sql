-- orchart schema v0.2: scheduler, relay queue, compiled crossings.
-- see docs/21 (scheduler), docs/22 (relay logic), docs/23 (permeability).

-- ===== scheduler =====
create table if not exists schedule (
  id             text primary key,
  kind           text not null,
  ref            text not null,
  tier           text not null,
  every_seconds  integer not null check (every_seconds > 0),
  priority       text not null default 'normal',
  catch_up       text not null default 'skip',
  enabled        boolean not null default true,
  next_due_at    timestamptz not null,
  last_fired_at  timestamptz,
  last_fire_key  text,
  unique (kind, ref)
);

-- due work is found by this index alone; a scan here is a scheduler that storms
create index if not exists schedule_due
  on schedule (next_due_at) where enabled;

-- ===== wakes =====
-- a tick never executes work. it records that a tier should wake, and a worker
-- claims it. keeping wakes in their own table makes "what fired" answerable.
create table if not exists wake (
  id          bigserial primary key,
  kind        text not null,
  ref         text not null,
  tier        text not null,
  fired_at    timestamptz not null,
  claimed_at  timestamptz,
  claimed_by  text
);

create index if not exists wake_open on wake (fired_at) where claimed_at is null;

-- ===== relay =====
create table if not exists relay_message (
  id              text primary key,
  from_tier       text not null,
  to_tier         text not null,
  crossing        text not null,
  kind            text not null,
  dedupe_key      text not null,
  payload_ref     text not null,
  seq             bigint not null,
  priority        text not null default 'normal',
  state           text not null default 'queued',
  attempts        integer not null default 0,
  max_attempts    integer not null default 8,
  created_at      timestamptz not null,
  expires_at      timestamptz not null,
  next_attempt_at timestamptz not null,
  locked_until    timestamptz,
  holder          text,
  path            text[] not null default '{}',
  acked_at        timestamptz,
  dead_reason     text,
  -- an envelope carries a reference, never prose. see docs/22 §9
  constraint relay_payload_is_a_ref
    check (payload_ref ~ '^(artifact|state|issue|bookmark)://')
);

-- at-least-once delivery relies entirely on this
create unique index if not exists relay_dedupe on relay_message (dedupe_key);
create index if not exists relay_ready
  on relay_message (next_attempt_at) where state = 'queued';
create index if not exists relay_leased
  on relay_message (locked_until) where state = 'leased';

-- ===== crossings (compiled) =====
create table if not exists crossing (
  id             text primary key,
  from_tier      text not null,
  to_tier        text not null,
  kinds          text[] not null,
  max_per_hour   integer not null check (max_per_hour > 0),
  max_bytes      bigint,
  expires_at     timestamptz not null,
  authorized_by  text not null,
  reason         text not null,
  revoke_mode    text not null default 'drain',
  enabled        boolean not null default true,
  config_hash    text not null,
  -- token bucket state, so a restart does not refill every door
  tokens         double precision,
  last_refill_at timestamptz
);

create index if not exists crossing_lookup on crossing (from_tier, to_tier);

-- ===== ticker health =====
-- a scheduler is healthy when its lag is small, not when its process is alive
create table if not exists ticker_heartbeat (
  id          boolean primary key default true check (id),
  at          timestamptz not null,
  tick_count  bigint not null,
  lag_ms      bigint not null
);
