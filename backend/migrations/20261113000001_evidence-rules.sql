-- docs/55. what counts as done, per kind of work. without this, "complete" means "evidence of
-- some kind landed", which is a promise rather than a check for every kind but support.
create table if not exists evidence_rule (
  kind text primary key,
  requires text not null,
  source_pattern text not null,
  min_count integer not null default 1,
  max_age_hours integer not null default 72,
  needs_second_seat boolean not null default false
);

insert into evidence_rule (kind, requires, source_pattern, min_count, max_age_hours, needs_second_seat) values
  ('support',   'a reply, signed by a second seat',                       '^run:',        1, 72,  true),
  ('code',      'a commit and a green ci run',                            '^(git:|ci:)',  2, 72,  false),
  ('design',    'an exported asset and a review note',                    '^(asset:|review:)', 2, 168, false),
  ('research',  'a note citing at least two sources',                     '^study:',      1, 240, false),
  ('security',  'a control check that ran, not a policy that exists',     '^control:',    1, 168, true),
  ('financial', 'a settlement figure from the ledger',                    '^ledger:',     1, 48,  true),
  ('media',     'a published url and a view count',                       '^(publish:|views:)', 2, 168, false),
  ('ops',       'a run log with a start and an end',                      '^runlog:',     1, 24,  false),
  ('accounting','a reconciled statement line',                            '^recon:',      1, 720, true),
  ('doc',       'a published page that resolves',                         '^publish:',    1, 168, false)
on conflict (kind) do nothing;

-- the catalog stops being a folder that happens to match an id: each objective names its line.
-- a planned line cannot be worked on, which is the scope control the catalog needed.
alter table objective add column if not exists product_line text references product_line(id);

update objective o
   set product_line = (
     select pl.id from product_line pl
      where o.id like 'obj.' || pl.id || '%'
      order by length(pl.id) desc
      limit 1
   )
 where o.product_line is null;
