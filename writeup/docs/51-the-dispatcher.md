# 51 · the dispatcher

Everything before this **answered**. Tickets in, replies out, evidence computed, spend recorded. An org
that only answers is a help desk with an org chart drawn on it. This is the part that decides what gets
worked on next, from the ledger, and says so when the answer is nothing.

## the shape

`src/jobs/dispatch.ts` is pure: candidates + seats + live leases + registered kinds in, one assignment or a
refusal out. `scripts/dispatch-once.ts` reads those from the database and holds a lease.

```
dispatch: t.dispatch.2 (support) -> seat.support, lease 15m
dispatch: nothing assigned (nothing_ready) candidates=1 seats=1
```

The second line is the point of the first: once leased, the same task is not handed out again. A lease is a
row with an expiry, not a flag, so a seat that dies mid-task releases the work by itself. No heartbeat, no
person noticing.

## the refusals, and why each is a feature

| why | meaning |
| --- | --- |
| `nothing_ready` | nothing to do, said out loud, so a quiet org is distinguishable from a stuck one |
| `kind_unregistered` | a task whose kind the org cannot evidence, which could never be finished, so handing it out would manufacture work that cannot close |
| `no_seat_for_slice` | nobody covers that slice on this shift; assigning it anyway is how work disappears into a queue nobody reads |
| `all_seats_leased` | the bound is people, and the honest answer is wait |

## what the schema disagreed with, and won

Three corrections, all mine:

1. `task` has no `slice` and no `priority`. The slice is the tail of `owner_tier` (`t.test01.support` →
   `support`), and "next" is the ledger's own order: `starved_at`, then age. I invented a priority column
   because a dispatcher wants one; the schema says starvation is the priority, which is better.
2. There is no kind registry table. The registry **is** the `CHECK` constraint on `task.kind`, so the script
   parses it from `pg_constraint` rather than keeping a second copy that drifts.
3. Non-terminal tasks require `next_action_at` and `claim_deadline_at`. The liveness migration from
   `docs/31` already forbade a task with no deadline, and it refused my first insert. That constraint is
   why a leased task cannot be forgotten.

## since then

Completion exists (`docs/52`), so this assigns and the work can now end. `supervise.ts --job work` supervises
the combined settle-then-dispatch pass.
