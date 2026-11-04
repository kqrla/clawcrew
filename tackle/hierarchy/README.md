# hierarchy

how work moves through the organisation, and why the shape is a pyramid with wings rather than a tree.

## the three layers

A layer is a *decision ceiling*, not a job title. What separates them is the kind of question each one
is allowed to answer.

| layer | answers | may not | its failure |
| --- | --- | --- | --- |
| **directive** | why the org exists, what it refuses to do, which invariants hold even when inconvenient | specify implementation | drifts into positioning statements nobody can act on |
| **division** | which surfaces exist, who owns which, how work is decomposed into slices | write the code or the copy | invents work to look busy |
| **seat** | one task, one surface, one turn | change the grant it was given, or another surface | optimises its own metric at the org's expense |

The separation is enforced, not advisory: a seat that proposes a change to a surface outside its
registration gets bounced (`surface_not_owned`), and a directive that names a function gets bounced as a
spec in disguise. That is the difference between a hierarchy and a diagram.

## what passes down, and what does not

A parent hands down **a brief**, never a plan it cannot see executed:

```
objective        an external, code-computed metric and a target
  task           a slice, a kind, a budget, a deadline, an acceptance rule
    turn         one seat's bounded attempt: propose, act, report
```

What climbs back up is **evidence**, never narration: a commit hash, a deal id, a ticket reference, a
signed checkpoint chain. "Done" is not a message. A child reporting progress without an artifact the
parent could go and look at has not reported anything, and the completion chain refuses it with
`advance_without_artifact`.

Delegation differs from routing. Routing answers *who may pick this up*: the queue, the relay, leases,
visibility. Delegation answers *who was asked and did they accept*: an offer down, an affirmation or a
bounce back up, with an acceptance receipt either way. Custody answers *who holds it right now*: a
time-boxed lease with a heartbeat, renewable, expiring, and reclaimable. Three tables, three failure
modes, and conflating them is how an org gets a task that is routed but never accepted, or accepted by
nobody who holds the lease.

## departments, blocs, wings

The pyramid is the authority axis: tiers, ceilings, escalation. That axis alone produces one giant
queue, and one giant queue cannot be parallelised safely, because every team in it can reach every
surface.

So the same seats are also cut along a second axis, orthogonal to the first:

- **department** — a permanent slice cluster with a shared surface set. support, accounting, code.
  A department owns surfaces; it does not own people absolutely, because a seat can work in two.
- **bloc** — a temporary alliance of departments around one objective with a deadline, e.g. "launch the
  storefront". It exists for the length of the objective, then dissolves. Membership is a grant with an
  expiry, not a reorganisation.
- **wing** — a side structure that holds one capability the whole org needs but nobody's metric rewards:
  security review, legal, on-call. A wing is on a slow clock and reports sideways to every department.

The rule that keeps this legible: **authority flows up the tiers, work flows across the departments,
and lateral pulls (blocs, wings) are always time-boxed and auditable.** A bloc that outlives its
objective is a department that nobody named, and it will start protecting itself.

## the routing rules, in one place

1. a task names one slice; a task that needs two surfaces is two tasks with a dependency.
2. a seat sees only tasks whose slice is in its grants, and only the part of the record that its slice
   needs (below).
3. a parent may route to a child; a sibling may only ask, and asking goes through a handoff that the
   receiver can refuse without a strike.
4. an unfilled task escalates up its tier, it does not hop sideways looking for a volunteer.
5. two seats never hold the same task: the claim is atomic, and a stale claim returns to the queue.

See `slices-and-context.md` for what a seat is allowed to know, and `workdays.md` for how parallel
work and sequential handoffs are scheduled differently.
