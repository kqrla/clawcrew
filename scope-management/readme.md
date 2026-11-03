# scope-management

not drift control. the daily question is where the next unit of effort goes, and there are exactly
three answers.

| move | looks like | costs |
| --- | --- | --- |
| **breadth** | another slice, room, feature, surface | support, catalog, surface area, dilution |
| **depth** | the same surface, measurably better | nothing new to maintain, and no visible progress |
| **thin** | breadth without depth | everything, and it reads as momentum |

the failure is never "we went too deep". it is "we shipped a fourth room while the first three had no
print-success data", and every seat in the org has a reason to prefer that: a design seat wants a
catalog worth returning to, financials wants unit economics, operations wants nothing new until the
paging stops, support wants fewer surfaces. all four are right, which is why the decision cannot be
made by whichever seat is loudest or by whichever prompt weighted last.

## the rule that keeps it honest

**depth before breadth**: a slice may not add a surface until it holds at least one depth claim with
an external metric. not a memo, not a plan: a number that moved, measured outside the seat that
moved it ([31](../docs/31-measurement.md), [32](../docs/32-corroboration.md)).

for meenible that means no fourth outfit room until the three that exist have print-success and
unit-cost readings that a witness agrees with. the gate is deliberately annoying: breadth is the move
that feels like progress, so it is the one that needs the most evidence.

## how a decision actually gets made

1. the seat that wants the move states it as a claim, with its falsifier
   ([socratica](../socratica/protocol.md)).
2. the seats whose numbers the move spends argue from their own position, and the disagreement is
   recorded rather than averaged.
3. the deciding tier reads the memo and then goes and gets evidence. the memo is advisory and cannot
   be handed to a gate.
4. if the move proceeds, it enters as a versioned objective with a metric and a target, and it can be
   retired on evidence later without rewriting the ledger.

## the pages

- [`strategy.md`](strategy.md) · the three moves, and the test for each
- [`drift.md`](drift.md) · seven ways a self-directed org stops being the same org
- [`change-control.md`](change-control.md) · how scope changes without rewriting history
- [`budget.md`](budget.md) · what a healthy month costs, and what an unhealthy one looks like
