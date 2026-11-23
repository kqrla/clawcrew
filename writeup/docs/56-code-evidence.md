# 56 · a code task names one repo, or it is a breakdown

The `code` rule from `docs/55` asks for a commit and a green run. Nothing produced them, so a code task sat in
`requeue` forever. This is the producer, and the question that had to be answered first was **which repo**.

The answer depends on how far up the breakdown the task sits. A task that says "improve the storefront" cannot
name a repository: it is several repositories' worth of decisions away from an artifact. Such a task is a
*breakdown*, not work. So `task.repo` is nullable, `task.parent_task` is a real relationship, and
`resolveRepo` says which of the two cases it is looking at:

| task | answer |
| --- | --- |
| names a repo | `ok`, that repo |
| no repo, has children | `needs_breakdown` |
| no repo, no children | `repo_unknown` |

Both refusals are better than the alternative, which is a synthetic artifact invented to satisfy a rule.

## what the producer proves

`scripts/code-evidence-once.ts` takes every leased `code` task, and for each one:

1. `git -C <repo> rev-parse HEAD` for the artifact, and `git rev-list --count HEAD ^origin/main` for whether
   there is work at all. A clean checkout of the branch the lease started from is **zero**, not one.
2. runs the suite (`vitest`) and reads the counts out of its output, in `backend/` when the repo is a
   monorepo, because a root with no config fails for a reason unrelated to the change.
3. writes two proofs: `git:<sha12>` and `ci:vitest:<passed>`, both scoped to the task.

```
code-evidence: t.code.e2e + git:5b82184a1636
code-evidence: t.code.e2e + ci:vitest:589
code-evidence: t.code.parent refused (needs_breakdown)
code-evidence: 2 proofs written, 1 refused, 2 leased code tasks
work: t.code.e2e complete on code evidence from seat.code
```

## the bug this exposed, which is the important part

Before this, evidence was scoped to the **objective**. The breakdown task shares an objective with its child,
so when the child produced `git:` and `ci:` proofs, `work-once` completed the *parent* on its child's
artifact. The artifact proved something; it did not prove that this task did it.

`evidence.task_id` fixes that, and the difference is visible in one run:

```
work: t.code.e2e complete on code evidence from seat.code     # has its own proofs
work: settled complete=0 requeued=0 escalated=0 held=1        # t.code.parent: no proofs of its own
```

A parent task finishes when its children are done, and that is a different rule than "evidence exists
somewhere under this objective". Writing that rule is the next piece; until it exists a breakdown simply
never completes, which is the safe direction to be wrong in.

## what the schema corrected

Three times, in one afternoon:

1. `objective.source_executable` requires `^(sql|http|git|run):.+` and refused `git` as a source. A metric
   source is a command, not a product name.
2. `objective.owner_tier` and `task.owner_tier` are not null and reference `tier`, so a fixture needs a tier
   before it needs a task. The org has no work without a place to do it.
3. `evidence.computed_at` has no default locally, so a proof must say when it was computed. That is right:
   an undated artifact cannot be compared to a lease, and the lease comparison is the whole completion rule.

## still not built

- **No producer for the other eight kinds.** `support` and `code` now compute evidence; design, research,
  security, financial, media, ops, accounting and doc have rules and no producers, so a task of those kinds
  can only ever be refused. The next one is `financial`, because a ledger is already the source.
- **A breakdown never completes.** Parent tasks need "all children done" as their acceptance rule.
- **The producer runs the whole suite per task.** Fine for one task, wasteful for five. It should reuse a run
  when the sha matches one it has already proved.
