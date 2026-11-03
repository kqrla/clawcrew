-- docs/33. the auditor, on a slow clock, and the alerts it raises.
--
-- corroboration reads the same number twice through the org's own machinery. this
-- table pair is the third answer: one row per objective per round, kept forever,
-- because "we checked in week three and it was wrong" is the record a stranger
-- needs when asking why a business was killed.

create table if not exists audit_run (
  id            bigserial primary key,
  project_id    text references project(id),
  started_at    timestamptz not null default now(),
  objectives    int not null,
  agrees        int not null default 0,
  disputes      int not null default 0,
  blind_spots   int not null default 0,
  unverifiable  int not null default 0
);

create table if not exists audit_finding (
  id                 bigserial primary key,
  run_id             bigint not null references audit_run(id) on delete cascade,
  objective_id       text not null,
  verdict            text not null check (verdict in ('agrees','disputes','blind_spot','unverifiable')),
  reason             text,
  primary_value      numeric,
  crosscheck_value   numeric,
  external_value     numeric,
  spread             numeric,
  unique (run_id, objective_id)
);

create index if not exists audit_finding_by_objective on audit_finding (objective_id, run_id desc);

-- an alert is open while the newest finding about an objective is not 'agrees'.
-- a later round that agrees closes it; nothing closes it by going quiet.
create or replace view open_audit_alerts as
with latest as (
  select distinct on (objective_id)
         objective_id, verdict, reason,
         primary_value, crosscheck_value, external_value, spread, run_id
    from audit_finding
   order by objective_id, run_id desc, id desc
)
select l.objective_id, l.verdict, l.reason, l.primary_value, l.crosscheck_value,
       l.external_value, l.spread, l.run_id, r.started_at, r.project_id
  from latest l
  join audit_run r on r.id = l.run_id
 where l.verdict <> 'agrees';

-- the slow clock is a schedule row like everything else, so a paused org stops
-- auditing rather than silently continuing to
insert into schedule (id, kind, ref, tier, every_seconds, priority, catch_up, enabled, next_due_at)
values ('sch.audit.weekly', 'audit', 'audit.meenible', 't.test01', 604800, 10, true, true, now() + interval '7 days')
on conflict (id) do nothing;

-- a project that has never been audited, or not in the last eight days, is not
-- being watched by anybody
create or replace view audit_overdue as
select p.id as project_id,
       (select max(r.started_at) from audit_run r where r.project_id = p.id) as last_run_at
  from project p
 where p.phase not in ('closed', 'killed')
   and (
     not exists (select 1 from audit_run r where r.project_id = p.id)
     or (select max(r.started_at) from audit_run r where r.project_id = p.id) < now() - interval '8 days'
   );
