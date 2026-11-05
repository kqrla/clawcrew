# 47 · the auditor on a slow clock

Weekly, not per turn. A check that runs constantly is a check that gets ignored, and a check that runs
daily on daily work just doubles the work at the same resolution.

`scripts/audit.ts` does no work and cannot spend. It counts four things into the `audit_run` row that
already existed in this database (`objectives, agrees, disputes, blind_spots, unverifiable`), and exits 3
when a count that should be zero is not. `ops/clawcrew-audit.timer` runs it Mondays at 06:00 with
`Persistent=true`, so a missed week runs on boot rather than vanishing.

## the three ways this org can be quietly wrong

| count | means | why it is not a metric |
| --- | --- | --- |
| `disputes` | a reply marked answered whose task was never signed by a second seat | the org graded its own homework |
| `blind_spots` | a stored reply whose author is unknown | it cannot be attributed, debugged, or defended |
| `unverifiable` | a spend reservation held for more than a day | a run died mid-turn and the ledger never settled |

These are not "quality" numbers. They are internal inconsistencies that no dashboard would surface, because
every one of them looks like success from the outside: the ticket is answered, the reply is good, the
container is up.

## the first audit found the two rows I left

```
audit meenible: objectives=12 agrees=5 disputes=0 blind_spots=2 unverifiable=0
audit: findings, this needs a person
```

`blind_spots=2` is `tkt.1001` and `tkt.1002`, answered before the provider column existed. In `docs/41` I
deliberately left those nulls rather than backfill a reconstruction, and said so. The auditor agrees with
that decision, and now says it out loud every week until someone decides either to backfill them with a
documented reason or to retire them. That is the behaviour I wanted from an audit: it does not fix things,
it refuses to let a known gap become invisible.

## what an audit may not do

- spend money
- write to a surface it is not the owner of
- close its own findings

Its authority is a veto plus a report. A wing with a growth target stops being a wing, and an auditor that
can fix what it finds is an operator wearing a badge.
