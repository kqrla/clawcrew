# 03 · autonomy over a month

the unit of design is not the task, it is **the month**. a task that completes is easy. a month that ends with a true account of itself is the thing being built.

this reframing changes what you optimize. capability per step stops mattering after the first hour, because the org already has more capability than the objective needs. what matters is whether the system is still honest at hour seven hundred, which is a property of the substrate rather than of the model.

## what kills a long run

four failures, in the order they usually arrive.

**entropy.** shifts end, nobody picks the next one up, and the org looks busy while nothing is running. there is no error, no crash, just a quiet gap. this is the most common way a month-long run dies, and it dies without a signal.

**drift.** an objective whose deadline keeps receding is never late and never done. a tier that re-parents its own work inherits a horizon it cannot sustain. nothing is wrong at any single step, and the month closes with a plan that has been true for six weeks.

**plausible completion.** an agent that cannot finish produces a report explaining why the work is essentially complete. this is not deception, it is the cheapest available output, and it is indistinguishable from success if the only evidence is prose.

**attention collapse.** the run escalates too often, the human stops reading, and the escalation channel becomes a log file nobody opens. the org is then unsupervised while believing it is supervised, which is worse than being openly unsupervised.

## leases instead of calendars

the direct answer to entropy is that **nothing is scheduled by assignment**. no seat has a shift written in its name. a seat holds a **lease** on a tier, the lease has an expiry, and the holder renews by proving it is alive.

the consequences are worth spelling out:

- a dead holder becomes a free seat by elapsed time, not by someone noticing. the recovery path does not depend on a monitor that might also be dead.
- two holders cannot exist, enforced by the store rather than by convention, so split-brain is a constraint violation instead of a mystery.
- renewal carries a heartbeat and a statement of what it is doing. a lease that renews without progress is a lease that is spinning, which is a distinct and visible failure.

calendars are the alternative and they fail exactly once, quietly: the day nobody is assigned and the system keeps reporting green.

## horizons

every objective and every tier carries a horizon, and a child's horizon may not exceed its parent's. this is the cheapest anti-drift measure in the system, because it makes an impossible deadline structurally unrepresentable. a tier that wants six weeks does not get to write six weeks under a four week parent. it gets four, and the tension surfaces as a scheduling problem instead of a silent lie.

a horizon is also not a target. it is the point at which the objective is due for *judgment*: met, failed, renegotiated by an ancestor, or retired. an objective that reaches its horizon without a verdict is a bug in the loop, not a task that ran long.

## the human budget

"minimal human in the loop" is usually read as a goal. it is better read as a **budget**. the human has a fixed amount of attention, and every escalation spends it. an org that escalates twelve times a day has a human in the loop continuously, whatever the diagram says.

so escalation is rationed by construction:

- escalation requires a decision the org cannot make, stated as a question with options, not as a status.
- the org must say what it will do if no answer arrives, and it must be a safe default.
- the count of open escalations is a health metric, not a queue length. a rising count means the authority model is too tight somewhere upstream.

a run that spends no human attention for a month is not one that never needed a decision. it is one that made the decisions small enough, early enough, that no answer was worth blocking on.

## night shift

autonomy is not uniform across the day. the org has a cheap, scheduled, low-authority mode and an expensive, attended, high-authority mode, and they share one core. the night shift is where the boring work belongs: scans, tests, backfills, the tasks whose failure mode is "it will run again in an hour".

the reason to split them is not cost, it is consequence. a cheap worker at three in the morning should not be able to deploy, not because it is less capable but because nobody is awake to notice it succeeding wrongly.

## what breaks without this

without leases, the month ends with a gap nobody saw. without horizons, drift is legal. without a metric per objective, completion is a claim. without a human budget, the escalation channel decays into noise and the org is unsupervised while reporting that it is not.

## what we do not claim

that a month is the right horizon for most work. most work wants a day, and this machinery is overkill for it. the month is the stress case that forces the design to be honest, in the same way that a distributed system is designed for the partition rather than the happy path.
