-- docs/32. a metric computed by one expression is self-reporting one level down:
-- the same org writes the gauge and reads it. corroboration is the cheapest
-- independent check available, because it needs no second team, only a second way
-- to ask the same question.

alter table objective add column if not exists crosscheck_source text;

alter table objective drop constraint if exists objective_crosscheck_executable;
alter table objective add constraint objective_crosscheck_executable
  check (crosscheck_source is null or crosscheck_source ~ '^(sql|http|git|run):.+');

-- which expression produced a reading. a crosscheck may not stand in for a primary
alter table metric_reading add column if not exists role text not null default 'primary';

alter table metric_reading drop constraint if exists metric_reading_role_check;
alter table metric_reading add constraint metric_reading_role_check
  check (role in ('primary', 'crosscheck'));

create index if not exists metric_reading_by_role on metric_reading (objective_id, role);

-- objectives that never intended to ask twice. at inception this is a refusal,
-- not a warning: a number nobody can check is a claim with a decimal point.
create or replace view uncorroborated_objectives as
select o.id as objective_id, o.source, o.crosscheck_source, o.owner_tier
  from objective o
 where o.crosscheck_source is null
    or lower(regexp_replace(trim(o.crosscheck_source), '\s+', ' ', 'g'))
     = lower(regexp_replace(trim(o.source), '\s+', ' ', 'g'));

-- the latest primary and crosscheck that disagree by more than 5%. the tolerance
-- is fixed here for legibility; the engine reads it per project (docs/32).
create or replace view disputed_metrics as
with latest as (
  select objective_id, objective_version, role, value, run_by, computed_at, ok,
         row_number() over (
           partition by objective_id, objective_version, role order by computed_at desc
         ) as rn
    from metric_reading
)
select p.objective_id,
       p.value as primary_value,
       c.value as crosscheck_value,
       round(abs(p.value - c.value) / greatest(abs(p.value), abs(c.value), 1e-9), 4) as spread,
       p.run_by as primary_by,
       c.run_by as crosscheck_by,
       greatest(p.computed_at, c.computed_at) as as_of
  from latest p
  join latest c
    on c.objective_id = p.objective_id
   and c.objective_version = p.objective_version
   and c.role = 'crosscheck' and c.rn = 1
 where p.role = 'primary' and p.rn = 1
   and p.ok and c.ok
   and p.run_by <> c.run_by
   and abs(p.value - c.value) / greatest(abs(p.value), abs(c.value), 1e-9) > 0.05;
