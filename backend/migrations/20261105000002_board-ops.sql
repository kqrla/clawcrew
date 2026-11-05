-- docs/49. a drag is an op, so it is a row: what moved, by whom, and what it looked like.
create table if not exists org_board_op (
  id bigserial primary key,
  board text not null default 'org',
  node text not null,
  actor text not null,
  moved jsonb not null,
  at timestamptz not null default now()
);
