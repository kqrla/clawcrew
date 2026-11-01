-- orchart schema v0.1
-- postgres is the coordination store AND the event log. git holds exports, not writes.
-- rationale: leases, handoffs and surface locks need atomic multi-row transitions,
-- and a filesystem cannot join a transaction. see docs/12-runtime.md.


-- ===== org =====
create table if not exists tier (
  id            text primary key,
  parent        text references tier(id),
  label         text not null default 'team',
  manager_seat  text,
  ceiling       jsonb not null,          -- {tools: [], spend_usd_per_day: n}
  budget        jsonb not null default '{}'::jsonb,
  state         text not null default 'active' check (state in ('active','frozen','burned')),
  created_at    timestamptz not null default now(),
  constraint no_self_parent check (parent is null or parent <> id)
);

create table if not exists seat (
  id            text primary key,
  title         text not null,
  home_tier   text not null references tier(id),
  grants        jsonb not null,
  model         jsonb not null default '{}'::jsonb,
  state         text not null default 'active' check (state in ('active','frozen','burned'))
);

create table if not exists surface (
  id            text primary key,
  kind          text not null,
  owner_tier  text not null references tier(id),
  sensitivity   text not null check (sensitivity in ('public','internal','sensitive')),
  approval_class text not null default 'a1',
  partition_key text
);
-- invariant 4: exactly one owner. the primary key is the surface id, so a second
-- registration of the same surface is impossible rather than merely discouraged.

create table if not exists authority_grant (
  id            text primary key,
  subject       text not null,           -- seat:<id> or tier:<id>
  tool          text not null,
  scope         jsonb not null default '{}'::jsonb,
  limits        jsonb not null default '{}'::jsonb,
  issued_by     text not null,
  reason        text not null,
  issued_at     timestamptz not null default now(),
  expires_at    timestamptz not null
);

create table if not exists elevation (
  id            text primary key,
  issuer        text not null,
  target        text not null,
  adds          text[] not null,
  reason        text not null,
  time_window   jsonb,
  max_uses      int not null,
  used          int not null default 0,
  expires_at    timestamptz not null,
  requires      text not null default 'a1'
);

create table if not exists secondment (
  id                text primary key,
  seat              text not null references seat(id),
  home_tier       text not null references tier(id),
  host_tier       text not null references tier(id),
  deliverable       text not null,
  scope             jsonb not null,
  requested_by      text not null,
  authorized_by     text,
  state             text not null default 'requested'
                    check (state in ('requested','active','expired','revoked','rejected')),
  issued_at         timestamptz not null default now(),
  expires_at        timestamptz not null
);

-- note: `grant` and `window` are reserved words in postgres. the columns and
-- tables below use authority_grant and time_window so the schema stays unquoted.

-- ===== objectives =====
create table if not exists objective (
  id            text not null,
  version       int not null default 1,
  parent        text,
  owner_tier  text not null references tier(id),
  statement     text not null,
  metric        text not null,
  source        text not null,
  baseline      numeric not null,
  target        numeric not null,
  deadline      date not null,
  status        text not null default 'active'
                check (status in ('active','met','failed','retired','superseded')),
  self_reported boolean not null default false,
  amended_at    timestamptz,
  retired_reason text,
  primary key (id, version),
  constraint source_executable check (source ~ '^(sql|http|git|run):.+'),
  constraint target_differs check (target <> baseline)
);

create table if not exists evidence (
  id            bigserial primary key,
  objective     text not null,
  kind          text not null,
  source        text not null,
  value         numeric not null,
  computed_at   timestamptz not null,
  run_by        text not null,
  artifact      text
);

create table if not exists task (
  id            text primary key,
  objective_id  text,
  owner_tier  text not null references tier(id),
  state         text not null default 'open'
                check (state in ('open','in_progress','done','blocked','partial')),
  cost_usd      numeric not null default 0,
  completed_at  timestamptz,
  created_at    timestamptz not null default now()
);
create index if not exists task_no_objective on task (owner_tier) where objective_id is null;

-- ===== coordination =====
create table if not exists lease (
  id             text primary key,
  tier         text not null references tier(id),
  responsibility text not null,
  holder         text not null references seat(id),
  acquired_at    timestamptz not null,
  expires_at     timestamptz not null,
  heartbeat_ms   int not null,
  renewals       int not null default 0,
  max_renewals   int not null default 2,
  state          text not null default 'held'
                 check (state in ('held','released','expired','revoked')),
  last_heartbeat timestamptz not null
);
-- one live holder per responsibility, enforced by the database rather than by hope
create unique index if not exists lease_one_holder
  on lease (tier, responsibility) where state = 'held';

create table if not exists handoff (
  id                  text primary key,
  from_seat           text not null,
  to_seat             text not null,
  precondition        text not null,
  payload_ref         text not null,
  acceptance_required boolean not null default true,
  timeout_ms          int not null,
  offered_at          timestamptz not null,
  state               text not null default 'offered'
                      check (state in ('offered','accepted','rejected','expired','undelivered')),
  rejection_reason    text,
  constraint payload_is_reference check (payload_ref ~ '^(artifact|repo|db|doc|url)://.+')
);

create table if not exists decision (
  id             text primary key,
  channel        text not null,
  question       text not null,
  options        jsonb not null,
  votes          jsonb not null default '[]'::jsonb,
  dissent        jsonb not null default '[]'::jsonb,
  evidence       jsonb not null default '[]'::jsonb,
  authority_basis text not null,
  approver       text not null,
  decided_at     timestamptz not null default now()
);

-- ===== event log =====
create table if not exists event (
  stream    text not null,
  seq       bigint not null,
  id        text not null unique,
  at        timestamptz not null,
  payload   jsonb not null,
  prev_hash text not null,
  hash      text not null,
  primary key (stream, seq)
);
create index if not exists event_at on event (at desc);

-- append-only, enforced by the database. corrections are new events.
create or replace function event_immutable() returns trigger as $$
begin
  raise exception 'event log is append-only (% blocked)', tg_op;
end;
$$ language plpgsql;

drop trigger if exists event_no_update on event;
create trigger event_no_update before update or delete on event
  for each row execute function event_immutable();

-- ===== projections =====
-- effective permissions are computed in code (src/domain/authority.ts), not stored,
-- because storing them means every reparent has to update every descendant.
create or replace view tier_chain as
with recursive walk as (
  select id, parent, id as descendant, 0 as depth
  from tier
  union all
  select c.id, c.parent, w.descendant, w.depth + 1
  from tier c
  join walk w on c.id = w.parent
)
select descendant, id as ancestor, depth from walk order by descendant, depth desc;
