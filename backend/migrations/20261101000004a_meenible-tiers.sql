-- docs/45. a clean replay died here: the objectives below are owned by tiers that were
-- not seeded until the next file, which never mattered on the database these migrations
-- grew up on, because the tiers already existed there. a self-hosted deploy starts from
-- an empty volume every time, so the dependency gets ordered instead of assumed.
--
-- numbered 000004a rather than editing 000005: a new file applies anywhere, an edited file
-- is a different file under the same name, and the ledger stores hashes for exactly that
-- reason. the rehash path for genuine edits is in docs/45, and this is not one.
insert into tier (id, label, ceiling, budget, state)
select distinct o.owner_tier, o.owner_tier, '{}'::jsonb, '{}'::jsonb, 'active'
  from objective o
 where o.owner_tier is not null
on conflict (id) do nothing;
