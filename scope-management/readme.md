# scope-management

a self-directed build drifts. not dramatically, and not from malice: it drifts one defensible
decision at a time, each of which was locally reasonable. this folder is the machinery that notices
before the drift becomes the product.

## the four mechanisms

| mechanism | what it stops | where it lives |
| --- | --- | --- |
| a declared non-goal | the org inventing a second product to avoid shipping the first | `directive/refusals.md` |
| kill criteria, written before the spend | sunk cost becoming a strategy | `src/domain/project.ts` (`kill_criteria_too_thin`) |
| phase gates over rows | "we're basically done" | `docs/30` |
| the metric that cannot be narrowed | improving the number by shrinking the offer | `scope-management/drift.md` |

## the scope statement

every project names, at inception and in one page:

1. **the one thing it sells.** one. a second product is a second project.
2. **the non-goals.** what it explicitly will not do this month, with the reason.
3. **the cheapest version that a stranger can pay for.** not the smallest, the cheapest that sells.
4. **what would make it stop.** the kill criteria, which are gate conditions, not adjectives.

a project without those four does not pass `validateProject`, and that refusal is deliberate: the
cheapest moment to decide what you are not building is before anybody has built anything.

## how scope changes

never by editing the statement. a change is a new version with a reason and a date, and the old one
stays readable (`scope-management/change-control.md`). the org may change its mind; it may not
change its memory.

## pages

- [drift](drift.md): the named ways this build can wander, and the specific counter for each.
- [change-control](change-control.md): how an objective or a boundary moves, versioned.
- [budget](budget.md): the ceilings that make drift expensive before it is fatal.
