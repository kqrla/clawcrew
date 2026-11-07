# 53 · an objective that is behind can ask for work

The org could finish what it was given. Now it can ask for the next thing, which is the difference between
a factory and a queue.

```
replenish: + obj.meenible.code.repo -> code (behind_target, deficit 1) as t.meenible.code.repo.mw6s6s3w
replenish: - obj.meenible.code.repo (already_queued)
work: t.meenible.code.repo.mw6s6s3w (code) -> seat.code
```

Read the second line: the same objective, one pass later, is not given a second task. That refusal is the
whole safety property. A machine that can invent work will invent infinite work unless something stops it,
and the thing that stops it here is `WIP_LIMIT` plus `already_queued`.

## what "behind" means

Not "below target". Below target at 5% of the period is on pace. The comparison is against the clock:

```
done     = (value - baseline) / (target - baseline)
elapsed  = (now - observedSince) / (deadline - observedSince)
behind   = done < elapsed * (1 - SLACK)      // SLACK = 0.15
```

`observedSince` is the objective's **first** measurement, not its latest. Measuring from the latest run made
every objective look ahead of itself, because the period collapsed to a few days. That was the second
version of this file and it silently refused to create any work at all.

## the refusals

| why | meaning |
| --- | --- |
| `on_track` | on pace; the most common answer, and it should be quiet |
| `already_queued` | one piece of work per objective; a second is how a metric gets worse while looking busier |
| `wip_limit` | two is the bound here, per objective, regardless of seats |
| `kind_unregistered` | the objective's slice is not a kind of work the org can do |
| `no_deadline_left` | the period is over; that is a decision for a person, not more tasks |
| `no_measurement` | never measured is not "fine": the first task is to find out |

## the kind mapping, which the schema forced

Evidence kinds and work kinds are different vocabularies. `commit` is evidence of a `code` task; it is not a
kind of work. The first version handed out `commit` tasks and the `task_kind_known` constraint refused them,
which is the constraint doing its job. Kinds now come from the constraint itself, intersected with what the
objective's slice can evidence, falling back to the slice name when it is a legal kind.

Ten legal kinds: `code, design, research, security, financial, media, ops, accounting, support, doc`.

## the loop, closed

```
replenish (objective -> tasks)  ->  dispatch (tasks -> leases)  ->  work (leases -> evidence)
        ^                                                                    |
        +------------------ evidence moves the objective --------------------+
```

Each stage refuses rather than guessing. Each stage is a separate supervised job:

```
supervise.ts --job replenish --every 900000
supervise.ts --job work --every 60000
supervise.ts --job support --every 30000
```

Different clocks on purpose: replenishment is a planning act, work is a pulse, support is inbound.

## not built, honestly

There is no per-kind evidence rule. The dispatcher asks "has evidence of this kind ever been computed" and
the replenisher asks "can this slice produce a legal kind", but nothing states *what counts as done* for a
`code` task versus an `accounting` one. That rule is the thing that makes completion trustworthy for kinds
beyond `support`, where the two-signature check already exists. It is the next piece, and it is the last one
between this and an org that can run a month without being handed a queue.
