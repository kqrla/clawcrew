# 08 · control loop

## the three clocks

a long-running organization needs three tempos, and they must be owned by different processes. collapsing them produces either a machine that never stops or one that never learns.

| clock | cadence | owner | question |
| --- | --- | --- | --- |
| shift | minutes to hours | the tier | what is happening now |
| weekly | 7 days | the auditor | is what we claim actually true |
| monthly | 30 days | the board (human) | is this still worth pursuing |

## shift clock

leases, handoffs, tickets and approval cards. defined in [05-shifts](05-shifts-and-handoffs.md).

the only design rule worth repeating here: **silence must be an event**. a lease that expires, a handoff that is not accepted and a task that sits in progress past its estimate all produce rows. the org never depends on someone noticing.

## weekly clock: the audit

one tier, one job: compare what the org said to what is measurably true. it executes no work, owns no surface and cannot close a task.

### isolation requirements

- **separate credentials** from the workers, read-only against primary sources. same model is acceptable; same identity is not.
- **out of band.** the audit reads sources directly, not through the workers' reporting layer.
- **no self-audit.** a tier that produced the work may not be the tier that audits it, at any depth. this includes the root.
- **sampled, not exhaustive.** audit a rotating sample of completed tasks each week rather than everything monthly. sampling keeps cost flat and catches systemic patterns; exhaustive monthly audits become a rubber stamp.

### the three questions

**q1 · what did we claim, and what is measurably true?**

compare every closed task with an objective to its evidence. classify:

- `verified`: evidence exists, from the declared source, and supports the claim
- `unsupported`: closed without evidence
- `contradicted`: evidence exists and disagrees
- `untraceable`: no record of why the work happened

**q2 · what has no objective, no owner, or no evidence?**

run the drift queries from [07](07-objective-ledger.md). also check for orphaned surfaces, expired secondments still in use, and leases held by frozen seats.

**q3 · where did spend move less than the metric?**

the correlation question, and the one humans cannot do at scale. rank objectives by cost per unit of measured movement. the bottom decile is the re-charter agenda.

### finding

```yaml
finding:
  id: fnd.114
  week: 2026-W45
  question: q1
  claim: "onboarding rewrite shipped, activation +18%"
  measured: 0.34            # from analytics.activation_daily
  expected: 0.47
  delta: -0.13
  source: "sql:analytics.activation_daily"
  severity: drift           # info | drift | untraceable | stall | integrity
  owner_tier: product.onboarding
  action_required: "explain gap at next re-charter or revert"
  status: open
```

severity semantics:

- **info**: worth knowing, no action.
- **drift**: measured movement disagrees with the claim. owner must respond.
- **untraceable**: no objective or no evidence. a pattern of these is the earliest drift signal.
- **stall**: active objective with no work or no movement for a cycle.
- **integrity**: the record itself disagrees with reality (deleted audit rows, changed hashes, a seat acting outside its grants). this is the only class that pages a human immediately, regardless of the hour.

### the audit's own output is audited

the auditor's findings are stored append-only, and the *next* week's auditor checks whether last week's findings were acted on. a finding that is raised twice and ignored becomes an integrity finding.

this is the only defense against an audit that produces comfortable reports.

## monthly clock: re-charter

a human reads a one-page pack and makes four decisions. this is the minimum human involvement the system needs, and it is non-negotiable at month scale.

the pack:

1. **moved / did not move.** every active objective, its metric, its delta, its spend.
2. **retire list.** objectives with no movement, no belief or no owner.
3. **integrity list.** open integrity findings and what changed because of them.
4. **unmet demand.** denied secondments, blocked requests, suspended responsibilities.

the four decisions:

- retire, continue or re-target each objective
- approve or reject elevations that want to become permanent
- move budget between tiers
- name one thing the org should stop doing

the last one is the hardest and the most valuable. a re-charter that only adds is not a re-charter.

## budget as the scheduler

with no human in the loop, spend is the only thing that naturally throttles the org.

- every tier has an envelope: tokens, money, wall clock and concurrent tasks.
- exhaustion is a **legitimate terminal state**, not a failure. a tier that runs out stops and reports.
- a tier may not borrow from a sibling. it may request from its parent, which is a logged decision.
- running out must never cause a cheaper, unverified path to be taken. the runtime refuses degraded-mode execution rather than allowing it.

this is why budgets are on tiers and not on seats. a seat's budget is a view of its tier's remaining envelope.

## exploration quota

self-direction needs room to notice things, and that room is exactly where scope creep enters.

resolve it with a hard allocation:

- **10 to 15 percent** of each tier's budget is exploration.
- exploration output is a **proposal**, never a production change.
- proposals go to the objective ledger as `proposed`, and are accepted or rejected at re-charter.
- exploration that produces no proposal in a cycle loses the allocation for the next cycle.

the quota does two things at once. it keeps a month-long run from converging into a rut, and it gives initiative a legal channel so agents do not have to smuggle it in as a bug fix.
