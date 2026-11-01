-- docs/29. a slice carries its own vocabulary; every slice carries the same
-- skeleton. the thing this fixes: every gate and every evidence scheme in the
-- schema was written for `code` and then applied to a deal, which is how a
-- commit hash ends up certifying a pipeline stage.

-- ===== the task knows what kind of work it is =====
alter table task add column if not exists kind text;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'task_kind_known') then
    alter table task add constraint task_kind_known check (
      kind is null or kind in ('code','doc','data','deal','design','research','support','ops')
    );
  end if;
end $$;

-- existing work was all code, and saying so is better than leaving it null
update task set kind = 'code' where kind is null;

-- ===== the ontology is a versioned document, never an edited one =====
create table if not exists slice_ontology (
  id            text primary key,
  slice         text not null,
  version       integer not null check (version >= 1),
  -- the whole document. classes, relations, axioms, terms, acceptance.
  doc           jsonb not null,
  -- sha256 of the canonical encoding: the thing a config diff review reads.
  -- two rows with the same hash are the same ontology.
  doc_hash      text not null,
  author        text not null,
  published_at  timestamptz not null default now(),
  -- a version is immutable once published. delete is blocked by the store; this
  -- column is what tells a reader whether the version is still in force.
  status        text not null default 'active' check (status in ('active','superseded')),
  unique (slice, version)
);

create index if not exists slice_ontology_current on slice_ontology (slice, version desc);

-- ===== growth is a proposal with provenance =====
create table if not exists ontology_proposal (
  id                text primary key,
  slice             text not null,
  ontology_version  integer not null,
  -- what the seat actually wrote. this is the most honest data the org has and
  -- it is never normalised away.
  raw               text not null,
  normalised        text not null,
  proposed_by       text not null,
  intent            text,
  candidates        text[] not null default '{}',
  state             text not null default 'open'
                      check (state in ('open','merged','rejected')),
  -- merged into this version, or rejected for this reason
  resolved_by       text,
  resolved_at       timestamptz,
  created_at        timestamptz not null default now(),
  constraint proposal_resolution_complete check (
    state = 'open' or (resolved_by is not null and resolved_at is not null)
  )
);

-- one open proposal per raw term per slice: a month of agents proposing the same
-- missing word should be one row with a count, not a month of rows
create index if not exists ontology_proposal_open
  on ontology_proposal (slice, normalised)
  where state = 'open';

-- ===== what a human reads to answer "does any of this mean anything" =====
create or replace view slice_without_ontology as
select distinct t.owner_tier, s.surface
from task t
cross join lateral unnest(t.surfaces) as s(surface)
where not exists (
  select 1 from slice_ontology o where o.slice = s.surface and o.status = 'active'
);

-- every task whose kind has no acceptance recorded in its slice's current
-- ontology. these are tasks that cannot be proven done by anyone.
create or replace view unprovable_work as
select t.id, t.owner_tier, t.kind, s.surface
from task t
cross join lateral unnest(t.surfaces) as s(surface)
join slice_ontology o
  on o.slice = s.surface and o.status = 'active'
where t.kind is not null
  and not (o.doc -> 'acceptance') ? t.kind
  and t.state in ('ready','leased','blocked');
