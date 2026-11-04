# clawcrew

An attempt to build an organisation that a person can leave alone for a month: nested authority, work that
is routed and delegated and *held* rather than merely assigned, money and credentials that are bounded by
configuration, and an audit trail legible to somebody who was not there.

**The code lives in [`backend/`](backend/).** Everything else is the argument for it.

```
backend/            TypeScript, postgres. migrations, domain logic, the support segment, tests
tackle/             how the organisation works
  hierarchy/          the three layers, routing, departments/blocs/wings, slices, workdays
  division-of-labor/  who owns which surface, and why ownership is declared not inferred
  feedback-loop/      turn, completion, strikes, objective ledger, weekly audit, monthly review
  scope-management/   the four boundaries, and the rule that you escalate rather than work around
  self-directed/
    handle/           what the org may do outside its own repo
      credentials/    capability, never a secret
      finances/       money in, reconciled against a witness
      payments/       money out, fiat only, ceilings checked before the attempt
      permissions/    authority as a diff, with an expiry
writeup/            the slower writing
  docs/               the numbered design documents (00 thesis through 42 the model port)
  concept/            material about the shape of the thing
  diagrams/           pictures
directive/          positioning and invariants. never implementation
socratica/ toolbox/ test-projects/   adjacent work, not the org itself
```

## the state of it

Proven end to end: one support ticket arrives, a seat claims it under a lease, a model writes the reply
within its granted argument domain, a second seat reads what was stored and signs it closed, and an
objective measured from the database moves. A failed provider call, a frozen seat, or an exhausted budget
returns the ticket to the queue instead of stranding it. 537 tests.

Not proven: the loop runs as a script with a flag rather than a supervised service, per-call cost is a
flat reservation rather than measured tokens, and nothing has run unattended for more than a few minutes.
The month is the claim; a few minutes is the evidence.

## reading order

1. [`directive/`](directive/) for what the org refuses to do.
2. [`tackle/hierarchy/`](tackle/hierarchy/) for how work moves and what a seat is allowed to know.
3. [`tackle/scope-management/`](tackle/scope-management/) for the four boundaries and why argument scope is
   the one that actually bites.
4. [`writeup/docs/00-thesis.md`](writeup/docs/00-thesis.md) onward, for the reasoning.
5. [`backend/readme.md`](backend/readme.md) to run it.
