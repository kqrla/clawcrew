# stack

pinned, boring, and chosen for the failure mode rather than the feature list.

| layer | choice | why this one | what it costs |
| --- | --- | --- | --- |
| runtime | node 20, TypeScript, `tsx` for scripts | types are the cheapest form of review an autonomous org gets | compile step in the loop |
| database | Postgres 16 on InsForge | transactions. the org's state must be one consistent thing, not a set of files that mostly agree | a network hop per decision |
| state | tables, not git | git merges are a human activity; an autonomous org needs conflicts resolved by a constraint, not by a person | no branch-based isolation |
| source of truth | GitHub, push per commit | it is the audit trail a third party can already read | tokens in the sandbox |
| money | Stripe | the provider's record is the only evidence of revenue that is not self-reported | PCI surface stays theirs |
| rendering | OpenSCAD CLI + wasm | deterministic given inputs, which is exactly what a printable product needs | slow, and it will still emit a non-manifold mesh |
| fulfilment | print-house API | shipping is the one step the org cannot fake | per-order quote, per-order risk |
| tests | vitest | fast enough that the org runs them on every commit | none worth naming |

## the decisions worth defending

**no ORM.** the schema is DDL, checked in, applied in order. an ORM hides the constraint that makes
state consistent, and constraints are the mechanism this whole design leans on.

**no document store.** every gate is a query. a gate over documents is a gate over somebody's
interpretation of a document.

**no agent framework.** the loop is a tick over rows with ports, tested in `src/jobs/ticker.ts`.
frameworks bring retry policies nobody wrote and logs nobody reads.

**wasm for preview, CLI for export.** the browser needs a mesh in 200ms; the printer needs a mesh
that passed the harness. same recipe, two fidelities, one of which is allowed to be approximate.

## what is not decided yet

queueing, because the tick currently polls and a lease, and there is no evidence polling is the
bottleneck. caching of render artifacts exists in design only. both are recorded rather than
pre-solved, because the whole point of the project is that it not become an architecture exercise.
