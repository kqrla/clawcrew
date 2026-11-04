# 19 · where orchart sits in the hmas taxonomy

reference: d. j. moore, *a taxonomy of hierarchical multi-agent systems: design patterns, coordination mechanisms, and industrial applications*, arxiv:2508.12683. five axes, and a stated preference for hybrid coordination over pure hierarchy or pure decentralization.

the paper is a lens, not a prescription, which is why it is useful here: it names the dimensions we were choosing on without realising there were five of them.

## the five axes, and our position on each

| axis | options the paper distinguishes | orchart | why |
| --- | --- | --- | --- |
| control hierarchy | centralized, decentralized, hybrid | **hybrid, split by function** | the tree carries authority and exceptions; work travels on partitions. hierarchy for accountability, decentralization for throughput |
| information flow | top-down, bottom-up, peer-to-peer | **peer-to-peer by default, vertical only by declared crossing** | parents do not get ambient visibility into child transcripts. that is unusual, and deliberate |
| role and task delegation | fixed roles, emergent roles | **fixed roster, emergent proposals** | roles come from templates; self-direction enters as proposals against a capped exploration budget |
| temporal hierarchy | long-horizon decision layers over short-horizon execution layers | **cadence only, until v0.3** | this axis found a real hole. see below |
| communication structure | static networks, dynamic networks | **static permits, dynamic traffic** | crossings are declared and reviewable; relays inside them are free |

## the axis that caught a defect

v0.2 had three clocks (shift, weekly audit, monthly re-charter) and called that temporal layering. the taxonomy separates two things we had merged:

- **cadence**: how often a layer reviews
- **horizon**: how far ahead a layer is allowed to commit

a weekly review is not a four-week planning window. without a horizon field, any tier could commit to an objective of any length, so a seat on a one-day shift could promise a thirty-day outcome, hand off on day two, and no one would own the horizon that the promise implied. that is a drift mechanism wearing a scheduling costume.

the fix is in `backend/src/domain/horizon.ts` and it is two rules:

1. a tier may commit only to objectives no longer than its own horizon
2. a tier may not plan longer than its parent

the second is a configuration check, not a runtime one. the first is enforced on commit. `effectiveWindowDays` then bounds a lease or a shift by the narrowest horizon in the ancestor chain, which is what stops a shift-level team from inheriting a quarter's worth of implicit obligation.

## mechanisms the paper points at that we do not have

**contract-net for partition allocation.** we assign partitions statically, by manager, at plan time. contract-net would let tiers bid for a partition when capacity is genuinely unknown, and would make a slow team's inability to take work visible as a losing bid rather than as a deadline nobody meets. it is the better mechanism when the partition map is uncertain at the start. not built.

**explainability upwards.** the paper lists making hierarchical decisions explainable to human operators as an open challenge. our answer is evidence, which is not the same thing. evidence says *this moved*. a decision record with reasons says *why we chose this*. we have the first in the ledger and the second only partially, in channel decision records. the gap matters most at the month boundary, where the re-charter needs reasons rather than numbers.

## mechanisms we deliberately reject

**emergent topology.** the paper treats dynamic communication networks as a design option. for us an undeclared link is a write path, and a write path nobody registered is exactly what the permission model exists to prevent. self-organization happens inside a declared door, over secondments and proposals, not by inventing doors.

**council as a decision rule.** averaging independent opinions is fine for judgment and useless for truth. three agents agreeing is not evidence. the convergence barrier measures; a vote does not. use a council where the output is an opinion, a barrier where it is a result.

## the honest summary

orchart is a hybrid in the specific sense the paper recommends, with the hierarchy deliberately emptied of the two jobs hierarchies usually do badly: it does not route work, and it does not aggregate claims. it holds authority and it holds exceptions. everything else travels on partitions and crossings.
