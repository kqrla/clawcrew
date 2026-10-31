# 05 · shifts, leases and handoffs

## calendars are the wrong source of truth

the obvious design is a per-agent calendar: this seat is on call tuesday, that seat owns the deploy window. it fails quietly, because a calendar records an intention, and an agent that dies does not update its own calendar. the result is a slot that looks staffed and is not.

so the calendar is a **view**. the source of truth is a lease.

## lease

a lease is a time-boxed, exclusive claim on a responsibility.

```yaml
lease:
  id: lease.77a
  circle: eng.platform.infra
  responsibility: oncall        # oncall | batch | release | review | intake
  holder: seat.infra-oncall
  acquired_at: 2026-10-31T08:00:00Z
  expires_at: 2026-10-31T16:00:00Z
  heartbeat: 15m
  max_renewals: 2
  state: held                   # held | released | expired | revoked
```

rules:

- acquiring a lease is atomic. two holders on an exclusive responsibility is impossible, not discouraged.
- the holder must heartbeat. a missed heartbeat past the grace window expires the lease.
- expiry is an **event**, not an absence. it fires the pager for the responsibility.
- renewal is bounded. a seat cannot hold the same responsibility forever without a rotation decision, because a seat that never rests accumulates context nobody else has.
- a lease on a responsibility owned by another circle requires an active secondment.

### escalation on a missed lease

```
lease expires
  → page the next scheduled holder            (immediate)
  → if unclaimed in 10m: page the circle manager
  → if unclaimed in 30m: page the parent manager
  → if unclaimed in 60m: create an a2 approval card for a human
  → if still unclaimed at 4h: suspend the responsibility and mark its
    surfaces read-only, so nothing proceeds unowned
```

the last step matters more than it looks. an unowned responsibility that keeps accepting work is how a business accumulates changes nobody authorized. suspending is the safe default, and it is loud.

## relay versus parallel

the same primitive covers both modes, with different invariants.

### relay (on-call, release, intake)

exactly one holder at a time. work is handed forward when a task completes, so the next agent picks up without waiting for a human.

the invariant is **no gaps**: at every instant, the responsibility has a holder, or an alarm is open. the handoff window is derived from the lease ttl, and the next lease is offered *before* the current one expires. overlap is cheaper than a gap.

### parallel (independent tracks that converge later)

N holders, work divided by a partition key: tenant, region, file set, customer segment, feature area.

the invariant is **no orphans**: the partition map is exhaustive, and every partition has exactly one owner. a partition with no owner is an alarm, not a gap. unlike relay, parallel mode can tolerate zero holders on a partition for a bounded window, because the work is not time-critical.

convergence is a separate event. the integration gate is owned by the parent circle and refuses to close until every partition reports either a result or an explicit `not_applicable` with a reason. silence is not a result.

## handoff

the atomic unit of coordination in the whole system.

```yaml
handoff:
  id: hof.5c9
  from: seat.ci
  to: seat.qa
  precondition: "deploy.staging.status == green"
  payload_ref: artifact://builds/1f2a   # state, not prose
  acceptance_required: true
  timeout: 30m
  state: offered                # offered | accepted | rejected | expired | undelivered
  rejection_reason: null
```

rules:

- **payload is a reference.** no free-text summary field exists in the schema. the receiver reads the artifact. summaries are for humans in the audit, and they are generated after the fact.
- **acceptance is an affirm.** a read receipt is not acceptance. the receiver checks the precondition and accepts or rejects with a reason.
- **timeout is mandatory.** an unaccepted handoff expires and bounces to the sender, which must re-offer or escalate.
- **undelivered is a terminal state that alarms.** it means the sender tried and the transport failed, or the receiver no longer exists. it is the classic silent drop and it must be a first-class row, not an absence.

## what a handoff is not

- not a message. a message may accompany it; the handoff is the transfer of responsibility.
- not a task assignment. an assignment says who should do something. a handoff says the work has already moved and someone must now own it.
- not a summary. if the receiving agent needs a paragraph to understand the payload, the payload is wrong.

## dead agent detection

the combination of heartbeat, lease expiry and undelivered handoff is the whole liveness story. there is no separate health check to forget to configure.

a seat that dies mid-task leaves:

- a lease that expires within one heartbeat window
- handoffs in `offered` that expire within their timeout
- a task in `in_progress` that the auditor flags as stale

all three are visible without anyone asking "is the agent ok".
