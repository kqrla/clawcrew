-- docs/31: a source is not a metric until somebody other than the tier being
-- measured has run it and the number was recorded. `source_executable` proved the
-- expression could run; this table is the proof that it did.

create table if not exists metric_reading (
  id                bigserial primary key,
  project_id        text,
  objective_id      text not null,
  objective_version int not null default 1,
  -- the source string that was actually executed, so a changed metric cannot
  -- inherit the credibility of an older reading
  source            text not null,
  value             numeric,
  ok                boolean not null,
  detail            text,
  computed_at       timestamptz not null default now(),
  run_by            text not null,
  constraint reading_has_value_when_ok check (ok = false or value is not null),
  constraint reading_run_by_is_named check (length(trim(run_by)) > 0)
);

create index if not exists metric_reading_by_objective
  on metric_reading (objective_id, objective_version, computed_at desc);

create index if not exists metric_reading_failures
  on metric_reading (objective_id) where ok = false;

-- the org's first work queue: objectives a project depends on whose gauge has
-- never produced a fresh number. empty means the ledger is actually instrumented.
create or replace view unverified_metrics as
select
  ps.project_id,
  o.id            as objective_id,
  o.version       as objective_version,
  o.source,
  (select r.detail from metric_reading r
    where r.objective_id = o.id and r.objective_version = o.version
    order by r.computed_at desc limit 1) as last_detail
from project_slice ps
join objective o on o.id = ps.objective_id and o.version = 1
where not exists (
  select 1 from metric_reading r
   where r.objective_id = o.id
     and r.objective_version = o.version
     and r.ok
     and r.computed_at > now() - interval '24 hours'
);

-- what each gauge last said when it failed, without reading the whole log
create or replace view gauge_failures as
select distinct on (objective_id)
  objective_id, objective_version, source, detail, computed_at, run_by
from metric_reading
where ok = false
order by objective_id, computed_at desc;
