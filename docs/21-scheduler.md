# 21 · the scheduler

the scheduler is the only thing that makes a month-long org move. if it is wrong the org either stalls silently or storms.

## 1 · no timers, only rows

every future action is a row, never an in-memory timer and never a sleep.

```
schedule (
  id              text primary key,
  kind            text not null,          -- shift | audit | recharter | skill_reverify | relay_retry
  ref             text not null,          -- tier id, objective id, skill id, message id
  tier            text not null,
  every_seconds   integer not null,
  priority        smallint not null default 5,
  catch_up        text not null default 'skip',   -- skip | coalesce | burst
  enabled         boolean not null default true,
  next_due_at     timestamptz not null,
  last_fired_at   timestamptz,
  last_fire_key   text
)
```

a process restart is therefore not an event. the next tick reads rows, not memory.

## 2 · one tick is a pure function

```
tick(now) -> due[]
```

a tick may only: select rows where `next_due_at <= now`, claim them, emit wake events, advance `next_due_at`. it never decides policy, never calls a model, never mutates a surface. decisions belong to the domain modules; the ticker only says *now*.

## 3 · idempotency

a tick must be safe to run twice, because it will be.

- the claim is `select ... for update skip locked`, so two tickers cannot take the same row.
- each firing writes `last_fire_key = kind:ref:due_at` and is ignored if already present. `due_at` is the scheduled instant, not the execution instant, so a retry at `now+3s` produces the same key and collapses.
- `next_due_at` is advanced from `due_at`, never from `now`. otherwise a slow tick drifts the whole schedule forward a little on every run.

## 4 · missed ticks

downtime is normal: a deploy, a provider outage, a laptop closed. what happens to the 72 shifts that were missed is a policy, not an accident.

| catch_up | behaviour | use for |
| --- | --- | --- |
| `skip` | jump to the next future slot, miss the rest | shifts, on-call, anything that leases a responsibility |
| `coalesce` | fire once, then jump | audits, reconciliation, digests |
| `burst` | fire every missed slot in order | almost nothing. only ordered, cheap, idempotent work |

default is `skip`. a scheduler that bursts on recovery turns a 6-hour outage into a 6-hour backlog delivered in 90 seconds, all of it competing for the same budget.

first boot after a long pause must never fire the whole history. `skip` and `coalesce` are the only sane defaults, and `burst` has to be earned per kind.

## 5 · jitter

if forty tiers wake at `:00:00`, you have built a thundering herd against the model provider, the database and the rate limiter at once.

jitter is deterministic, derived from `hash(kind:ref) mod window`, so it survives restarts and is reproducible in tests. the window is 10% of the period, capped at 5 minutes.

## 6 · affordability

a tick can be due and unaffordable. before granting a wake, the scheduler checks the tier's envelope and the crossing's rate bucket.

- envelope exhausted: defer to the next window, do not queue. an unbounded queue of unaffordable work is a denial of service you wrote yourself.
- rate bucket empty: the relay returns `rate_limited`; the scheduler does not retry inside the same window.

## 7 · priority and starvation

three classes: `critical` (lease expiry, audit integrity), `normal`, `background` (reverification, compaction).

a tick processes at most `max_per_tick` items, ordered by priority then `due_at`, with aging: an item waiting more than 3 periods is promoted one class. without aging a busy org starves its own background work forever, and background work is exactly where skill reverification lives.

## 8 · the ticker is a singleton, the workers are not

one process may hold the scheduling lock (advisory lock on a constant). many workers may consume the wakes. if the lock holder dies, the lock releases with the session and another ticker takes over on its next attempt.

## 9 · the scheduler can die silently

this is the failure that matters most at a month scale. if the ticker stops, nothing errors, nothing alarms, and the org simply stops having ideas.

so the ticker writes `ticker_heartbeat(at, tick_count, lag_ms)` every run, where `lag_ms = now - oldest_due_at`. an external monitor, or the owner's weekly digest, alarms when the heartbeat is older than two periods or lag exceeds one period.

a scheduler is not healthy because it is running. it is healthy because its lag is small.

## 10 · what the clock does not own

- **leases** are time-boxed by the lease module; the scheduler only sweeps expired ones.
- **handoffs** expire by their own timeout; the scheduler only surfaces them as escalations.
- **objectives** do not expire on a clock. a stale objective is a finding from the auditor, not a scheduled event.

## 11 · clocks and time zones

store utc, compute utc, render local. monthly re-charter is anchored to a calendar date (`1st of month`), not to `every 2_592_000 seconds`, because a duration drifts across months and a calendar anchor does not. daylight saving is a rendering problem and must never reach the scheduler.

## 12 · open questions

- whether per-tier schedules belong in committed config or in the database. config is reviewable, the database is live-editable. current leaning: templates in config, instantiations in the database, with a drift check that the two agree.
- whether `skill_reverify` should be driven by surface fingerprints rather than a clock. a clock is a proxy for "the world may have changed"; a fingerprint is the fact. the scheduler can only do the former.
