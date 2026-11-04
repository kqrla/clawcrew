# division-of-labor

how work is cut, and why the cut is by surface rather than by function.

## the cut

ten slices, one per kind of surface the business actually has: design, code, research, security,
financials, media, operations, accounting, support, documentation. each slice owns a vocabulary, an
evidence grammar, and a set of contracts it provides and requires (`docs/29`).

the cut is by **surface**, not by stage: no "planning" slice, no "review" slice. a slice is a thing
that can be worked on and can be checked, not a phase of a process.

## why contracts, not a chain

a pipeline ("design then code then test") encodes an assumption about order, and the assumption is
wrong the first time a security finding requires a design change. contracts say what each slice
delivers and needs, and the composition check refuses a set that cannot cover itself. order becomes
a consequence rather than a rule.

## the three properties that make it plug-and-play

1. **no shared identity.** two slices may name the same thing (`price`) and the org does not assume
   they mean the same thing. this costs duplication and buys independence.
2. **no shared state.** every slice reads and writes its own tables, joined by reference, not by
   foreign key into somebody else's internals.
3. **bounded handoff.** a handoff is a message with an acceptance (`docs/28`); a nack returns the
   work with a named reason, not a vague rejection.

## pages

- [skills](skills.md): how a task is cut small enough for one seat, and how a seat spawns a child
  with a narrower grant sourced from a known tool.
- [agent-lifecycle](agent-lifecycle.md): duplicable, freezable, thawable, burned. the four verbs and
  what each one refuses.
