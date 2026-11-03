# 34 · agent lifecycle

`division-of-labor/agent-lifecycle.md` says why there are four verbs. this is how they are built and
what each one refuses, because the refusals are the product.

## the four verbs, and the asymmetry

| verb | reversible | needs | refuses |
| --- | --- | --- | --- |
| `duplicate` | yes, by burning the child | parent live, subset grant, depth under cap | burned or frozen parent, `skill_not_granted`, `grant_not_granted`, `lineage_too_deep`, `orphaned_seat_may_not_spawn` |
| `freeze` | yes, by `thaw` inside the window | live seat | `seat_is_burned`, `already_frozen` |
| `thaw` | yes, by `freeze` | frozen seat inside its window | `seat_is_burned`, `not_frozen`, `frozen_window_expired` |
| `burn` | **no** | a reason of at least three characters | `seat_is_burned`, `burn_needs_a_reason` |

fourteen tests in `test/agents.test.ts`.

## why refusals are return values

a refusal is a normal outcome. the tick has to route it, the alert has to count it, and the audit
trail has to show it. an exception turns "no" into a crash, and a crash becomes a `try/catch` that
swallows the reason. `{ ok: false, reason }` survives a serialisation boundary, a log line, and a
screenshot somebody reads a week later.

## duplication is narrowing

the check is on both axes, because a capability is a function *and* the binding:

- **skills**: `skills ⊆ parent.skills`. anything else is an escalation.
- **grants**: for every function the child holds, the child's scope must be satisfied by the parent's
  scope, key by key. adding `force: 'yes'` to the parent's `{ repo, branch }` grant is refused.

a child may be bound more tightly than its parent, never more loosely. this is the only place in the
system where the subset relation is enforced by code rather than by review, and it is the reason an
autonomous org can spawn without asking.

## freezing is about the lease

a freeze preserves grant, open tasks, evidence and lease history, and it releases the on-call lease.
the release is the point: a frozen seat holding a responsibility is an outage nobody has been told
about yet.

## thawing has a deadline because state expires

`frozenUntil` defaults to fourteen days. past it, the refusal is `frozen_window_expired` rather than
a silent resume, because in that time the tools moved, the objective may have been superseded, and
the lease is somebody else's. the correct move is a re-spawn against the current ledger, and the
refusal is what tells the tick to do that instead.

## burning is the last resort that must stay available

it carries the strictest conditions because it is the verb an org reaches for when it is angry:
terminal, reasoned, and it cannot be re-run. capabilities may be re-granted to a fresh seat; the
burned seat's record stays. "we tried that and it failed" is the most valuable line in the history.

## orphan, which is not a verb

burning a parent does not burn its children, because they may be doing unrelated work. it sets
`orphaned` on them: they finish what they hold and they may not spawn. an orphan that could still
multiply would be a burn that failed to burn.
