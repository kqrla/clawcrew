# 45 · the first time it met a real postgres

Everything so far ran through one vendor's https CLI. Being self-hostable was a claim, not a fact. So I
installed real postgres 18.6 in the sandbox (bundled binaries, run as an unprivileged user because `initdb`
refuses root) on port 5433, pointed `DATABASE_URL` at it, and watched it fail three times.

## the driver no longer needs psql

The sandbox has no `psql` and no root, and neither does a stock runtime image. So the self-hosted driver is
**node-postgres in a one-shot child process** (`src/store/pg-runner.ts`): synchronous like the domain, and
needing nothing on the box but node. `CLAWCREW_DRIVER=psql` still selects `psql` for a host that has it.

This corrected `docs/44`, which had assumed a postgres client would be present.

## three things a real database said that the remote one never did

**1. `migrate.ts` had its own copy of the driver.** It shelled out to the CLI directly, so `DATABASE_URL` was
honoured by the store and silently ignored by migrations. The first run reported `18 migrations known, 0
applied this run, 51 public tables present` while the fresh database it had just been pointed at had
**zero** tables. It was patching one database and describing another. It now imports the same driver choice,
because the whole point of one place deciding is that it is the only place deciding.

**2. the probe read the driver's formatting, not the data.** `probe()` ran `select 1 as reachable` and
matched the string `reachable`, which only exists because the CLI draws a table *header*. Any driver that
returns tuples has no header, so the probe reported silence against a perfectly good database. It now uses
the marker convention the rest of the repo already uses: `select '##' || 1 || '##'`.

**3. a fresh database refused to migrate.** An empty ledger and an unreadable ledger looked identical, and
the code chose to refuse rather than risk re-running DDL over live tables, which is the right instinct and
the wrong outcome for `compose up` on an empty volume. It now proves freshness first: no ledger rows **and**
no public tables means fresh, anything else still refuses.

## what it found and I have not fixed

With all three fixed, a clean replay reaches the schema and dies on real data:

```
insert or update on table "objective" violates foreign key constraint "objective_owner_tier_fkey" (exit 1)
```

`migrations/20261101000005_meenible.sql` inserts objectives owned by `t.test01`, and the tier `t.test01` is
not seeded until the **next** file, `20261101000006_meenible-objectives.sql`. On the database these
migrations grew up on, the tier already existed, so the ordering never mattered. On an empty volume it is
the first thing that happens.

This is the difference between a migration chain and a migration history: ours is a history, replayed in the
order it was written, and it has never been replayed from zero. Fixing it means either moving the tier seed
ahead of the objective seed (which changes the hash of two already-applied files and needs a documented
rehash path) or making the objective insert tolerate a missing tier, which hides the dependency instead of
ordering it. I would take the first and write the rehash path, because a self-hosted deployment begins with
an empty volume every single time.

## how to reproduce

```bash
initdb -D data -U clawcrew --auth=trust        # as a non-root user
pg_ctl -D data -o "-p 5433" start
DATABASE_URL=postgres://clawcrew@127.0.0.1:5433/clawcrew npx tsx scripts/migrate.ts
```

## fixed: the chain replays from zero

```
verified: 20 migrations known, 20 applied this run, 51 public tables present
provider: openai:gpt-5.4-mini@api.openai.com
{ "status": "verified", "checkpoints": ["answered", "closed"] }
tickets: tkt.1001 verified | tkt.p1 verified
objective: 1.00000000000000000000
```

Two new migrations, no edits to applied ones:

- **`20261101000004a_meenible-tiers.sql`** seeds a tier for every tier an existing objective already
  references. General on purpose: the next objective that names an unseeded tier is the same bug.
- **`20261101000004b_figures-project.sql`** seeds `test-01.figures`, the project 000005 was written to
  rename and then delete. Its slices are `code.repo, design.studio, research.analysis, security.controls,
  financials.rails, media.studio, support.inbox, accounting.books, operations.runtime, documentation.site`.

The second one is the real finding. The chain never only depended on ordering: it depended on a **project
that was made by hand**. 000005 copies `test-01.figures` into `meenible` and then deletes the original, and
on an empty volume there was nothing to copy, so meenible had no slices, the slice tiers could not be
derived, and every slice objective pointed at a tier that could not exist. `project` and `project_slice`
had zero rows in a database that had been migrated twenty times.

## the rehash path, and why nothing needed it

The ledger stores a hash per file and per statement, so editing an applied migration is detectable, and it
is refused rather than re-run over live tables. That is the right default and it stays.

The path for a genuine edit, when one is unavoidable:

1. prefer a **new file with an earlier number** (as above). it applies anywhere, it is idempotent, and no
   hash changes. `20261101000004a` sorts after `000004` and before `000005` for exactly this reason.
2. if a file truly must change, it is a deliberate act with a record: bump the file, delete its
   `schema_migration_statement` rows, and update its `schema_migration` hash **in the same commit** that
   updates the file, with the reason in the commit message. There is no `--rehash` flag, and that is not an
   oversight: a flag makes it a routine, and a routine makes an append-only ledger a suggestion.

Nothing in this fix needed step 2. That was worth paying a day for, because the alternative was a
self-hosted deploy that fails on the first empty volume every time.
