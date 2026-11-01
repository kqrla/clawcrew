-- docs/30. a project is the factory's unit of business, and the thing that has to
-- survive thirty days unattended. work items are hours; a project is months.

create table project (
  id                      text primary key,
  name                    text not null,
  phase                   text not null default 'inception',
  -- the ledger keys objectives by (id, version), so this is a reference held as
  -- text on purpose: a project pins the objective version it was started against,
  -- and the ledger is append-only, so the string is the durable name.
  objective_id            text not null,
  started_at              timestamptz not null default now(),
  phase_started_at        timestamptz not null default now(),
  unit_cost_ceiling_usd   numeric(10,2) not null,
  kill_criteria           text[] not null,
  constraint project_phase_known check (phase in (
    'inception','build','assemble','launch','operate','review','closed','killed'
  )),
  -- a business that cannot say what would make it stop is not allowed to start
  constraint project_has_kill_criteria check (cardinality(kill_criteria) >= 1),
  constraint project_has_ceiling check (unit_cost_ceiling_usd > 0)
);

create table project_slice (
  project_id       text not null references project(id) on delete cascade,
  slice            text not null,
  ontology_version int not null,
  objective_id     text not null,
  primary key (project_id, slice)
);

-- every phase move is a row with the evidence that allowed it. this is the part a
-- human reads when asking "why is this still running".
create table project_phase_log (
  id          bigserial primary key,
  project_id  text not null references project(id) on delete cascade,
  from_phase  text,
  to_phase    text not null,
  at          timestamptz not null default now(),
  checks      jsonb not null default '{}'::jsonb,
  actor       text not null
);

create index project_phase_log_project_idx on project_phase_log (project_id, at desc);

alter table task add column if not exists project_id text references project(id);
create index if not exists task_project_idx on task (project_id) where project_id is not null;

-- a project may only name slices whose ontology has actually been published at
-- the version it claims, otherwise its whole vocabulary is a guess.
create or replace view project_slice_unbacked as
select ps.project_id, ps.slice, ps.ontology_version
  from project_slice ps
 where not exists (
   select 1 from slice_ontology o
    where o.slice = ps.slice
      and o.version = ps.ontology_version
      and o.status = 'active'
 );

-- the build gate, as SQL: which slices of a live project have never shipped
-- anything backed by a reference.
create or replace view project_slices_without_done_work as
select ps.project_id, p.phase, ps.slice
  from project_slice ps
  join project p on p.id = ps.project_id
 where p.phase in ('build','assemble','launch','operate','review')
   and not exists (
     select 1
       from task t
      where t.project_id = ps.project_id
        and t.state = 'done'
        and t.evidence_ref is not null
        and ps.slice = any (t.surfaces)
   );

-- the assemble gate has a money floor and a legal floor, and neither is a judgement call
create or replace view project_launch_risk as
select id, name, phase, unit_cost_ceiling_usd,
       case
         when phase not in ('assemble','launch') then 'not_yet'
         when unit_cost_ceiling_usd is null then 'no_ceiling'
         else 'ceiling_declared'
       end as cost_posture
  from project
 where phase in ('assemble','launch','operate');
