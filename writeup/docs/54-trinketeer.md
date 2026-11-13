# 54 · the company is trinketeer

`meenible` was never a company. It was the first product line, and it needed a qualifier every time it was
named as a business: "meenible: custom collector figures, B2C". A company that names itself after its first
product cannot start a second one without sounding like it is pivoting.

```
trinketeer/                     the business
  meeniable/      live          custom collector figures
    funko-pops/   live          v1, the line everything so far was built for
    bondee-dolls/ planned
    block-type/   planned       minecraft-blocky
    mino-girl/    planned
  miniroomie/     planned       printed diorama miniatures
  meenicals/      planned       props and trinkets
```

## how the rename was done, and why that way

The ledger is append-only, so this is a **copy and retire**, not an edit:

1. `project` gets a `trinketeer` row, and the rows that pointed at `meenible` (slices, phase log, tasks,
   audit runs) are repointed to it.
2. objectives are copied from `obj.meenible.*` to `obj.trinketeer.meeniable.*`, parents included.
3. the old objective rows are set `status = 'retired'` with `retired_reason = 'renamed: the company is
   trinketeer, and meenible is its first product line'`.

Verified after the migration:

```
project:    trinketeer
lines:      trinketeer.meeniable [live] · .funko-pops [live] · .bondee-dolls [planned]
            .block-type [planned] · .mino-girl [planned] · trinketeer.miniroomie [planned]
            · trinketeer.meenicals [planned]
objectives: 12 active, 11 retired
orphans:    0 tasks pointing at the old project or the old objective prefix
```

## the catalog is a table and a folder

`product_line (id, project_id, parent, name, status, brief)` mirrors `catalog/trinketeer/` exactly, ids and
all, so neither copy can drift quietly. Nesting is `parent`, because a line can contain lines: meeniable has
four styles and miniroomie is its own line with none.

`status` is `planned | prototype | live | retired`. A style moves to `prototype` when it gets an objective
with a metric the database can compute, and stays `planned` until then. That rule is why three of the four
meeniable styles are allowed to be names in a catalog and nothing more.

## not built

Nothing reads `product_line` yet: objectives name their line in the id (`obj.trinketeer.meeniable.*`) and the
table is not consulted. When a second line goes live, the objective's line should come from the table rather
than from a naming convention, or the convention becomes a second source of truth.
