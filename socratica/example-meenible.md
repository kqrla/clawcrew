# the first question: which blindness do we end first

meenible has ten measures that have never returned a number. none of them can be started, so the
room is not deciding whether to build the product, it is deciding which thing to stop being blind
about. four seats argue from their own interest, and the output below is the code's, unedited.

```
npx tsx socratica/example-meenible.ts
```

## the plan

ORDER
1. g.design (score 4)
2. g.revenue (score 2)
3. g.financials (score 2)
4. g.operations (score 2)

DEFERRED
- g.research: seat.operations wants it later -> re-enters when a metric disagrees with its witness and we cannot say why
- g.media: seat.security wants it later -> re-enters when every asset is licenced and served from our own bucket

OMITTED

DISSENT (kept on the record)
- seat.operations on g.docs: docs rot when the surface moves
- seat.security on g.research: research has no external dependency yet
- seat.operations on g.research: no operational failure has ever been caused by a memo
- seat.financials on g.media: media is not on the path to an order
- seat.security on g.media: asset tooling widens the attack surface

faults: none
next dispatch: {"next":"g.design"}

## what this shows

`g.design` goes first with score 4 because security and design both want it and nobody argued
against it, and it gates launch.

`g.media` is the interesting row. security said `never`, with a falsifier. that did not delete it,
because a single voice is not a veto, so it sits in `deferred` with the condition that brings it
back, while financials' objection stays in `dissent` where a person reading this in six months can
find it.

`g.research` is postponed by operations for a reason that is itself a good test: nothing operational
has ever failed because of a memo. if that stops being true, the falsifier fires and the candidate
re-enters without anyone having to remember to argue for it again.

the queue is `g.design` first. that is what the scheduler would pull, and it is the whole point of
doing this before the work rather than after it.
