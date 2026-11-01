# 22 · relay logic

the relay moves an envelope across a sandbox wall. crossings decide whether a door exists (23); this is what happens once you are through it.

## 1 · the delivery contract is at-least-once

exactly-once across a process or network boundary is a lie told by people who have not been paged at 3am. the contract is:

- the relay may deliver the same envelope more than once,
- the receiver is idempotent on `dedupeKey`,
- and the dedupe window is 30 days, which is longer than any retry schedule.

everything else in this document follows from that.

## 2 · states

```
queued ──lease──> leased ──ack──> delivered
   ^                 │
   │                 ├──nack/expiry──> queued (attempt+1, backoff)
   │                 └──attempts exhausted──> dead
   └── ttl passed ──> expired
```

`delivered` is written by the receiver after it has persisted the envelope, not after it has read it. a message that was received but not acked is redelivered, and the dedupe key is what makes that harmless.

## 3 · leasing and visibility timeout

a worker leases a batch with `select ... for update skip locked` and a `locked_until` of 60 seconds. if the worker dies mid-delivery the lease expires and the envelope returns to `queued` without any coordinator noticing. no heartbeat, no session, no reaper process.

this is the same mechanism as shifts (05), applied to a smaller unit of time. it is the same mechanism on purpose: one way of answering "who is holding this right now", used everywhere.

## 4 · backoff

`delay = min(cap, base * 2^attempt) * jitter(0.5..1.5)`, defaults `base = 2s`, `cap = 15m`, `max_attempts = 8`.

retries stop before the envelope's ttl. if `now + delay >= expiresAt`, the next step is `dead`, not another retry. retrying into an already-expired envelope burns budget to deliver something the receiver is required to reject anyway.

## 5 · the dead letter is a finding, not a silence

after `max_attempts` or an unavoidable ttl breach, the envelope goes to `dead` and:

1. an event is written with the full attempt history,
2. a `undelivered` finding is raised against the **sender's** tier,
3. the sender's manager sees it in the next briefing.

undelivered is terminal. it is never retried by a background sweep, because a message that failed eight times with backoff is not a scheduling problem.

## 6 · hop bound and loop detection

the envelope carries `path: string[]`, the tiers it has already visited.

- append the sender on every hop,
- refuse if `to` is already in `path` (`loop_detected`),
- refuse if `path.length >= maxHops` (default 3).

three hops reaches a sibling team through one coordinator and back. five hops is a conversation nobody is steering.

## 7 · ordering

per `(from, to, crossing)` the relay is fifo by a monotonic `seq` assigned at enqueue.

that is the entire ordering guarantee. there is no cross-tier causal ordering, and there is no total order. a consumer that needs causality asks for a **state reference**, not a delta:

```
payloadRef: "state://objective/obj.activation@v7"
```

this is the general answer to distributed ordering: do not order messages, make them idempotent against a versioned state. a relay that tries to preserve global order is a distributed consensus problem wearing a message bus costume.

## 8 · receipts

a delivery receipt is itself an envelope of kind `receipt`, queued back on the reverse crossing.

consequences worth stating: receipts cost a crossing, receipts of receipts are not sent (`kind: receipt` never generates one), and a receipt crossing must exist or the sender never learns delivery happened. that asymmetry is deliberate, so that "may I know you received this" is a separate permission from "may I send to you".

## 9 · what an envelope may carry

`payloadRef` only. never prose.

the reasons are mechanical, not aesthetic: refs are content-addressable so the same payload can be deduped, diffed and replayed; prose cannot be searched by hash and cannot be re-verified later. a summary is a claim about a state, and claims do not survive the audit.

permitted ref schemes: `artifact://` (blob), `state://` (versioned record), `issue://` (projection), `bookmark://` (source).

## 10 · backpressure

per crossing, the queue depth is capped (default 500). at 80% the relay signals `slow` to the sender's tier; at 100% it rejects new envelopes with `backlog_full`.

slow is a warning to the sender, not a throttle the relay applies. the sender's tier is the only party that can reduce production, and it should be told before it is stopped.

## 11 · the delivery loop

```
loop every 5s:
  lock the scheduling lock (advisory); skip if another ticker holds it
  reclaim: update relay_message set state='queued' where state='leased' and locked_until < now()
  lease:   select id, ref from relay_message where state='queued' and next_attempt_at<=now()
           order by priority, seq  limit batch  for update skip locked
  deliver: for each, hand to the transport for its target tier
  settle:  ack | nack(backoff) | dead | expired
  heartbeat: write ticker_heartbeat(at, tick_count, lag_ms)
```

every step is idempotent, and the loop holds no state between iterations. stopping it is safe at any point.

## 12 · what the relay is not

- not a broadcast bus. one sender, one receiver, one crossing.
- not a chat. there is no membership, no history for humans, no presence. that is the projection's job (16).
- not the a2a boundary. a2a terminates at a port and becomes an envelope (18); the relay never speaks json-rpc.

## 13 · metrics that matter

- `relay_dead_total` by crossing. nonzero is a door problem or a receiver bug, never an infrastructure problem.
- `relay_redelivery_rate`. dedupe absorbs it, but a rising rate means ack is happening after the work, not after the persist.
- `relay_lag_p95` per crossing. the number that tells you a month-long org is still responsive.
- `relay_backlog_full_total`. the door is too narrow. raise the cap or split the crossing.
- `receipt_missing_total`. sends with no receipt after a full retry window. this is how you find an unmonitored one-way door.
