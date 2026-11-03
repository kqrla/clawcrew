# drift

seven ways this build can wander, each with the specific counter. the list is not hypothetical: five
of the seven have already been observed in this repository, and the counters exist because of that.

| # | drift | how it looks | counter |
| --- | --- | --- | --- |
| 1 | **substitution** | building the tooling the product needs instead of the product | the phase gate: `every_slice_shipped_once` needs an artifact per slice, not a framework |
| 2 | **broadening** | "while we're here" adds a second customer segment or a second product | one sold thing per project; a second thing is a second project with its own ceiling |
| 3 | **metric narrowing** | the number improves because the offer shrank | the metric is defined by the provider's record, and the offer is named in the objective |
| 4 | **phantom progress** | roadmaps counted as capability | `the future is a plan, never a fact` (`directive/readme.md`) |
| 5 | **polish recursion** | the third rewrite of a document nobody reads | attention has a ceiling too: one pass, then it ships or it is cut |
| 6 | **scope creep by evidence** | a slice quietly claiming a kind it does not own, so its work counts | the ontology's `kinds` are versioned and the acceptance gate is per kind |
| 7 | **drift by silence** | a dimension nobody measured, so nobody noticed it stopped | the auditor's `unverifiable` is an alert, not a blank |

## the one that has actually bitten

**substitution** is the failure mode of this project, in the most literal way. the first build of the
database layer was a week of scaffolding before a single business had a number it could trust. the
counter is not discipline, it is ordering: build the gate first, the business second, and let the
gate tell you what the business needs.

## how a drift gets recorded

a drift is a finding, with a date and the decision that caused it, not a hindsight paragraph. when
the org catches itself, the catch is worth more than the correction: it is the only evidence that
the counter works.
