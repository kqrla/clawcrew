# 09 · not doubling down

sunk cost is usually framed as a human weakness. in an agent organization it is an **accounting artifact**, and it can be designed out.

the mechanism is simple: if cost is attributed to the *team*, abandoning work makes the team look wasteful, and the team will avoid that. if cost is attributed to the *objective*, then an objective that dies takes its cost with it, and nobody is defending a budget to protect their record. the org stops having a reason to double down because it never had a stake to protect.

everything in this folder is that idea, applied three ways.

## kill criteria, written before

an objective may not start without a **kill criterion**: a number, a date, and the condition under which it is abandoned.

this is pre-registration, and its whole value is that it is written by the version of the org that is not yet invested. an org that writes kill criteria after the first bad week writes ones it can meet.

the kill criterion is checked by the tier that owns the objective, on the objective's own metric, at intervals the objective declared. not by the team doing the work, because a team asked whether it should stop is being asked to assess its own standing.

## the doubling-down detector

one number catches most of it: **cost slope against metric slope.**

- falling spend, flat metric: a loop that is winding down, fine.
- flat spend, rising metric: working. leave it alone.
- **rising spend, flat metric: doubling down.** this is the shape, and it is detectable without understanding the work at all, which is the point. two consecutive periods of it force a decision at the parent tier: change the mechanism, change the objective, or kill it. "more budget" is not among the options.

the org also refuses a retry that is not a new hypothesis. a second attempt at the same objective must name a different mechanism, or it is the same attempt with a larger bill. this rule is uncomfortable and it is the one that matters most, because the honest answer to "what will you do differently" is often "nothing, but harder", and refusing to accept that answer is the entire defense.

## effort is not evidence

two counters, kept apart:

- **spent**: what the objective has cost, in seats, tokens, and wall clock.
- **evidenced**: what has been measured, in the metric and its confidence.

they are uncorrelated in the short run, which is why an org will reliably confuse them. a month of work produces a large `spent` and no obligation at all to produce `evidenced`. the only defense is that the objective's report must lead with the second number, and that a report whose evidence count did not move cannot be described as progress, whatever else it says.

## scope drift

the adjacent failure, and the one that eats a month quietly. an objective starts as one measurable thing and ends as five, each reasonable, none measured.

three rules contain it:

1. **an objective is versioned.** adding scope is a new version with its own metric and its own kill criterion. the version number is what makes drift visible as churn rather than as progress.
2. **addition requires subtraction.** a new deliverable entering the objective removes one, or the objective's horizon moves. there is no free slot, and the org may not do both by working weekends, because the org has no weekends.
3. **the date is not an input.** an objective that is behind does not move its date; it fails, or its parent amends the objective explicitly and that amendment is recorded against the parent, not the child. receding deadlines are the single most common way a long run produces a year of plausible work and no verdict.

## the graveyard

every killed objective keeps a page: what it was, how much it cost, why it stopped, and **what would have to be true for it to restart.**

this is not sentiment. it is the only defense against killing the same good idea three times, and it is the only honest accounting of the miss rate. the miss rate matters: kill criteria will kill some work that would have succeeded, and an org that pretends otherwise is either lying about its kill criteria or never enforcing them.

a healthy graveyard has entries in it. an empty one means the org cannot stop. a graveyard that fills with objectives killed in their first day means the kill criteria are too aggressive and the org is thrashing.

## the honest cost

an org with strong kill criteria looks indecisive from the inside. work disappears, capacity is freed, and freed capacity is not automatically good news, because it means somebody has to choose what the freed seats do next ([08-prioritization](../08-prioritization/readme.md)).

the alternative is stable-looking work that nobody can justify. a month of that teaches the org that stopping is impossible, and after that it will stop nothing, including the things that would have killed the business.

## what breaks without this

without kill criteria, every objective ends at the horizon by default. without the cost slope, doubling down is invisible until the budget is gone. without a versioned objective, scope drift is indistinguishable from progress and always will be. without the graveyard, the org relearns the same lesson monthly, at full price.
