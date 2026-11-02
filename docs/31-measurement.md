# 31 · measurement

## the hole this closes

`docs/07` says every objective needs an executable source, and the database enforces it:
`objective.source ~ '^(sql|http|git|run):.+'`. That constraint proves a metric *can* be
computed. It does not prove anyone computed it.

The failure it leaves open is cheap and quiet: an agent writes ten plausible `sql:select count(*)`
strings, the objectives look instrumented, the ledger passes every check in `docs/30`, and the
project runs for a month while nothing is measured. The evidence is consistent with success because
there is no evidence.

## the rule

**a source is a promise. a reading is a measurement.**

a reading is a row: the source string that was run, the number it returned or the error it threw,
when, and who ran it. `acceptReading` refuses a reading unless all of the following hold:

| condition | refusal |
|---|---|
| a reading exists at all | `no_reading` |
| the run succeeded | `source_failed` (with the error kept) |
| the source is the one declared today | `source_changed_since_reading` |
| the value is a finite number | `value_not_a_number` |
| the runner is not the measured tier | `self_measured` |
| the reading is inside the freshness window | `reading_stale` |
| the reading is not from the future | `reading_from_the_future` |

`source_changed_since_reading` is the one that matters most. without it, an objective could quietly
change what it measures and inherit the credibility of a reading taken against the old expression.
a metric is not the id, it is the expression.

## one gauge cannot be two metrics

`sources_distinct` refuses a project whose objectives share a source. ten objectives reading
`select count(*) from orders` is one number wearing ten hats, and copy-pasting a source is the
cheapest way to look measured. this is a refusal rather than a warning because there is no innocent
version of it.

## what running it looks like

meenible was seeded with eleven objectives and eleven executable sources. running all of them:

```
ok    obj.meenible.code.repo              1
fail  obj.meenible.design.studio          no such entry point: catalog
fail  obj.meenible.research.analysis      no such entry point: sheet
fail  obj.meenible.security.controls      no such entry point: scan
fail  obj.meenible.financials.rails       http 401
fail  obj.meenible.media.studio           no such entry point: asset
fail  obj.meenible.operations.runtime     no such entry point: check
fail  obj.meenible.accounting.books       relation "ledger_unmatched" does not exist
fail  obj.meenible.support.inbox          relation "ticket" does not exist
fail  obj.meenible.documentation.site     no such entry point: docs
fail  obj.meenible.revenue                http 401
```

one working gauge. that is not a failure of the factory, it is the factory's first finding: the
business has one instrument and ten intentions, and inception does not pass until that changes. the
`unverified_metrics` view is therefore the org's first work queue, and every row in it is a named
blocker rather than a missing item on a checklist someone wrote.

the honest next move is not to lower the gate. it is that building the gauges *is* the first
deliverable of the project: a script that exits non-zero when a licence is missing, a `ticket` table,
a stripe key in a secret, a docs crawler. each is a task with an evidence kind from `docs/29`, which
is why the ontology had to exist before this gate was worth having.

## what is still weak

- **freshness is 24 hours, and one tick is ten minutes.** a metric that moved at 06:00 and was
  measured at 06:01 is trusted until the same time tomorrow. for a month-long review window that is
  fine; for a live launch it is not, and the window should be per objective.
- **no cost accounting.** running eleven `run:` sources every tick is free until it is not. the gauge
  layer has no budget, and `docs/27` built the reservation machinery for exactly this.
- **a reading proves the expression ran, not that it measures the statement.** `select count(*) from
  orders` returns a number whether or not those orders are the ones the objective is about. closing
  that needs a second, independent source per objective and a disagreement alarm, which is the
  auditor's job in `docs/03`.
- **nothing runs the gauges on a schedule.** the runner exists as a script; the tick does not call
  it, so freshness decays to stale and inception stays blocked. that is the correct default until
  the gauge layer has a budget.
