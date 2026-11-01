# 25 · liveness

docs/21 says how a tick works. docs/22 says how a message crosses. this doc says the thing neither covers and that everything depends on: **what keeps the organization alive for thirty days when every process that runs it is allowed to die at any moment.**

the short answer is that nothing in this system is a running process. there are rows, and there is a tick that reads rows and writes rows. a month is a sequence of ticks. the interesting questions are all about rows that are not moving.

## 1 · custody is a lease, not a baton

the relay race is the intuitive model and it is wrong in one decisive way: a baton exists only in a hand. if the next runner is not on the track, the race stops, and the failure is invisible, because the baton is simply not moving.

what we want instead is **relay semantics over a queue transport**:

- relay gives the guarantee that matters: exactly one holder at a time, one ordered transfer, no shared custody.
- the queue gives the property the relay lacks: work that is ready does not belong to anybody until somebody takes it.

so the baton is a row in state `ready`, and custody is a lease acquired by a claimant. a seat that is idle, paused, dead, or not yet hired does not stop the work. it stops the *holder*, which is a recoverable event, and the row goes back to `ready`.

this is the answer to "task handoff while one is idle". the handoff is not addressed to a runner. it is addressed to a tier, and any seat holding the right credential and slice can pick it up. **work is addressed by capability, not by name.**

## 2 · the work state machine

five states, and every transition is one row update:

| state | meaning | must have |
| --- | --- | --- |
| `ready` | claimable by an eligible seat | `next_action_at` (claim deadline) |
| `leased` | one holder, until expiry | `lease.expires_at`, holder, heartbeat |
| `blocked` | waiting on a named dependency | `blocked_reason`, `next_action_at` |
| `done` | terminal, with evidence | artifact ref or measurement |
| `cancelled` | terminal, with a reason | reason, and the tier that cancelled |

the invariant that makes this run for a month is not in the states. it is: **no row may sit in a non-terminal state without a `next_action_at`.** every non-terminal row declares when it will next be looked at, and the tick sweeps for rows whose moment has passed. a row without one is a stall, and stalls are how months are lost.

this single column is worth more than any monitoring. it means silence is never a valid state, only a deadline that has not arrived.

## 3 · the four invariants

the sweep at the top of every tick enforces four things. each corresponds to a way the organization dies.

**i. no orphaned custody.** a `leased` row whose lease has expired returns to `ready`, `attempts + 1`, with the expired holder recorded. no action by any live process is required, because expiry is a property of the row, not of a reaper.

**ii. no unclaimable work.** a `ready` row that has been claimable past its claim deadline with no successful claim is an **alarm**, not a wait. unclaimable means one of: no seat holds the credential, the slice does not include the objective, or every eligible seat is already leased elsewhere. all three are configuration bugs, and all three are invisible if `ready` is allowed to mean "waiting".

**iii. no spinning.** a holder may renew a lease while making no progress. see section 4.

**iv. no silent terminal state.** a row may only become `done` with evidence attached, and a row may only become `cancelled` with a reason and a cancelling tier. a state change without those is rejected by the store, not by review.

## 4 · the second clock

liveness and progress are different, and conflating them is the failure mode that looks like health.

- **liveness** is the heartbeat. the holder is a running process and it is still there.
- **progress** is the row's `progress_version`, incremented only when the work itself changed: an artifact written, a measurement taken, a surface touched.

a holder that renews its lease N times without incrementing `progress_version` is **spinning**. it is alive, it is holding the work, and it is producing nothing.

this is the most common real failure in agent systems and the least visible, because every health check passes. the action is not patience: revoke the lease, return the row to `ready` with `attempts + 1`, record `spinning` as the reason, and raise it to the tier as a finding. the same seat re-claiming the same row and spinning again is evidence that the *briefing* is wrong, not that the work is hard.

`N` is a per-objective setting because the honest value differs: a migration legitimately runs for an hour without touching anything, a ticket triage does not. the default is three renewals.

## 5 · failure, and the one action per failure

| failure | detected by | action | escalates |
| --- | --- | --- | --- |
| holder died | lease expiry | reclaim to `ready` | no |
| holder spinning | renewals without progress | revoke, reclaim, finding | tier |
| holder blocked | explicit `blocked` transition | park with dependency | no |
| row unclaimable | claim deadline passed | alarm naming the missing eligibility | tier |
| row stalled | `next_action_at` passed | re-arm or block with reason | tier after 2 |
| attempts exhausted | `attempts >= max_attempts` | `blocked` with full attempt history | tier, once |
| message expired in flight | `expires_at` passed | drop, record | no |
| loop detected | message `path` repeats a tier | drop, record, alarm | tier |
| ticker dead | no heartbeat for 2 intervals | external watchdog restarts it | human, if 3 |
| spend ceiling hit | per-tick budget | defer to next tick, do not drop | no |

every row has exactly one automatic action. "someone will notice" is not in the table, because in a month-long run there is no one.

the two rows that reach a human are deliberately the ones a person can actually fix: the ticker being dead three times in a row, and a spend ceiling that keeps binding. everything else resolves inside the org.

## 6 · bounded ticks

a tick must be bounded in cost, or one busy minute spends the month.

per tick: a cap on claims, a cap on deliveries, a cap on spend, and a wall-clock budget. work beyond the cap is *deferred*, not dropped, and deferral is visible in the next tick's report. a tick that hits its cap every time is a signal to raise capacity, not proof of progress.

the tick is also a singleton by advisory lock, and losing the lock is a normal exit, not an error. workers are not singletons: one row, one holder, many processes.

## 7 · cold start

there is no warm state. the process holds nothing between ticks, so starting from zero is identical to recovering from a crash: read the rows, sweep, continue.

this is why the tick store must be a real database with real transactions, and why docs/16 refuses to treat git as the write path. a month-long run is a sequence of commits that must survive the process that made them.

the test for this is unpleasant and cheap: kill the ticker between every tick for an hour of simulated time and assert the state is identical to an uninterrupted run.

## 8 · the human channel is part of the runtime

the five-contact budget from `concept/03-autonomy` is enforced here, mechanically:

- escalations are rows with a `class`, and only `summons` class rows count against the budget.
- a `digest` accumulates non-urgent items and emits at most once per window, so eleven small questions cost one contact.
- `break_glass` rows (money loss, security, legal) bypass the budget and must declare the class at creation.
- a row that cannot be resolved without a human and cannot be escalated (budget spent, not break-glass) **waits in the digest**. it does not proceed unsafely, and it does not invent an exception.

the count of open summons rows is a health metric with a target of zero and a ceiling of five per thirty days.

## 9 · how we prove it

a month cannot be tested in a month, so time is an input.

the harness runs the real tick loop against the real store with a **simulated clock**, so thirty days of ticks execute in seconds. on top of that:

- **invariant checks after every tick**: the four in section 3, asserted, not sampled.
- **failure injection**: kill the ticker, expire leases early, deliver messages twice and out of order, hold a lease without progress, and fill the spend ceiling mid-tick.
- **a synthetic objective** with a metric the harness controls, so the org can be pushed into every branch: met early, never met, met and then broken.
- **the spinning case** on purpose, repeatedly, because it is the one that produces no error and no progress.

the acceptance test for a month is not "it did something useful". it is: **no row entered a non-terminal state without a deadline, no state transition happened without a reason, and the final state is reproducible from the record alone.**

## 10 · build order

1. `next_action_at` on every work row, and the sweep that refuses rows without one. everything else depends on it.
2. reclaim on expiry, with `attempts` and the expired holder recorded.
3. the spinning detector, because it is the cheapest high-value control in the system.
4. the claim-deadline alarm, which turns configuration bugs into alerts.
5. bounded ticks with deferral accounting.
6. the simulated clock harness, before any of the above is trusted in a real month.

## 11 · open questions

**who restarts the ticker.** a cron or a platform trigger, outside the org. this is the one place the system depends on something it does not own, and the honest answer is that the dependency is unavoidable: something must exist that is not a row.

**how long a claim deadline should be.** too short and legitimate work is reclaimed mid-flight; too long and an unclaimable row sits quiet for a day. unresolved, and it probably differs per objective.

**whether a paused tier should hold leases.** pausing a tier without releasing its claims creates exactly the unclaimable-work case. the current answer is that pause releases leases, which is also the answer that makes pause safe.
