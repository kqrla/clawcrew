-- the first business gets its name: meenible.
--
-- the rename is a migration rather than an edit because objectives are append-only
-- and the phase log cites them; a project id that changes silently makes every
-- historical row a lie about which business it belonged to.

insert into objective (id, version, parent, owner_tier, statement, metric, source, baseline, target, deadline, status, self_reported)
select 'obj.meenible.revenue', 1, null, 't.test01', statement, metric, source, baseline, target, deadline, status, self_reported
  from objective where id = 'obj.figures.revenue' and version = 1
on conflict (id, version) do nothing;

-- slice objectives are namespaced per project: two projects on the same slice must
-- not share one objective row, or their metrics blend.
insert into objective (id, version, parent, owner_tier, statement, metric, source, baseline, target, deadline, status, self_reported)
select 'obj.meenible.' || substring(o.id from 5), o.version,
       'obj.meenible.revenue', o.owner_tier, o.statement, o.metric, o.source, o.baseline, o.target,
       o.deadline, o.status, o.self_reported
  from objective o
 where o.parent = 'obj.figures.revenue' and o.id <> 'obj.figures.revenue'
on conflict (id, version) do nothing;

-- the old names stay in the ledger as retired, because a version is never edited
-- and a rename is a new name, not a correction of the old one.
update objective
   set status = 'retired',
       retired_reason = 'renamed: the first business is meenible'
 where (id = 'obj.figures.revenue' or parent = 'obj.figures.revenue')
   and id not like 'obj.meenible.%';

alter table task drop constraint if exists task_project_id_fkey;
update task set project_id = 'meenible' where project_id = 'test-01.figures';

alter table project_slice drop constraint if exists project_slice_project_id_fkey;
alter table project_phase_log drop constraint if exists project_phase_log_project_id_fkey;

insert into project (id, name, phase, objective_id, unit_cost_ceiling_usd, kill_criteria, started_at, phase_started_at)
select 'meenible',
       'meenible: custom collector figures, B2C',
       phase,
       'obj.meenible.revenue',
       unit_cost_ceiling_usd,
       kill_criteria,
       started_at,
       phase_started_at
  from project where id = 'test-01.figures';

insert into project_slice (project_id, slice, ontology_version, objective_id)
select 'meenible', slice, ontology_version,
       'obj.meenible.' || split_part(slice, '.', 1) || '.' || split_part(slice, '.', 2)
  from project_slice where project_id = 'test-01.figures';

insert into project_phase_log (project_id, from_phase, to_phase, at, checks, actor)
select 'meenible', from_phase, to_phase, at, checks, actor
  from project_phase_log where project_id = 'test-01.figures';

delete from project_slice where project_id = 'test-01.figures';
delete from project_phase_log where project_id = 'test-01.figures';
delete from project where id = 'test-01.figures';

-- a margin is a fact about two numbers. the price was missing from the model, so
-- every profitability claim was unfalsifiable.
alter table project add column if not exists unit_price_usd numeric(10,2);
alter table project add column if not exists min_margin_pct numeric(4,3) not null default 0.400;

alter table project drop constraint if exists project_margin_sane;
alter table project add constraint project_margin_sane
  check (min_margin_pct >= 0 and min_margin_pct < 1);

alter table project drop constraint if exists project_price_above_ceiling;
alter table project add constraint project_price_above_ceiling
  check (unit_price_usd is null or unit_price_usd > unit_cost_ceiling_usd);

-- meenible sells to collectors: a 100 mm full-colour figure, not a $20 toy.
-- the ceiling is the worst quote we would still ship at; the price is what the
-- market pays for a made-to-order collector piece.
update project
   set unit_cost_ceiling_usd = 45.00,
       unit_price_usd = 89.00,
       min_margin_pct = 0.400
 where id = 'meenible';
