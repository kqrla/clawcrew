-- docs/45. the chain assumed a project that was made by hand: 000005 copies
-- 'test-01.figures', its slices and its phase log into meenible, then deletes the original.
-- on an empty volume there was nothing to copy, so meenible ended up with no slices, no slice
-- tiers, and objectives pointing at tiers that could not exist.
--
-- seeding the origin here is the honest repair: 000005's intent was always "rename the
-- existing business", and this is the existence it was written against.
insert into project (id, name, phase, objective_id, unit_cost_ceiling_usd, kill_criteria)
values ('test-01.figures', 'figures: custom collector figures, B2C', 'operate', 'obj.figures.revenue',
        2.50, array['a month of no paid orders', 'unit cost above the ceiling for two weeks'])
on conflict (id) do nothing;

insert into project_slice (project_id, slice, ontology_version, objective_id)
select 'test-01.figures', s, 1, 'obj.figures.' || split_part(s, '.', 1)
  from unnest(array[
    'code.repo', 'design.studio', 'research.analysis', 'security.controls',
    'financials.rails', 'media.studio', 'support.inbox', 'accounting.books',
    'operations.runtime', 'documentation.site'
  ]) as s
on conflict do nothing;

insert into project_phase_log (project_id, from_phase, to_phase, at, checks, actor)
values ('test-01.figures', 'inception', 'operate', now(), '{}'::jsonb, 'migration')
on conflict do nothing;
