# test 1: custom 3D figures, B2C

the first business the factory builds and runs. not a demo of the org: the workload that either
produces a gate worth having or reveals one that is missing.

- `brief.md` — what the business is, the architecture, and the three things that would kill it
- `build-contract.md` — the catalog header convention, the generated driver, the repair loop, golden hashes
- `recipe.schema.json` — the only artifact a model is allowed to emit
- `harness/` — gate 7 of the print harness, runnable with no CAD toolchain (`python3 harness/test_stlcheck.py`)

## the project record, as seeded

```
project        test-01.figures          phase: inception
objective      obj.figures.revenue      metric: paid orders (stripe.charges)  0 -> 25
unit ceiling   $22.00                   per shipped figure, from a live quote
kill criteria  3                        cost, licence, harness refusal rate
slices         10                       each with its own objective and external source
```

the three killers are gate conditions, not prose:

| what would kill it | where it is checked |
| --- | --- |
| colour economics: full-colour printing costs more than the promise | `unit_cost_under_ceiling`, against a live quote |
| IP: a character, a trade-dress silhouette, or a stranger's face | `all_parts_licensed`, per part, at the catalog index |
| repose versus printability: a posed mesh that needs supports nobody priced | `no_open_harness_refusals`, before assembly |

## what the first month is supposed to produce

not a launch. a **decided** project: `closed` because paying customers exist, or `killed` because
one of the three criteria fired with a number attached. either outcome is a pass for the factory,
and "still running in review" is the only failure.
