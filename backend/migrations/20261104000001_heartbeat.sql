-- is the org working? a row, not a question about whose terminal is open.
create table if not exists runner_heartbeat (
  id text primary key,
  at timestamptz not null default now(),
  state text not null,
  detail text not null,
  cycles bigint not null default 0
);
