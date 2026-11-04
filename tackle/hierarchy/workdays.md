# workdays: parallel shift vs relay race

Two ways a day of work can be shaped. They are not interchangeable, and the failure is always the same
one: applying the scheduling shape of the other and getting either an idle org or a stalled one.

## the parallel shift

Everyone works at once, each on their own slice, from a snapshot. Nothing waits on nothing.

- **fits:** independent slices, bulk production, review queues, anything where the work is the same
  shape many times (answer tickets, draft 20 city tables, close the month).
- **needs:** a real isolation boundary (slices), a convergence step at the end, and a cap per seat so
  one seat cannot spend the org's day.
- **fails when:** two shifts touch one surface. Then you get divergence with no merge, and the second
  shift's work is thrown away or, worse, silently overwrites the first.

In this repo the shift is the model: seats hold grants per slice, a surface lock serialises the rare
overlap, and convergence runs on a slow clock rather than after every turn.

## the relay race

One task, passed along. Each leg is a different seat doing a different job, and the baton is the
artifact, not a summary of it.

- **fits:** work with a real ordering (implement, then review, then deploy), work where the second step
  needs the first step's *output* rather than its *intent*, and anything a human has to touch once
  (approve a payment, sign a contract).
- **needs:** an explicit acceptance at each handoff. A vaulter who drops the baton should be told, not
  silently disqualified. Every handoff therefore has three outcomes: accepted, bounced with a reason, or
  timed out and escalated. There is no fourth "probably fine".
- **fails when:** legs are asynchronous without a deadline, because the race then stalls quietly with
  every seat believing it did its leg.

The failure mode is worth stating plainly: a relay that stalls looks exactly like a relay that finished,
if nothing records the handoff. So handoffs are rows, with a state and a deadline.

## how to choose

Ask what the *next* leg needs.

- If it needs the previous leg's artifact (**the output matters**): relay. Sequential, with acceptance.
- If it needs only the snapshot and the rules (**the intent is enough**): shift. Parallel, with
  convergence.

Most real days are mixed, and the honest structure is a relay of shifts: a stage runs parallel across a
department, converges, then passes one baton to the next stage. What must never happen is a stage that
is *secretly* a relay (one seat waiting on another without a recorded handoff) or *secretly* a shift
(two seats on one surface, racing to write last).

## time as an input, not an ambient condition

- **budget:** each task carries money, turns, and wall clock. Exhausting any one is a refusal, and the
  refusal happens before the spend, not after.
- **lease:** a claim is time-boxed with a heartbeat. A holder that stops heartbeating loses the task, so
  a dead process cannot hold a customer forever. This is the only defence against the quiet outage: the
  org appears to be working because a ticket says `answered`, and nothing is happening.
- **slow clocks:** audit and cross-checks run weekly, not per turn. A check that runs constantly is a
  check that gets ignored.
