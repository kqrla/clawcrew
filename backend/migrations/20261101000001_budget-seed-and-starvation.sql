-- docs/27 §9a, the second half: the policy tables existed and the seed in
-- `tier.budget` still went unread. a limit an operator writes and the engine
-- ignores is worse than no limit, because it reads like control.

alter table task add column if not exists deferred_ticks integer not null default 0;
alter table task add column if not exists starved_at timestamptz;

-- ===== the seed becomes a policy =====
-- accepted keys, all optional, all per day: usd_cents_per_day, usd_per_day,
-- tokens_per_day, tool_calls_per_day. warn_percent and hard_stop apply to every
-- policy the tier produces. anything else in the blob is left alone: a seed is
-- a note to the operator, not a schema.

insert into budget_policy (id, scope, scope_id, metric, window_kind, amount, warn_percent, hard_stop)
select
  'bp.' || t.id || '.usd_cents.day',
  'tier', t.id, 'usd_cents', 'day',
  (t.budget ->> 'usd_cents_per_day')::numeric,
  coalesce((t.budget ->> 'warn_percent')::numeric, 0.8),
  coalesce((t.budget ->> 'hard_stop')::boolean, true)
from tier t
where jsonb_typeof(t.budget -> 'usd_cents_per_day') = 'number'
  and (t.budget ->> 'usd_cents_per_day')::numeric >= 0
on conflict (scope, scope_id, metric, window_kind) do nothing;

-- dollars written as dollars, because somebody will write them that way
insert into budget_policy (id, scope, scope_id, metric, window_kind, amount, warn_percent, hard_stop)
select
  'bp.' || t.id || '.usd_cents.day',
  'tier', t.id, 'usd_cents', 'day',
  round((t.budget ->> 'usd_per_day')::numeric * 100),
  coalesce((t.budget ->> 'warn_percent')::numeric, 0.8),
  coalesce((t.budget ->> 'hard_stop')::boolean, true)
from tier t
where jsonb_typeof(t.budget -> 'usd_per_day') = 'number'
  and (t.budget ->> 'usd_per_day')::numeric >= 0
on conflict (scope, scope_id, metric, window_kind) do nothing;

insert into budget_policy (id, scope, scope_id, metric, window_kind, amount, warn_percent, hard_stop)
select
  'bp.' || t.id || '.tokens.day',
  'tier', t.id, 'tokens', 'day',
  (t.budget ->> 'tokens_per_day')::numeric,
  coalesce((t.budget ->> 'warn_percent')::numeric, 0.8),
  coalesce((t.budget ->> 'hard_stop')::boolean, true)
from tier t
where jsonb_typeof(t.budget -> 'tokens_per_day') = 'number'
  and (t.budget ->> 'tokens_per_day')::numeric >= 0
on conflict (scope, scope_id, metric, window_kind) do nothing;

insert into budget_policy (id, scope, scope_id, metric, window_kind, amount, warn_percent, hard_stop)
select
  'bp.' || t.id || '.tool_calls.day',
  'tier', t.id, 'tool_calls', 'day',
  (t.budget ->> 'tool_calls_per_day')::numeric,
  coalesce((t.budget ->> 'warn_percent')::numeric, 0.8),
  coalesce((t.budget ->> 'hard_stop')::boolean, true)
from tier t
where jsonb_typeof(t.budget -> 'tool_calls_per_day') = 'number'
  and (t.budget ->> 'tool_calls_per_day')::numeric >= 0
on conflict (scope, scope_id, metric, window_kind) do nothing;

-- a seed that produced nothing must be visible, not silently ignored. this is
-- the query an operator runs before trusting the ledger: every tier that claims
-- a budget and has no enforced policy.
create or replace view tier_budget_gap as
select
  t.id as tier,
  t.budget,
  (t.budget = '{}'::jsonb) as seed_is_empty,
  exists (select 1 from budget_policy p where p.scope = 'tier' and p.scope_id = t.id) as enforced
from tier t
where not exists (select 1 from budget_policy p where p.scope = 'tier' and p.scope_id = t.id);

-- ===== starvation is a queryable fact, not a log line =====
create or replace view starved_work as
select
  id, owner_tier, state, deferred_ticks, starved_at, next_action_at, attempts
from task
where deferred_ticks >= 3
  and state in ('ready', 'leased', 'blocked')
order by deferred_ticks desc, next_action_at asc;
