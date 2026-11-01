-- docs/29 revision: the slices are the org the factory actually runs.
-- design, code, research, security, financials, media, operations, accounting,
-- support, documentation. there is no crm here, and `deal` was never a kind of
-- work: money movement and bookkeeping are.

alter table task drop constraint if exists task_kind_known;

-- the two kinds that no longer exist, mapped to what they always meant
update task set kind = 'financial' where kind = 'deal';
update task set kind = 'research' where kind = 'data';

alter table task add constraint task_kind_known check (
  kind is null or kind in (
    'code','design','research','security','financial',
    'media','ops','accounting','support','doc'
  )
);

-- the first four ontologies described a business this factory does not run.
-- superseded rather than deleted: the history cites them, and a version is
-- never edited in place.
update slice_ontology
   set status = 'superseded'
 where slice in ('repo.orchart', 'crm.pipeline', 'docs.public', 'support.queue')
   and status = 'active';

-- a slice that requires a contract nobody provides cannot run, and until now
-- that was only discoverable by reading two documents side by side.
create or replace view unmet_contracts as
with current_ontologies as (
  select slice, doc from slice_ontology where status = 'active'
),
provided as (
  select o.slice, c as contract
  from current_ontologies o, lateral jsonb_array_elements_text(coalesce(o.doc -> 'provides', '[]'::jsonb)) as c
)
select
  o.slice          as needs_from,
  c                as contract
from current_ontologies o,
     lateral jsonb_array_elements_text(coalesce(o.doc -> 'requires', '[]'::jsonb)) as c
where not exists (select 1 from provided p where p.contract = c)
order by 1, 2;
