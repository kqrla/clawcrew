-- docs/48. clawbasecamp: the surfaces a person and the seats share.
--
-- two shapes over one table: a room is a slack-like group, and `kind` says whether the
-- traffic is human-readable (group/dm) or the verbatim a2a envelope (a2a). one table so the
-- pane and the chat cannot disagree about what was said, which is the whole reason message
-- and audit logs were unified.
create table if not exists bc_room (
  id text primary key,
  kind text not null check (kind in ('group','dm','a2a')),
  name text not null,
  topic text,
  created_at timestamptz not null default now()
);

create table if not exists bc_message (
  id bigserial primary key,
  room text not null references bc_room(id),
  author text not null,
  author_kind text not null check (author_kind in ('agent','human')),
  body text not null,
  -- the a2a envelope, when there was one: task id, kind, claims, evidence refs
  envelope jsonb,
  at timestamptz not null default now()
);
create index if not exists bc_message_room_at on bc_message (room, at desc);

-- docs/49. the org chart is a board, not a document: positions are data because a person
-- drags things, and a drag is an operation with a bounded effect, never a re-render.
create table if not exists org_node (
  id text primary key,
  kind text not null check (kind in ('tier','department','bloc','wing','seat')),
  label text not null,
  parent text references org_node(id),
  x numeric not null default 0,
  y numeric not null default 0,
  board text not null default 'org',
  updated_at timestamptz not null default now()
);

insert into bc_room (id, kind, name, topic) values
  ('general', 'group', 'general', 'where a person talks to the org'),
  ('a2a', 'a2a', 'inter-agent', 'verbatim envelopes: task, kind, claims, evidence')
on conflict (id) do nothing;
