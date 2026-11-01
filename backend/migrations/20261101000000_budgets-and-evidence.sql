-- docs/27 §9. three things were stored and not enforced, and one control was
-- self-certified: budgets nobody read, briefs with no revision, and a progress
-- counter that a seat reset for itself.

-- 1. the brief is a record, not a paragraph in a prompt.
alter table task add column if not exists brief text;
alter table task add column if not exists objective_version integer;
alter table task add column if not exists replanned_by text;
alter table task add column if not exists replanned_at timestamptz;

-- 2. progress now carries the objective's own measurement.
alter table task add column if not exists metric_value_at numeric;
alter table task add column if not exists metric_observed_at timestamptz;

-- a number with no observation time cannot be judged fresh, and a time with no
-- number cannot be judged moved. they are one fact in two columns.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'task_metric_paired') then
    alter table task add constraint task_metric_paired check (
      (metric_value_at is null) = (metric_observed_at is null)
    );
  end if;
end $$;

-- 3. replay guard on claim: the same request delivered twice is the same claim.
alter table task add column if not exists claim_key text;
alter table task add column if not exists input_fingerprint text;
alter table task add column if not exists last_claim_at timestamptz;

-- 4. budgets become a policy plus a reservation, per docs/27 §9a. `tier.budget`
--    stays as the seed value an operator writes; the reservation is what spends.
create table if not exists budget_policy (
  id            text primary key,
  scope         text not null check (scope in ('tier', 'objective', 'seat')),
  scope_id      text not null,
  metric        text not null check (metric in ('usd_cents', 'tokens', 'tool_calls')),
  window_kind   text not null check (window_kind in ('day', 'month', 'once')),
  amount        numeric not null check (amount >= 0),
  warn_percent  numeric not null default 0.8
                  check (warn_percent >= 0 and warn_percent <= 1),
  hard_stop     boolean not null default true,
  created_at    timestamptz not null default now()
);

create unique index if not exists budget_policy_scope
  on budget_policy (scope, scope_id, metric, window_kind);

create table if not exists budget_reservation (
  id             text primary key,
  policy_id      text not null references budget_policy (id) on delete cascade,
  agent_id       text not null,
  run_ref        text not null,
  -- the hold. settled_amount is what actually left, and an overrun is recorded
  -- rather than refused, because the spend already happened.
  amount         numeric not null check (amount > 0),
  settled_amount numeric check (settled_amount is null or settled_amount >= 0),
  state          text not null default 'held'
                   check (state in ('held', 'settled', 'released')),
  started_at     timestamptz not null default now(),
  settled_at     timestamptz,
  -- a settled reservation must say what it settled for and when
  constraint budget_reservation_settled_complete check (
    state <> 'settled' or (settled_amount is not null and settled_at is not null)
  )
);

create index if not exists budget_reservation_open
  on budget_reservation (policy_id, state)
  where state = 'held';

-- a deleted policy must not silently free its spent money
create index if not exists budget_reservation_by_run on budget_reservation (run_ref);
