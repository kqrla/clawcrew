# 04 · diverging and converging

parallel work is only worth its coordination cost if the pieces can be done **without watching each other**. the design goal is maximum decoupling during the work and a hard, single instant of reconvergence at the end.

most multi-agent systems get this backwards. they keep agents in a shared conversation so they stay consistent, which means they are always converging and never actually parallel. consistency is not the goal. **reconcilable divergence** is the goal.

## what decoupling requires

three things, and all three are preconditions rather than optimizations.

**a partition map.** before any team fans out, the region is divided into parts and every part is assigned to exactly one owner. exhaustive, no overlap, no remainder. an unassigned remainder is the bug that surfaces two weeks later as "who was doing the migration".

**no shared mutable surface.** two teams editing the same surface are not parallel, they are a race with a schedule. the surface registry from [02-org-chart](../02-org-chart/readme.md) is what makes this checkable: if two tiers own the same surface, the fan-out is refused rather than discouraged.

**a stated join.** before fanning out, the org says how the results will be combined and what happens to a team that does not report. discovering the join rule at convergence time means discovering it as an argument.

## the anti-orphan rule

the rule that does the most work in this design is small: **a tier may only report on a partition it owns, and silence is not a report.**

the second half is the load-bearing one. in a normal org, a team that says nothing is assumed to be fine, and the assumption is invisible. here, a missing report is a distinct state that blocks closure and names the tier. convergence cannot complete silently, which means it cannot complete falsely.

the first half prevents the opposite failure: an ambitious tier reporting on someone else's partition, which inflates coverage without adding it. ownership is checked against the partition map, not against the reporter's confidence.

## convergence needs the parent's number

this is the part that is easy to get wrong and expensive to get wrong.

the naive join is agreement: every team reports done, they agree, the gate opens. this fails in a specific and predictable way, because teams can converge on anything by agreeing with each other. the result is an org that is internally consistent and externally wrong, and the failure is invisible from inside because everyone reported the same thing.

so closure requires **two independent conditions**:

1. the partition map is exhausted, with every part carrying a result or an explicit not-applicable.
2. the objective's own metric, measured from its declared source, meets its target.

the second condition is measured by the parent, not reported by the children, and it is measured after the last amendment. that is the whole difference between a roll-up and a vote. a roll-up can fail while every child reports success, and that is a feature.

## joins are not all the same

"converge" hides at least three different operations:

- **all** is the default for work that must be whole. every partition lands or the gate is closed.
- **quorum** is for redundancy, where several attempts at the same partition are cheap and one is enough. the losers are not failures, they are wasted spend that bought a shorter tail.
- **first success** is for races, where the first team to satisfy the metric ends the operation and the rest are released. this is the only join where cancellation is a normal outcome rather than a failure.

choosing the join after seeing the results is how a gate becomes a rubber stamp. the join is declared with the partition map, before the work.

## blocked is a result, not a verdict

a team that cannot proceed says so, with the specific dependency. this resolves nothing and it must not be treated as resolution: a partition in blocked state keeps the gate closed while making the cause visible. the alternative, letting blocked count as "done enough", is how a converged org ships with a hole in it.

## breaking a tie between equals

when two sibling tiers disagree, the resolution is neither negotiation nor a vote. they share a nearest common ancestor, and that tier adjudicates using its own objective's metric. this is why the apex sentence in [01-hmas](../01-hmas/readme.md) matters: without it, peers either escalate to a human for something mechanical, or they settle it between themselves, which is the agreement trap again.

## what breaks without this

without a partition map, coverage is a claim. without the anti-orphan rule, silence reads as success. without a metric measured by the parent, convergence is a consensus and consensus is cheap. without a declared join, the end of the fan-out is a negotiation over what "done" means, conducted by the parties who most want it to mean something convenient.

## what we do not claim

that divergence is always right. some work genuinely is one thread, and splitting it produces two half-threads and a merge conflict. the test is whether the pieces can be specified independently before they start. if you cannot write the partition map without describing the other partitions, the work is not separable yet.
