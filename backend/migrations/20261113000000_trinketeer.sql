-- docs/54. the company is trinketeer. meenible was never the company: it was the first product
-- line, which is why it kept needing qualifiers ("custom collector figures, B2C") to sound like a
-- business. below it sits the catalog the work is actually about.
--
-- the ledger stays append-only: meenible's objectives are copied under the new prefix and the old
-- names are retired with a reason, never edited. a version that changes meaning is a lie about
-- every row that cited it.

-- 1. the business row
insert into project (id, name, phase, objective_id, unit_cost_ceiling_usd, kill_criteria, started_at, phase_started_at)
select 'trinketeer',
       'trinketeer: printed collectibles and small trinkets',
       phase,
       'obj.trinketeer.meeniable.revenue',
       unit_cost_ceiling_usd,
       kill_criteria,
       started_at,
       phase_started_at
  from project where id = 'meenible'
on conflict (id) do nothing;

update project_slice      set project_id = 'trinketeer' where project_id = 'meenible';
update project_phase_log  set project_id = 'trinketeer' where project_id = 'meenible';
update task               set project_id = 'trinketeer' where project_id = 'meenible';
update audit_run          set project_id = 'trinketeer' where project_id = 'meenible';

-- 2. objectives move under the product line, by copy
insert into objective (id, version, parent, owner_tier, statement, metric, source, baseline, target, deadline, status, self_reported)
select replace(o.id, 'obj.meenible', 'obj.trinketeer.meeniable'),
       o.version,
       case when o.parent is null then null else replace(o.parent, 'obj.meenible', 'obj.trinketeer.meeniable') end,
       o.owner_tier, o.statement, o.metric, o.source, o.baseline, o.target, o.deadline, o.status, o.self_reported
  from objective o
 where o.id like 'obj.meenible%'
on conflict (id, version) do nothing;

update task set objective_id = replace(objective_id, 'obj.meenible', 'obj.trinketeer.meeniable')
 where objective_id like 'obj.meenible%';

update objective
   set status = 'retired',
       retired_reason = 'renamed: the company is trinketeer, and meenible is its first product line'
 where id like 'obj.meenible%'
   and status <> 'retired';

-- 3. the old business row: its history is repointed, so the row itself is a duplicate name
delete from project where id = 'meenible' and not exists (select 1 from task where project_id = 'meenible');

-- 4. the catalog: product lines nest, because a line can contain lines
create table if not exists product_line (
  id text primary key,
  project_id text not null references project(id),
  parent text references product_line(id),
  name text not null,
  status text not null default 'planned' check (status in ('planned','prototype','live','retired')),
  brief text,
  created_at timestamptz not null default now()
);

insert into product_line (id, project_id, parent, name, status, brief) values
  ('trinketeer.meeniable', 'trinketeer', null, 'meeniable', 'live',
   'custom collector figures: the first line, v1 shipped'),
  ('trinketeer.miniroomie', 'trinketeer', null, 'miniroomie', 'planned',
   'printed diorama miniatures: rooms in a box'),
  ('trinketeer.meenicals', 'trinketeer', null, 'meenicals', 'planned',
   'props and trinkets: the small stuff that sells on its own')
on conflict (id) do nothing;

insert into product_line (id, project_id, parent, name, status, brief) values
  ('trinketeer.meeniable.funko-pops', 'trinketeer', 'trinketeer.meeniable', 'funko-pops', 'live',
   'v1: the line everything so far was built for'),
  ('trinketeer.meeniable.bondee-dolls', 'trinketeer', 'trinketeer.meeniable', 'bondee-dolls', 'planned',
   'soft-proportioned dolls'),
  ('trinketeer.meeniable.block-type', 'trinketeer', 'trinketeer.meeniable', 'block-type', 'planned',
   'minecraft-blocky dolls'),
  ('trinketeer.meeniable.mino-girl', 'trinketeer', 'trinketeer.meeniable', 'mino-girl', 'planned',
   'the fourth style in the meeniable family')
on conflict (id) do nothing;
