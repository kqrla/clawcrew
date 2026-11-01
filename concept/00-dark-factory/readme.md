# 00 · the dark factory

the phrase comes from manufacturing: a plant instrumented well enough that it runs with the lights off. the point was never fewer people. it was that the process was measurable end to end, so nobody needed to stand there watching it.

a dark factory for software is the same claim with a harder edge. **the org does not manage deliverables. it iterates, ships, and maintains.** that single sentence changes almost everything downstream, because a deliverable is judged once and a running service is judged forever.

## three registers, one loop

most agent organizations are built for the first register only, and it is the easy one.

**iterate** is a small change, a measurement, and a decision to keep or revert. the unit is not the ticket, it is the loop. a loop that runs in an hour and reverts cheaply is worth more than a loop that runs in a day and produces something beautiful nobody measured.

**ship** is putting a change in front of a stranger. this is the register that cannot be faked, because the evidence is another party's behaviour rather than the org's opinion of itself. an org that iterates without shipping is a very productive loop turned inward.

**maintain** is keeping a true thing true while nobody watches. it has no ending, it has a rate: time to detect, time to revert, and how much of the org's capacity is spent holding still. a maintaining org that looks idle is healthy. one that looks busy all the time is either degrading or inventing work.

the three registers are one loop with different periods. iterate is minutes to hours, ship is hours to days, maintain is forever. an org that optimizes only the first will ship rarely and maintain badly, because both of those require giving up the thing the first one rewards: another improvement.

## what a dark factory is not

not a build farm. a build farm produces the same artifact from the same inputs and its enemy is variance. a dark factory must also produce things that have never existed, so it needs an exploration budget that manufacturing never needed. this is the metaphor's real limit and it is worth stating plainly: the lights are off because the process is instrumented, not because the work is repetitive.

not a way to avoid judgment. it moves judgment earlier and makes it cheap. kill criteria, acceptance, and measurement replace the review meeting, and each of them is a smaller act of judgment performed more often.

not autonomous in the sense of unsupervised. it is supervised by its own record, and audited on a slow clock by something that is not a participant. the human is not removed, the human is spent at a different exchange rate, which is the subject of [03-autonomy](../03-autonomy/readme.md).

## why "self-directed" has to mean something specific

self-direction is not the ability to pick tasks, which any agent can do, and is indistinguishable from randomness when unmeasured.

here it means three constrained things:

- **the org chooses within a mandate.** an objective region is given, with a budget and a horizon. inside it the org allocates. outside it, it proposes. this is the difference between delegation and abdication.
- **the org re-plans on evidence.** when a metric does not move, the plan is revised by the tier that owns the metric, not by the seat that is executing it. self-direction is a property of the tier, not of the worker.
- **the org terminates itself when the objective is dead.** the hardest of the three, and the subject of [09-doubling-down](../09-doubling-down/readme.md). an org that cannot stop is not self-directed, it is self-perpetuating, and those two look identical from the outside for about six weeks.

## the shape of the thing

what follows in this folder is not a list of features. it is a set of mechanisms that each exist because the month-long version of this fails in a specific way without them.

- structure: [01-hmas](../01-hmas/readme.md), [02-org-chart](../02-org-chart/readme.md)
- endurance: [03-autonomy](../03-autonomy/readme.md)
- splitting and reconverging: [04-decoupling](../04-decoupling/readme.md), [05-collaboration](../05-collaboration/readme.md)
- the wire: [06-a2a](../06-a2a/readme.md)
- the record: [07-provenance](../07-provenance/readme.md)
- choosing: [08-prioritization](../08-prioritization/readme.md)
- not fooling itself: [09-doubling-down](../09-doubling-down/readme.md), [10-adversarial-qa](../10-adversarial-qa/readme.md)
- what each seat is allowed to know: [11-slices](../11-slices/readme.md)
- money and keys: [12-identity-and-money](../12-identity-and-money/readme.md)

## what breaks without this framing

if the org is built for deliverables, it finishes, and the thing it built begins to rot while the org reports on the next deliverable. the rot is invisible because nobody owns a surface that nobody is delivering. every failure in the rest of this folder is downstream of that one.
