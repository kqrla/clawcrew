# 32 · one number, two expressions

[31](31-measurement.md) closed the hole where an objective could be a promise to measure later: a
source that has never returned a number is not a metric. this document closes the next one, which is
quieter and worse.

**a metric computed by one expression is self-reporting one level down.** the org writes the query
and then reads its answer and calls it the truth about the world. nothing in that loop is outside the
org. `source_executable` proves an expression runs; no constraint can prove it measures what the
statement claims. so the second expression is what turns a number into a measurement.

## the rule

every objective declares two expressions: `source` and `crosscheck_source`. they must

- be different text, and genuinely different ways to ask rather than the same query reworded,
- be run by **different runners**, so "two ways of asking the same person" does not count,
- be read recently, because last month's corroboration describes last month,
- produce numbers within tolerance of each other, default 5%.

a review verdict needs `agrees`. not `unverified`, not `disagrees`, not "close enough, probably".

## what counts as independent

| primary | crosscheck | independent? |
| --- | --- | --- |
| `git:rev-list --count origin/main --since=7.days` | `http:GET api.github.com/.../commits` | yes — the local clone and the host's own record |
| `sql:select count(*) from shipment ...` | `run:shipments report --window=7d` | yes if the report reads a different store |
| `sql:select count(*)...` | the same query with reordered whitespace | no — refused as `crosscheck_is_the_same_expression` |
| anything | anything run by `runner.gauges` twice | no — refused as `same_runner` |

the asymmetry is the point, and it is why corroboration is affordable: it needs no second team, no
auditor with domain knowledge and no human. it needs one more expression written from a different
vantage point, which for most quantities is a second system that already exists.

## gates

| phase | condition | refuses when |
| --- | --- | --- |
| inception → build | `objectives_corroborated` | a slice objective declares no crosscheck, declares the same expression, or declares prose |
| review → verdict | `readings_agree` | any slice objective's pair is unverified or disagrees beyond tolerance |

inception checks the *declaration* and review checks the *measurement*, because they fail for
different reasons. a plan that never intended to ask twice is a design fault; a pair that disagrees
at review is a fact about the world that arrived too late to be convenient.

## live

`meenible` declares eleven crosschecks. exactly one gauge runs today, and the two expressions for it
disagree, which is why this layer exists.

the metric is "deployed commits reachable on main, last seven days". the primary expression reads the
local clone: `git:rev-list --count origin/main --since=7.days`. it returned **1**. the crosscheck asks
the host: `http:GET api.github.com/repos/kqrla/orchart/commits`. it returned **25**.

the local tracking ref was 24 commits stale, because this repo pushes with an explicit URL that does
not update `origin/main`. the gauge was not lying; it was measuring a cache. a single expression would
have recorded 1, a project would have run on it, and the review would have concluded the factory
shipped almost nothing in its first week when it had shipped twenty-four commits.

`disputed_metrics` is the view a human reads: primary, crosscheck, spread, who ran each, and when.
`uncorroborated_objectives` is the one that runs at inception, and it is empty only because every
objective now names its witness.

## not built, and the honest limits

- **corroboration cannot detect a shared blind spot.** two expressions over the same wrong table
  agree perfectly. agreement is necessary, not sufficient.
- **tolerance is one number.** 5% is wrong for zero-target metrics like open security findings, where
  any non-zero is a failure and "within 5%" is meaningless. targets with `direction = 'down'` need the
  tolerance applied in absolute terms instead.
- **the runner is not in the repo.** the gauges were run by hand this turn, and `runBy` is a string a
  script asserted. until the runner is a service that writes its own readings, the independence of
  two runners is a claim about deployment, not a property the database enforces.
- **nothing alarms yet.** `disputed_metrics` is a query, not an alert. a disagreement discovered by
  someone remembering to look is a disagreement nobody has.
