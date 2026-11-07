# 52 · lease, work, evidence, release

The dispatcher handed out work it could never take back. A lease expired, the same task went to the same
seat, and nothing ever finished. This closes the loop, and the closing rule is the one that matters:

> **evidence newer than the lease**, or the task goes back.

A seat saying it is done is a claim. Evidence computed after it took the lease is work. `src/jobs/complete.ts`
is the pure judgement; `scripts/work-once.ts` settles every live lease and then dispatches.

```
work: t.dispatch.2 requeued (no_evidence) attempt 1/3
work: t.dispatch.2 (support) -> seat.support
...
work: t.dispatch.2 complete on support evidence from seat.support
work: nothing dispatched (nothing_ready)
work: settled complete=1 requeued=0 escalated=0 held=0
```

`task.state = done`, `evidence_ref = seat.support`. That is the same task, twice around the loop, once
without evidence and once with it.

## the six judgements

| situation | outcome |
| --- | --- |
| evidence for this objective, this kind, computed after the lease | `complete` |
| lease still running, nothing yet | `hold` |
| evidence exists but predates the lease | `requeue / stale_evidence` |
| evidence landed but of another kind | `requeue / wrong_kind` |
| lease expired, nothing at all | `requeue / no_evidence` |
| out of attempts | `escalate`, which blocks the task and needs a person |

Stale evidence is the one worth dwelling on: append-only evidence means last week's proof of a different
run is still lying there, and accepting it would let a seat complete a task by having done something
similar before. The comparison is against `acquired_at`, per attempt.

## settle before dispatch, not after

`work-once` settles first. Dispatch first would hand a seat a second lease while the first is unresolved,
and then two leases exist for one seat and neither completes.

## what the schema corrected, again

`JSON.stringify(name)` produces `"seat.support"`, and postgres reads double quotes as an **identifier**, so
the error was `column "seat.support" does not exist` rather than anything about evidence. Values go through
`lit()`. Third time this repo has taught me that a string and an identifier are different types, and the
first two are in `docs/41`.

## also: the supervisor can run either job

`supervise.ts --job work --every 30000` supervises the loop above; the default remains `--job support`. One
supervisor per job, because a crash in the dispatcher should not restart the support pass mid-ticket.

## since then

Replenishment exists (`docs/53`): a lagging objective now creates the task, so the loop closes.
