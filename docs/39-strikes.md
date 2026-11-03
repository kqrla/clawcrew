# 39 · the strike store

`38` ended with a constant that nothing counted. this closes it: one column on the seat, one row per
refusal, and a view that derives the column from the log so the two cannot disagree.

## what earns a strike

`consequence()` already answered this in `gateway.ts`, and the store does not re-decide:

| verdict | strike | why |
| --- | --- | --- |
| `tool_not_granted`, `surface_not_held` | yes | reaching for something that was never issued |
| `scope_outside_grant` | yes, and the turn ends | the reach was aimed, not accidental |
| `spend_not_reserved`, `arg_*`, `claim_*` | no | arithmetic and shape. a budget refusal is not a character flaw |
| accepted turn | no, and no credit either | good behaviour does not buy back a reach |

two strikes freeze, and freezing is the lifecycle verb from `34`, so the seat releases its lease rather
than holding a responsibility nobody is watching.

## what clears it

a person, and only a person. `clearStrikes` is the record of somebody having looked; it is not on a
timer, and success does not decay the count. the honest reason is that a strike is not a measure of
competence, it is a note that says *this seat reached for something it was not given*, and a seat that
reaches once and then behaves perfectly for a week has still told you something about how it reads a
brief.

`burned` has no inverse, so clearing leaves it burned.

## what is wired and what is not

wired: `runTurn` calls `recordRefusal(seat, codes)` on every rejected proposal, the schema exists, and
`seat_standing` computes the count from the log.

not wired: nothing writes the row yet, because the refusal happens in a domain function and the write
belongs to whatever runs the turn. that is one insert in the job, and it is the difference between a
guardrail and a comment. saying so is the point of this section.
