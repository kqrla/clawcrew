# 08 · prioritization

priority in most systems is a field. something is high or low, and the queue sorts on it. that works when the queue has one consumer.

here there are three scarce resources and they are not interchangeable: **seats**, which are finite and leased; **spend**, which has a ceiling per tier; and **human attention**, which is the scarcest and the only one that degrades permanently once spent. a priority field cannot express a claim on three resources whose cheapest unit is different.

so priority is not a number. it is a **claim on resources with a justification attached**, and the ordering falls out of the claims rather than being assigned.

## the objective is the unit

a task has no priority of its own. it inherits its importance entirely from the objective it serves, which is why every task must reference one.

an objective is:

- **versioned**, so amending it is visible and a rise in importance is a decision rather than an edit.
- **one number**, with a baseline, a target, and a horizon.
- **measured from a declared source**, executable, outside the org's own reporting: a query, an endpoint, a build artifact, a run.

that third property is what makes prioritization meaningful at all. an objective whose metric is an agent's assessment can be satisfied by redefining the assessment, and any ordering built on it is theatre.

## ordering rules, in order

the rules apply in sequence, and earlier rules dominate later ones. this is deliberate: a single scalar score invites the system to trade a catastrophic violation against a marginal gain and call the result arithmetic.

1. **due before new.** an objective past its horizon is a verdict owed, not a task. it blocks, because an org that starts new work while owing verdicts is an org that never assesses anything.

2. **blocking before blocked.** work that unblocks a partition beats work that adds a partition. convergence is gated on exhaustion, so an unblocking task is worth more than it looks, and a blocked task is worth nothing until the block is cleared.

3. **owed before desired.** a handoff that was accepted, a bounce that returned, an elevation that is expiring: these are promises with a counterparty and they outrank anything the org merely wants.

4. **cheap before expensive, within a rule.** at equal rank, the smaller claim on the three resources runs first, because a month is long and variance compounds. this is a tiebreaker, not a principle.

5. **depth as the last resort.** when two objectives from different branches tie, the nearer common ancestor orders them, using its own metric. never a vote between the two branches, and never a human, for something mechanical.

rule five exists because the alternative is worse than it looks. two sibling teams left to settle priority between themselves will settle it in favour of whichever has more tokens, and that is a real hierarchy, just an undeclared one.

## where priorities actually conflict

three conflicts are structural and recur in every run.

**sibling contention for one surface.** both want to change the same thing. this is not a priority question, it is an ownership question: the surface owner orders the changes and the other proposes. treating it as priority is how a merge conflict becomes a political one.

**parent urgency against child horizon.** the parent wants the number sooner than the child's window allows. the horizon rule in [03-autonomy](../03-autonomy/readme.md) makes this illegal to resolve by decree. the legal resolutions are to split the objective, to raise the child's horizon by amending the parent, or to fail the objective early. a receding deadline is not among them.

**spend against breadth.** more objectives in parallel, each moving slowly, or fewer moving fast. this is the one genuine strategy question in the system, and it is the reason the org has a human at all. it cannot be computed from the objectives, because it depends on how much variance the person can tolerate, which is not in the record.

## starvation

a rule set that favours blocking and due work can starve low-priority objectives forever, and the same rules that keep the queue honest are what let an org stop work it has already paid for ([09-doubling-down](../09-doubling-down/readme.md)). starvation is the priority system's version of doubling down: continuing to fund something because it is on the list. so each objective carries a **maximum interval between touches**, and an objective that goes untouched past it escalates as a scheduling failure rather than a priority decision.

this is not fairness, it is the same anti-silence rule that runs through the whole design: a thing that is not moving should be visibly not moving, not quietly deprioritized. the failure of prioritization is not choosing wrong, it is choosing without anyone being able to see the choice.

## what gets dropped when nothing fits

a real month has more objectives than capacity, and the honest answer is not to run everything badly.

when nothing fits, the org drops in this order: work that serves no active objective first, then redundant quorum attempts, then exploration, then new work, and never verdicts or promised handoffs. dropping is a recorded decision with a reason, because an org that quietly drops work learns nothing from having been over capacity.

the one thing that is never dropped is the audit. when the choice is between finishing an objective and preserving the record, the record wins, because an unfinished month is a month that can try again and an unaudited month is a month that taught nothing.

## what breaks without this

without a metric per objective, priority is taste. without versioning, importance can be inflated without a decision. without the ordering rules, the queue is whatever arrived last, and the org becomes reactive in a way that looks like responsiveness. without the touch interval, deprioritization is indistinguishable from being forgotten.

## what we do not claim

that this produces good strategy. it produces a defensible ordering given objectives that a human considered worth having. the objectives are the strategy, and this folder is only the machinery that keeps the organization from quietly substituting its own preferences for them.
