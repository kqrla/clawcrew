# 43 · supervision

A loop that only runs while a terminal is open is a demo. Supervision answers three questions, and a row
answers all three: is anything running, when did it last do something, and did it stop for a reason that
needs a person.

## the policy, as a pure function

`src/jobs/supervise.ts` decides, `scripts/supervise.ts` obeys. The separation exists because "restart it"
and "stop and shout" are the two decisions that matter and they should be arguable in a test rather than
buried in a shell script.

| exit | policy |
| --- | --- |
| 0, nothing crashed | stop, `finished`, no page |
| non-zero after a real run | restart with backoff 1s, 2s, 4s… capped at 60s |
| non-zero, instantly, twice | stop, `crash_loop`, page |
| non-zero three times running | stop, `failing`, page |

The fourth row was added after watching the first version restart a 401 five times at 23 seconds a go.
Uptime alone is the wrong signal: a child that keeps failing is failing, whether each attempt took a second
or half a minute.

## the heartbeat, and the page

`runner_heartbeat` is one row: state, time, cycles, detail. `scripts/health.ts --max-age-ms` reads it and
exits 3 when the state is `stopped` after a page, or when a `running` heartbeat is older than the window.
That is the whole paging primitive, and it is deliberately a query: a supervisor that only exists as a
running process cannot tell you that the supervisor died.

## what the run showed

```
[supervisor] restart in 1000ms (exit 1, 23422ms)
[supervisor] restart in 2000ms (exit 1, 23338ms)
[supervisor] restart in 4000ms (exit 1, 22945ms)
[supervisor] stopped: failing (this needs a person)
exit=3
state=stopped cycles=23
```

a bad key, a real ticket, and the ticket came back to the queue each time: `tkt.1007` was `open` after the
page, not stranded.

## the bug the page caught

`tkt.1007` then failed verification: the model's reply cited "order 4481" and never mentioned `tkt.1007`.
The verifier was demanding an internal ticket number from a customer-facing reply, which was my rule and it
was wrong. A reply now identifies the ticket by its id **or** by the order reference the customer knows.
This is the loop working as designed, and it is also a reminder that a check can be too strict in exactly
the way a check can be too lax: both produce work that never finishes.

## still not true

Nothing watches the watcher. `supervise.ts` is itself started by hand, so the heartbeat goes stale and
`health.ts` will page, but only if something runs `health.ts`. The honest next step is a cron or a platform
schedule running health, and a supervisor that is a service rather than a script.
