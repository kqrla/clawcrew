# change-control

how a boundary moves. applies to objectives, ceilings, kill criteria, and the ten slices.

## the rule

**append, never edit.** every one of those is a versioned statement: a change writes a new version
with a reason and a date, and links to the one it replaces. the old one stays readable forever.

the reason is not sentiment. the audit trail has to answer "what did the org believe on the 12th,
and who changed it", and an edited row cannot answer that. this is the same reason the event log is
hash-chained.

## what needs what

| change | needs |
| --- | --- |
| a parameter inside its declared range | nothing. it is not a change |
| a target number in an existing objective | a new objective version, with the reason. no approval |
| a new objective | an owner tier, an executable source, a baseline, and a target that differs |
| a new ceiling | a human, in writing, on the audit chain |
| a kill criterion removed or weakened | a human, and the new version names what replaced it |
| a slice added to a project | the contract check: its `requires` must be provided by the set |
| a slice removed from a running project | a phase roll-back, because the build gate reads it |

## the two refusals

**no retroactive justification.** a change may not rewrite the objective it is responding to. if the
old target was wrong, it was wrong, and the record says so.

**no silent widening.** if a change makes the boundary larger, it is a human act. if it makes the
boundary smaller, the org may do it itself, because shrinking scope is always allowed and is the
cheapest correction available.
