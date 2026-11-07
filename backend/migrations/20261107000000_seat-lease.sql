-- docs/51. an assignment is a lease with an expiry, not a row saying someone is "on" it: a
-- seat that dies mid-task must release the work by itself, without a person noticing.
create table if not exists seat_lease (
  id bigserial primary key,
  task_id text not null,
  seat text not null,
  kind text not null,
  acquired_at timestamptz not null default now(),
  expires_at timestamptz not null,
  released_at timestamptz
);
create index if not exists seat_lease_live on seat_lease (task_id) where released_at is null;

create table if not exists seat_shift (
  seat text primary key,
  slice text not null,
  on_call boolean not null default true,
  updated_at timestamptz not null default now()
);
