-- docs/49. an undo needs where things were, and "subtract the delta" is a guess that breaks
-- the first time two ops overlap. store the before.
alter table org_board_op add column if not exists before jsonb not null default '[]'::jsonb;
