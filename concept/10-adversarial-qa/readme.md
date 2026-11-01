# 10 · adversarial qa

the failure this folder exists for is one sentence long: **an organization that grades its own homework will always pass.**

not through dishonesty. a builder writing its own test writes the test that matches what it built, including its misunderstandings. the test suite is then a second copy of the same mistake, and it is green, and green is treated as evidence. this is the most expensive error in the system because it compounds: every subsequent change is validated against a misconception that now has tests.

## separation, and what exactly is separated

"independent qa" usually means a different team. that is necessary and not sufficient, because a qa team that shares the builder's briefing shares the builder's blind spot.

three separations are needed, and they are all structural rather than procedural:

**different seat, different tier.** the certifier is not the author and does not report to the author. it reports to the tier above both, so a refusal cannot be overruled by the party being refused.

**different briefing.** qa does not receive the design. it receives the interface contract and the objective's metric. an adversarial tester that knows why a decision was made will test the decision, and the decision is not what ships. this is the one place where the slices from [11-slices](../11-slices/readme.md) must be *narrower* than comfortable.

**different clock.** qa runs on its own schedule against the artifact, not inside the build. a check that runs as the last step of the pipeline is a check the pipeline can skip.

## runtime, not lab

the accepted evidence is what the thing did under load it did not choose, not what it did in an environment built for it.

in practice this means the org tests its own product the way a customer would: against the deployed surface, with the org's own agents as traffic, in a sandbox that mirrors production closely enough that a pass there predicts a pass here. the mirror is the hard part and it is worth paying for, because a test environment that diverges from production does not test the product, it tests the divergence.

three gates, cheapest first:

- **canary.** a change goes to a slice of real traffic. the metric is not "no errors", it is "the objective's metric did not degrade".
- **shadow.** the new path runs beside the old one on the same input and the outputs are compared. disagreements are findings even when both look fine.
- **revert first.** the default response to an unexpected signal is to undo, then investigate. an org that investigates before reverting spends its maintenance budget on archaeology.

## the adversarial team has a perverse incentive

a team whose job is to find failures can produce failures. so its metric is not "bugs found", which rewards volume and theatre, but **escape rate**: defects that reached a customer. that number can only go down by finding things early, and it cannot be gamed by writing reports.

paired with it, a false-alarm rate, so the team cannot buy a low escape rate by blocking everything. the two together are the whole incentive design, and neither alone works.

## breaking your own code on purpose

a passing test suite proves the tests ran. it does not prove they would notice if the code were wrong.

so the org periodically **mutates itself**: small deliberate faults injected into a surface, checking that the tests fail. a mutation that survives means the coverage is decorative, and the finding is not "a test is missing", it is "this surface is untested and we believed otherwise".

this also applies to the org's own infrastructure, not just product code. the scheduler, the relay, the deduplication, the lease expiry: each gets the same treatment, because those are the components whose failure is silent by construction.

## hostility toward the handoff chain

a relay chain is a place where work is assumed rather than checked. so qa attacks the chain itself:

- deliver the same envelope twice and confirm the effect happened once.
- deliver it late, past expiry, and confirm it was dropped rather than applied.
- deliver it from a seat that does not hold the crossing, and confirm it was refused and recorded.
- kill a lease mid-task and confirm the seat is reclaimed rather than lost.

these are the tests that matter most for a month-long run and the ones least likely to be written by whoever built the happy path.

## what qa does not do

does not grade the design. a certifier with opinions about architecture becomes a second author, and the org now has two builders and no certifier.

does not block on style. blocking on taste trains the org to route around qa, and a routed-around qa is worse than none because it produces a record of assurance that is not assurance.

does not run on the same credentials as the builder. read access to the surface, write access only to findings.

## what breaks without this

without separation, the org's evidence is its own opinion with a timestamp. without runtime gates, defects are found by customers, which is the most expensive possible detection and the only one that produces churn. without mutation, coverage is a number that goes up while confidence should go down. without escape rate as the metric, the adversarial team optimizes for the appearance of vigilance.

## what we do not claim

that adversarial testing finds everything. it finds the things that a hostile, informed party finds quickly, which is a large and useful subset and not the same as correctness. the residual risk is real and the audit in [07-provenance](../07-provenance/readme.md) is what eventually catches the rest, at the cost of catching it late.
