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

## the human budget: five a month

"minimal human in the loop" needs a number or it means nothing. the number here is **five contacts per month, after setup**, where a contact is a summons rather than a notification.

that definition does the work. a weekly digest is not a contact. a status update is not a contact. a message that requires the person to decide something, or that claims to have failed loudly enough that they should look, is a contact. counted this way, five a month is roughly one every six days, and it is a hard budget rather than a target.

the consequence is a design constraint that sounds wrong until you sit with it: **the org must prefer a recoverable mistake to a question.** if the choice is between acting on a reasonable assumption and interrupting, it acts, records the assumption, and makes the action reversible. an org that asks whenever it is unsure spends the budget in the first week and then runs unsupervised while believing it is supervised.

four things follow mechanically:

- **escalation must be a question with options**, not a status. "the deploy is blocked, here are two paths with different costs" is a contact. "progress is slow" is not, and is refused by the channel rather than by etiquette.
- **the org must state its default**, meaning what it will do if no answer arrives. the default must be safe and reversible. an escalation without a default is a hostage situation, not a decision request.
- **non-urgent escalations batch.** anything that can wait a week waits and arrives in one digest, which is one contact instead of eleven. batching is the main tool for staying under five.
- **the count is a health metric.** a budget that is consistently exhausted means the authority model is too tight somewhere upstream, and the fix is a widening at the root, not a faster channel.

### breaking the budget

there is one exception and it is narrow: **money loss, security compromise, or a legal exposure** may interrupt regardless of the budget, and must be declared as that class when it does.

the exception exists because a budget without one teaches the org that a serious problem is not worth spending the month's remaining contact on. an org that hides a breach to protect its number is worse than a noisy one.

### what the budget is protecting

not the person's time, though it does. the budget protects the *meaning* of the channel. an escalation that always gets answered is a channel that carries information. an escalation that usually gets ignored is a log file, and once the org notices, it stops escalating and starts deciding everything itself, silently. that is the failure this number prevents.

## night shift

autonomy is not uniform across the day. the org has a cheap, scheduled, low-authority mode and an expensive, attended, high-authority mode, and they share one core. the night shift is where the boring work belongs: scans, tests, backfills, the tasks whose failure mode is "it will run again in an hour".

the reason to split them is not cost, it is consequence. a cheap worker at three in the morning should not be able to deploy, not because it is less capable but because nobody is awake to notice it succeeding wrongly.

## what breaks without this

without leases, the month ends with a gap nobody saw. without horizons, drift is legal. without a metric per objective, completion is a claim. without a human budget, the escalation channel decays into noise and the org is unsupervised while reporting that it is not.

## what we do not claim

that a month is the right horizon for most work. most work wants a day, and this machinery is overkill for it. the month is the stress case that forces the design to be honest, in the same way that a distributed system is designed for the partition rather than the happy path.
