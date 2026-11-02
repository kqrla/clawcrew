# 30 · the project lifecycle

tasks are hours. objectives are months. a **project** is the thing that has to survive being run
for thirty days by seats nobody is watching, and it is the only object in the system that spans
more than one clock.

test 1 is `meenible`: a B2C business selling custom 3D-printed collector figures, built and operated
by the factory. its brief lives in `test-projects/meenible/`. the project record is the factory's
statement of what that business is, what it charges, what it may spend per unit, and what would make
it stop.

---

## 1 · the problem a project solves

without this layer the org has two timescales and a hole between them.

| object | horizon | who owns it | what happens when it goes wrong |
| --- | --- | --- | --- |
| task | minutes to hours | a seat, under a lease | reclaimed, re-queued, attempts spent |
| objective | weeks | a tier | report fails, gate stays shut |
| **project** | **months** | **the operator** | **killed by a criterion declared before it started** |

the hole is where a month gets spent on a business that cannot work. every control in docs/01–29
keeps a *seat* honest: leases, evidence, gates, admissible reports. none of them can notice that
the whole enterprise is unprofitable, because profitability is not a property of a task. it is a
property of the project, and it only becomes visible when the project is a record with a cost
ceiling and a kill criterion instead of a folder of work.

## 2 · the chain

```
inception ──▶ build ──▶ assemble ──▶ launch ──▶ operate ──▶ review ──┬─▶ closed
                                                                      └─▶ killed
```

seven phases, six gates, and no phase skips another. the last gate has two exits and no third:
`review` resolves to `closed` or `killed`. **"continue" is not one of the options**, which is the
entire point: a business that neither works nor ends is how a month becomes a year, and it is the
failure mode [03](../concept/03-no-sunk-cost/readme.md) exists to prevent.

## 3 · the gates

a gate is a list of named conditions evaluated as pure functions over rows plus a small set of
facts. it returns `ok`, or it returns the unmet conditions with their detail, so a refusal is
legible to a human and actionable to a model.

### inception → build

| condition | refuses when |
| --- | --- |
| `composition_closed` | a slice's `requires` is not provided by another slice in the set |
| `objectives_present` | a slice names an objective that is not in the ledger |
| `objectives_externally_measured` | an objective's source is `self`, is self-reported, or has no baseline or target |
| `kill_criteria_too_thin` | no criterion names a condition someone could check ("it fails" is not one) |
| `no_unit_cost_ceiling` | the project has no per-unit ceiling |
| `price_not_above_ceiling` | the price is at or below the worst cost the project would accept |
| `metrics_verified` | any slice objective has no accepted reading: never run, run by the owning tier, stale, or measured against a source that has since changed |
| `objectives_corroborated` | a slice objective declares no second expression, declares the same one, or declares prose |
| `sources_distinct` | two objectives read the same expression |

the second row is the plug-and-play check from [29](29-slice-ontology.md) promoted to a gate: a
business is a set of slices, and a set that cannot cover its own contracts is not startable. the
third is [07-provenance](../concept/07-provenance/readme.md) applied to ambition: an objective the
owning tier measures itself is a mood.

### build → assemble

| condition | refuses when |
| --- | --- |
| `every_slice_shipped_once` | any slice has no completed task with a resolvable reference |
| `no_open_harness_refusals` | the build pipeline is still rejecting recipes |

"shipped once" is deliberately weak and deliberately not negotiable: ten slices, one artifact each,
proved by a reference. it is the difference between an org that has opinions about all ten
surfaces and one that has touched them.

### assemble → launch

this is where the business is either real or is a landing page.

| condition | refuses when |
| --- | --- |
| `end_to_end_artifact` | no artifact went through the whole pipeline (recipe → validated mesh) |
| `live_quote` | the per-unit cost is an estimate rather than a number from a fulfilment house |
| `unit_cost_under_ceiling` | that number exceeds the ceiling declared at inception |
| `unit_margin` | price minus quote falls below the margin floor declared at inception |
| `all_parts_licensed` | any part's licence record is missing or unreadable |
| `payment_rail_verified` | money has not actually moved through a verified rail |

`unit_margin` exists because a cost ceiling alone cannot catch an underpriced business: with a $45
ceiling and an $89 price, any acceptable quote clears a 40% margin, so the quote binds first and the
margin is a guard rail. lower the price to $60 and the same $44 quote is inside the ceiling and still
loses money on every order. the gate reports both numbers rather than a verdict.

three of these are the three things that kill this particular business, and none of them is
taste. the colour economics question is `unit_cost_under_ceiling`, checked against a live quote.
the IP question is `all_parts_licensed`, checked per part at the catalog index. the
repose-versus-printability question is `no_open_harness_refusals` one phase earlier. writing them
as prose in a brief is how they get skipped; writing them as gate conditions is how a month does
not get spent not knowing.

### launch → operate

| condition | refuses when |
| --- | --- |
| `support_closed_by_other` | the support queue's own author is closing its tickets |
| `docs_page_resolves` | the documentation url does not resolve |
| `oncall_lease_held` | nobody holds the pager under a live lease |

### operate → review

| condition | refuses when |
| --- | --- |
| `operated_a_month` | `phase_started_at` is less than 30 days old |
| `metric_sampled_daily` | fewer than 30 metric samples exist |

thirty days of ticks with three samples is not a month of data, and a project cannot be judged on
it.

### review → closed | killed

| condition | refuses when |
| --- | --- |
| `readings_agree` | any objective's primary and crosscheck are unverified or disagree beyond tolerance |
| `audit_agrees` | the auditor's independent number does not match the primary one |
| `verdict_reachable` | `metricMoved` is unknown |

`metricMoved` is the last sample against the baseline declared at inception, beyond the noise
floor declared at inception. it is a boolean because the computation belongs to whoever owns the
metric; what the gate insists on is that the boolean exists and that a second party agreed with
the number underneath it.

## 4 · stopping is a declared decision, made before the cost exists

```ts
kill(project, criterion, reason)   // throws kill_criterion_not_declared
                                   // throws kill_reason_too_thin
```

a project can only be killed on a criterion it declared at inception. this is not bureaucracy: it
is the only thing that stops a bad week from ending a business, or a good week from extending a
sunk cost. the reason travels with the kill and is written to the phase log, because "we stopped"
without "because" is the least useful row a system can produce.

test 1 declares three:

1. no printed figure can be produced under the ceiling from a live quote
2. any part ships without a licence record
3. the harness refuses more than 1 in 20 recipes after two repairs

each one is a condition someone can check, each one is evaluated by a gate above, and any one of
them firing is enough to kill.

## 5 · what is built

- `src/domain/project.ts`: seven phases, six gates, `evaluate`, `advance`, `kill`, and
  `validateProject`. every condition id is stable, and every refusal carries its detail.
- migration `20261101000004_project.sql`: `project`, `project_slice`, `project_phase_log`, and
  `task.project_id`. three constraints hold at the storage layer, so a project with no kill
  criteria or no cost ceiling cannot be inserted by any code path, including a bad one.
- three views: `project_slice_unbacked` (a slice named at a version the ontology does not have),
  `project_slices_without_done_work` (the build gate as SQL), `project_launch_risk`.
- `meenible` seeded live: ten slices at ontology v1, eleven objectives whose sources are all
  executable expressions, an $89 price against a $45 ceiling with a 40% margin floor, three kill
  criteria, phase `inception`.
- 41 tests in `test/project.test.ts`, including the ones that matter: a $61.50 full-colour quote
  against a $45 ceiling blocks launch, a $44 quote under a $60 price blocks launch on margin alone,
  one unlicensed part blocks launch, an unread licence count is not zero, an objective whose
  `source` names a team instead of an expression never opens the gate, a support queue closed by its
  own author is not operating, and `review` cannot resolve to "continue".

## 6 · what is not built, and the seam that matters

**nothing advances a project automatically.** the gate is pure, tested, and honest, and the
scheduler does not evaluate it. a project moves when something calls `advance`, and today that
something does not exist. this is the same shape of gap as the worker side before docs/25: the
mechanism is correct and unexercised.

**the facts are the weak seam.** a gate that trusts a boolean somebody wrote is exactly the
self-reporting problem [25](25-liveness-and-custody.md) spent a document removing, reintroduced one
level up. `paymentRailVerified` is only as good as the adapter that set it; `all_parts_licensed` is
only as good as the catalog index. so each fact needs a **named producer**, and the gate should
record which one answered:

| fact | the only acceptable producer |
| --- | --- |
| `liveQuoteUsd` | the fulfilment adapter, holding a real quote id |
| `unlicensedParts` | the catalog index, over every part in the shipped recipe |
| `paymentRailVerified` | the provider, via an object that exists and is attributed to this project |
| `supportResolvedByOther` | the support slice's own close event, with two distinct actor ids |
| `metricMoved` | whoever computes the metric, from the source declared on the objective |

until each fact has a producer and a stored provenance, these gates are a specification of
honesty rather than a guarantee of it. the difference is worth writing down rather than papering
over: a gate that cannot say *who told it* is a gate a clever seat can satisfy by asserting.

**a source can be executable and still be wrong.** `source_executable` proves the metric *can* be
computed; it does not prove the expression measures the thing the statement claims. ten `sql:`
strings that all return a plausible integer would satisfy every gate in this document, and nothing
here would notice they measured nothing. that wants a test value per objective, recorded at
inception: a source that has never returned a number is a source nobody has run.

**phase history is text, not identity.** `project_phase_log.actor` is a string. it should be an
Ed25519 card id, like every other attribution in the system.

**no per-slice budget.** tiers carry a decorative `budget` seed; a project has a unit ceiling and
no spend ceiling, so a business can be unprofitable per unit and still burn a month of compute
before anybody notices. that is the next control, and it is the one that makes the dark factory
survive a project that is merely mediocre rather than obviously broken.
