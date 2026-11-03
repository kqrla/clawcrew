# hierarchy

tiers, seats, leases. why a pyramid and not a flat pool of agents.

## the shape

```
project
└── tier            one per slice: design, code, research, security, financials,
    │               media, operations, accounting, support, documentation
    └── seat        a duplicable worker with a narrow grant
        └── task    hours of work with one objective and one evidence kind
```

three levels, not seven. every level answers one question: **who is allowed to decide this, and
what happens when they are wrong.**

## why not flat

a flat pool of generalists is cheaper to start and impossible to audit: nobody owns a number, so
every number is everybody's and therefore nobody's. the pyramid is not about status, it is about
attribution. when a metric is wrong, the hierarchy names the tier that owned it, and the tier's
grant says what it was allowed to do about it.

## why not deep

each extra level costs a handoff, and every handoff needs an acceptance (`docs/28`). a five-level
org spends its budget acknowledging work instead of doing it. three levels keeps the acceptance
chain short enough that a bounce-back is cheap.

## what is deliberately missing

- **no manager tier.** coordination is a tick over rows, not a role.
- **no permanent on-call.** responsibility is a lease with a heartbeat, not a calendar entry
  (`docs/26`). a seat that stops heartbeating loses the work, and the work goes back.
- **no seniority.** authority is a capability (a key, a scope, a grant), never a title in prose.

## pages

- [authority](authority.md): capability over role, and how a grant is expressed.
- [escalation](escalation.md): the narrow cases where a human is woken, and the budget for them.
