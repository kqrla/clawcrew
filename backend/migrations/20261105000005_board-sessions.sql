-- docs/49 addendum. an actor is whoever the session says, never whoever the body claims.
create table if not exists bc_session (
  token text primary key,
  actor text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index if not exists bc_session_expiry on bc_session (expires_at);
