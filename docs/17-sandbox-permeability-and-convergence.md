# 17 · sandbox, permeability and convergence

## the claim

a sandbox is two properties, and most systems build only the first.

| property | question | failure when missing |
| --- | --- | --- |
| isolation | what can this team not see or do | one team's mistake is everyone's |
| permeability | what may cross, in which direction, how often, under whose name | the org cannot coordinate, so it routes around the wall |

isolation alone produces teams that cannot converge. permeability alone produces a single team with extra steps. the interesting object is the door.

> a wall with no door is isolation. a wall with an open door is not a wall.
> a door with a declared width, a direction and an expiry is a control surface.

**permissive permeability** is the design stance: a small number of wide doors, not a large number of narrow ones. an agent blocked at every boundary does not stop. it asks a human, or writes the content into a commit message, or waits until someone grants it a token. each of those is worse than the crossing it avoided.

## four mechanisms, deliberately not merged

most systems collapse these into "messaging" and then cannot answer who owes the work.

| mechanism | moves | authored by | recorded as |
| --- | --- | --- | --- |
| crossing | permission | an ancestor or a peer, with expiry | a declared object |
| relay | a message | the sending circle | an envelope with a receipt |
| handoff | responsibility | the sender, accepted by the receiver | a state machine |
| secondment | a seat | requested by host, authorized by home | a scoped loan |

a relayed message does not create an obligation. a handoff does. keeping them apart is what lets a team be informed without being drafted.

## crossings

```yaml
crossing:
  id: x.brand-eng
  from: brand
  to: eng
  allowedKinds: [proposal, artifact_ref, signal]
  maxPerHour: 20
  expiresAt: 2026-12-01T00:00:00Z
  authorizedBy: seat.ceo
```

rules:

- **directional.** the reverse direction is a separate crossing, and asymmetry is usually correct: brand may propose a change to the launch page; eng may not post to brand's accounts.
- **typed.** a door opened for `proposal` does not carry `finding`, even though both are text.
- **shaped, not boolean.** rate and expiry are the control. zero means no door, and an unbounded rate means the wall is decorative.
- **expiring.** a crossing that nobody remembers authorizing is how a matrix becomes a mesh.
- **payload is a reference.** `relay()` refuses prose for the same reason `handoff()` does: a paragraph is a summary, and summaries compress the thing that mattered.

## relay

store and forward, with three states that matter: `accepted`, `duplicate`, `rejected` with a reason.

- **dedupe on `dedupeKey`.** retries are normal; double-counting is not.
- **hop limit.** a message that crosses three walls costs three hops and stops. this is the loop bound, and it is cheaper than a ttl on a graph.
- **expiry is the envelope's, and the door's is separate.** a live door does not resurrect a dead message.
- **undelivered is a row.** a relay that vanishes is the same silent-drop failure as an unaccepted handoff.

transport is whatever the receiver projects to:

| envelope kind | lands as |
| --- | --- |
| `proposal`, `request` | an issue on the receiving team's board (plane) |
| `artifact_ref`, `finding` with a source | a bookmark tagged with the objective id (karakeep) |
| `signal` | a threshold event in the ledger's context |

the crossing decides *whether* it may travel. the projection decides *where it appears*. neither decides what is true.

## convergence

parallel teams finish at different times on different partitions and then have to become one thing.

```yaml
convergence:
  id: conv.launch
  parentObjective: obj.activation
  circles: [eng.product, brand.social, finance-ops]
  partitions:
    page-build: eng.product
    page-copy: brand.social
    pricing-line: finance-ops
  join: all              # all | quorum | first_success
  deadline: 2026-11-12
```

**the partition map is exhaustive by construction.** an unowned partition is a validation error, not a surprise at the end.

**a circle may only report on a partition it owns.** this is the anti-orphan rule. without it, the fastest team quietly fills its neighbour's gap and the gap never appears as a finding.

**silence is not a result.** `result` needs an artifact reference. `not_applicable` needs a reason and counts as resolved. `blocked` is a report that does not resolve anything, which is the distinction the barrier is built on.

**join semantics:**
- `all`: every partition resolved, or nothing closes.
- `quorum(n)`: n results is enough; the rest are cancelled explicitly, not left running.
- `first_success`: the first result wins and `cancelledByFirstSuccess()` names the tracks to stop. a race with no cancellation is just wasted spend.

**the integration gate is the drift control.** convergence is not closure:

```
barrier satisfied  AND  parent metric measured  →  can close
```

the barrier says the work came in. the parent metric says the work mattered. this is the same rule as the ledger, one level down: a parent objective cannot be satisfied by its children agreeing with each other.

**divergence is a conflict, not a merge.** if two circles report results that touch the same surface, `conflicts()` returns the surface, the circles and their artifacts. last-write-wins is not a merge strategy, it is a coin flip with a git history. the conflict routes to the parent circle's manager.

**deadlines produce findings.** `stall()` turns a missed convergence into an overdue row with the missing and blocked partitions named, which is the only form of "we're behind" that survives a quiet week.

## why this is where drift actually enters

a single team drifting is visible against its own objective. parallel teams drifting is invisible, because each one is locally coherent and the join is where the objective quietly becomes "everyone shipped their part".

three things make that benign instead of fatal:

1. partitions are declared up front, so the shape of the answer exists before the work does
2. no team can speak for another team's partition
3. the gate measures the parent, so mutual agreement cannot substitute for movement

## what permeability costs

- every crossing is a reviewable object. a network with two hundred of them is a mesh pretending to be a sandbox. audit crossings the way you audit elevation grants: count them per pair, and treat growth as a smell.
- relay volume per pair is a load measurement. a pair at its rate limit every hour has an under-sized door, and the agents are working around it.
- a high rejection rate on one door means the same thing. the door is the wrong shape, not the request.

## implementation

- `src/domain/relay.ts` · crossing, envelope, permit, forward, permeability score
- `src/domain/convergence.ts` · partition map, reports, barrier, join rules, gate, conflicts, stall
- `src/jobs/reconcile.ts` · weekly projection drift, repair by re-push only

## not done

- no relay store or delivery loop. the states exist; the ticker does not carry them yet.
- no crossing registry in the api, so doors are declared in code rather than reviewed in a diff.
- no notification on stall. `stall()` returns the finding; nothing wakes anyone with it.
- crossings between a team and the auditor are unspecified on purpose: the auditor should read primary sources directly, not receive relayed copies of claims.
