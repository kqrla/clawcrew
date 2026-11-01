-- meenible's objective ledger, with sources the database will accept.
--
-- `source_executable` on `objective` requires ^(sql|http|git|run):.+ and refused the
-- first attempt at this seed, which had sources like 'stripe.charges'. that
-- constraint is the whole point of the ledger and it was right: a metric whose
-- source is the name of a team is a metric nobody computes.

-- the tiers the objectives are owned by, created before anything points at them
insert into tier (id, label, ceiling, budget, state)
select distinct 't.test01.' || split_part(slice, '.', 1), slice, '{}'::jsonb, '{}'::jsonb, 'active'
  from project_slice where project_id = 'meenible'
on conflict (id) do nothing;

insert into tier (id, label, ceiling, budget, state)
values ('t.test01', 'meenible', '{}'::jsonb, '{}'::jsonb, 'active')
on conflict (id) do nothing;

insert into objective (id, version, parent, owner_tier, statement, metric, source, baseline, target, deadline, status, self_reported)
values
  ('obj.meenible.revenue', 1, null, 't.test01',
   'ship figures strangers pay for', 'paid orders',
   'http:GET https://api.stripe.com/v1/charges?status=succeeded',
   0, 25, '2026-12-01', 'active', false)
on conflict (id, version) do nothing;

insert into objective (id, version, parent, owner_tier, statement, metric, source, baseline, target, deadline, status, self_reported)
select * from (values
  ('obj.meenible.code.repo', 1, 'obj.meenible.revenue', 't.test01.code',
   'run the code slice well enough that the metric moves', 'deployed commits on main',
   'git:rev-list --count origin/main --since=7.days', 0, 5, '2026-12-01'::timestamptz, 'active', false),
  ('obj.meenible.design.studio', 1, 'obj.meenible.revenue', 't.test01.design',
   'run the design slice well enough that the metric moves', 'approved design assets in the catalog',
   'run:catalog verify --licence --hash --json', 0, 12, '2026-12-01'::timestamptz, 'active', false),
  ('obj.meenible.research.analysis', 1, 'obj.meenible.revenue', 't.test01.research',
   'run the research slice well enough that the metric moves', 'decision memos whose query reproduces',
   'run:sheet verify decisions/*.sheet --json', 0, 4, '2026-12-01'::timestamptz, 'active', false),
  ('obj.meenible.security.controls', 1, 'obj.meenible.revenue', 't.test01.security',
   'run the security slice well enough that the metric moves', 'open findings above threshold',
   'run:scan report --threshold=medium --json', 6, 0, '2026-12-01'::timestamptz, 'active', false),
  ('obj.meenible.financials.rails', 1, 'obj.meenible.revenue', 't.test01.financials',
   'run the financials slice well enough that the metric moves', 'verified payment objects',
   'http:GET https://api.stripe.com/v1/prices?active=true', 0, 3, '2026-12-01'::timestamptz, 'active', false),
  ('obj.meenible.media.studio', 1, 'obj.meenible.revenue', 't.test01.media',
   'run the media slice well enough that the metric moves', 'published assets with consent on record',
   'run:asset verify --consent --spec --json', 0, 6, '2026-12-01'::timestamptz, 'active', false),
  ('obj.meenible.operations.runtime', 1, 'obj.meenible.revenue', 't.test01.operations',
   'run the operations slice well enough that the metric moves', 'checks passing across their whole window',
   'run:check run --window=30d --json', 0, 1, '2026-12-01'::timestamptz, 'active', false),
  ('obj.meenible.accounting.books', 1, 'obj.meenible.revenue', 't.test01.accounting',
   'run the accounting slice well enough that the metric moves', 'periods reconciled with zero unmatched transactions',
   'sql:select count(*) from ledger_unmatched where period = date_trunc(''month'', now())', 0, 1, '2026-12-01'::timestamptz, 'active', false),
  ('obj.meenible.support.inbox', 1, 'obj.meenible.revenue', 't.test01.support',
   'run the support slice well enough that the metric moves', 'tickets closed by a non-author within 24h',
   'sql:select count(*) from ticket where closed_by <> opened_by and closed_at > now() - interval ''24 hours''', 0, 10, '2026-12-01'::timestamptz, 'active', false),
  ('obj.meenible.documentation.site', 1, 'obj.meenible.revenue', 't.test01.documentation',
   'run the documentation slice well enough that the metric moves', 'pages resolving with every claim sourced',
   'run:docs crawl --require-source --fail-on-404', 0, 5, '2026-12-01'::timestamptz, 'active', false)
) as v(id, version, parent, owner_tier, statement, metric, source, baseline, target, deadline, status, self_reported)
on conflict (id, version) do nothing;

-- a project whose slices point at objective rows that do not exist cannot start,
-- and this view is how that is noticed instead of assumed
create or replace view project_slice_without_objective as
select ps.project_id, ps.slice, ps.objective_id
  from project_slice ps
 where not exists (
   select 1 from objective o
    where o.id = ps.objective_id
      and o.status = 'active'
      and o.source ~ '^(sql|http|git|run):.+'
 );
