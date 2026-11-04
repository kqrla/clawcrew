# 26 · convergence barriers

docs/17 argues that agents working in parallel need a convergence point. `concept/04-decoupling` explains why. this doc specifies the barrier, because the barrier is where parallel work is either sharp or fake.

the claim is narrow: **parallel decoupling beats serial work only when the join is a query over independent evidence.** when the join is a conversation, the same fan-out is slower than serial and less honest, because the participants settle it between themselves.

## 1 · the barrier is a record, not a meeting

a convergence is a row with a partition map, a join rule, a deadline and a set of reports. nobody convenes. the barrier opens when the gate function returns true, and the gate is pure:

```
gate(convergence, reports, metric, now) -> open | closed(reasons[])
```

pure matters because it means the gate can be evaluated on every tick, for free, with no ceremony. in a maintaining org the same barrier is checked hundreds of times over a month. a barrier that requires a meeting to evaluate cannot be re-checked, so it gets checked once, at the moment everyone is most optimistic.

## 2 · the partition map

exhaustive by construction, not by convention: every partition maps to exactly one owning tier, and `validateConvergence` refuses a map that is empty, has one tier, or has a partition with no owner.

the map is versioned with the objective. changing the map mid-flight is legal and it is an amendment, which means the gate re-evaluates against the new map and the old reports keep the map version they were filed under. a map that changes on every tick is scope drift wearing a hat, and version churn is how it becomes visible.

the map is written **before** the work starts, by the tier that owns the objective. a map written after the reports exist is a description of what happened, not a plan, and it will always be exhaustive.

## 3 · fan-out pre-flight

three checks before any partition is dispatched, all refusing:

1. **exhaustive and disjoint.** every partition has one owner; no partition has two.
2. **no shared mutable surface.** if two partitions' `touches` overlap on a surface with more than one writer, the fan-out is refused rather than scheduled. two teams on one surface is not parallel work, it is a race with a deadline.
3. **join declared.** `all`, `quorum` (with its number), or `first_success`. choosing the join after seeing results is how a gate becomes a rubber stamp.

a refusal here is cheap. the same conflict discovered at the gate has already cost the fan-out.

## 4 · the gate

two conditions, and both must be evidenced:

**coverage.** for every partition, a report exists and its outcome is `result` or `not_applicable`. `blocked` explicitly does *not* satisfy coverage: it keeps the gate closed while naming the cause, which is the difference between a visible hole and a shipped one.

**the parent's number.** the objective's metric, measured from its declared source, meets its target, and the measurement's timestamp is **after the latest report's timestamp**.

that second clause is the whole doc in one sentence. without it, a metric measured before the last amendment passes a gate that the amendment already invalidated, and the org closes on evidence about a world it has since changed. children cannot self-certify this: the measurement is taken by the parent, from the source, not from a report.

the two conditions are independent on purpose. every child can report success and the metric can fail, and that is a meaningful, correct, and unwelcome outcome. it is the only mechanism that catches an org converging on its own narrative.

## 5 · anti-orphan

silence is not a result. a partition with no report is a named hole in the gate's reasons, attributed to the owning tier, and it survives until that tier reports or is cancelled by an ancestor.

the converse rule is checked too: a report whose `touches` fall outside its partition is refused, because coverage that includes someone else's partition inflates the map without doing the work. both directions of the rule exist because both failures are common, and each looks like diligence from the inside.

## 6 · collisions and disagreement

two reports touching the same surface is a **collision**, not a disagreement. the barrier does not adjudicate it; the surface owner does, and the barrier stays closed until the owner's decision is recorded.

two reports with contradictory conclusions is a **disagreement**. resolved by the nearest common ancestor of the two tiers, using that ancestor's own metric. never by vote, never by negotiation between the parties, and never by a human, because all three of those are ways of letting the convergence be decided by whoever is most confident.

## 7 · the joins, and what each costs

| join | opens when | the cost |
| --- | --- | --- |
| `all` | every partition reports a result | the slowest partition sets the critical path |
| `quorum` | `k` of `n` report a result | spend on redundancy; the rest must be cancelled, not abandoned |
| `first_success` | any partition reports a result that satisfies the metric | the losers are *released*, and release is a recorded outcome |

`first_success` is the only join where cancellation is normal. its danger is that the released attempts keep running out of habit, which is doubling down with extra steps (`concept/09-doubling-down`). release must be an explicit transition that revokes the lease, not a message telling the team to stop.

## 8 · partial convergence at the deadline

a barrier that reaches its deadline without opening has three legal outcomes, and "extend the deadline" is not one of them:

- **fail the objective**, recording which partitions were missing.
- **amend the objective** to the subset that did converge, at the parent tier, with a new metric and a new deadline.
- **ship a documented hole**: the objective is marked met-with-exceptions, the missing partitions are named in the record, and each becomes a new objective with its own kill criterion.

the third is legitimate and the most common in practice. it is only legitimate because the hole is *named*: an org that gets its number while quietly not doing a tenth of the work has the same record as one that did the work, unless the exception is a row.

## 9 · iteration makes cheapness mandatory

in a dark factory the barrier is not crossed once per objective. the maintain loop re-checks the same convergence after every change, because a change to one partition can un-converge a gate that was open.

so the gate must be a query, its cost must be negligible, and its result must be cacheable by input hash. the moment the gate costs a meeting, the org stops re-checking, and a gate that is checked once is a gate that describes the past.

## 10 · when not to fan out

fan-out is sharper than serial when the partitions are independently verifiable. it is worse when they are not, and the failure is expensive because it is invisible.

do not fan out when:

- the partition map cannot be written without describing another partition. the work is not separable yet.
- the parts share a mutable surface. that is a queue, not a fan-out.
- the metric moves only when all partitions land, and no partial state is measurable. then you have one objective with a serial dependency, and the parallel org is spending seats to render its own blocking.
- the coordination cost exceeds the critical path saved. with three partitions and a gate that needs adjudication, serial usually wins, and a serious org should be able to say so.

## 11 · build order

1. `validateConvergence` refusing empty maps, single-tier maps and unowned partitions. cheap, and it stops the fake version immediately.
2. the gate as a pure function, with coverage and the parent's post-amendment metric as separate reasons.
3. the collision check on `touches`, at report time rather than at gate time.
4. the pre-flight surface check, so the race is refused before it is scheduled.
5. release-as-transition for `first_success`, so losers stop.
6. map versioning, so amendments are visible as amendments.

## 12 · open questions

**how many partitions is too many.** around seven, the gate needs adjudication often enough that the parent becomes a bottleneck. unmeasured.

**whether `quorum` should ever pay.** redundancy costs the same as disagreement, and in practice `all` with good partitions seems to beat `quorum` with good luck. not yet tested at scale.

**what a partially converged maintain loop looks like.** the iterate/ship/maintain registers have different natural barriers, and it is not obvious that one gate function serves all three without special cases creeping in.
