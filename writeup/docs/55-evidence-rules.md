# 55 · what counts as done, per kind

Until this, "complete" meant *some* evidence landed. For `support` that was fine, because the rule was
already in the code: a reply signed by a second seat. For the other nine kinds it was a promise, and the
org would have accepted a `code` task on the strength of a commit message.

`evidence_rule` is a table now, because a policy change should be a migration rather than a deploy:

| kind | requires | source | count | max age | second seat |
| --- | --- | --- | --- | --- | --- |
| support | a reply, signed by a second seat | `^run:` | 1 | 72h | yes |
| code | a commit and a green ci run | `^(git:\|ci:)` | 2 | 72h | no |
| design | an exported asset and a review note | `^(asset:\|review:)` | 2 | 7d | no |
| research | a note citing at least two sources | `^study:` | 1 | 10d | no |
| security | a control check that ran, not a policy that exists | `^control:` | 1 | 7d | yes |
| financial | a settlement figure from the ledger | `^ledger:` | 1 | 48h | yes |
| media | a published url and a view count | `^(publish:\|views:)` | 2 | 7d | no |
| ops | a run log with a start and an end | `^runlog:` | 1 | 24h | no |
| accounting | a reconciled statement line | `^recon:` | 1 | 30d | yes |
| doc | a published page that resolves | `^publish:` | 1 | 7d | no |

Rules are read by `work-once` and judged by `src/jobs/acceptance.ts`: kind matches, source matches the
pattern, fresh enough, enough distinct artifacts, and a second seat where the rule asks. **No rule means no
completion**: an unknown kind is a refusal, not a default, so adding a kind to the constraint without adding
a rule can only block work, never silently wave it through.

```
work: … requeued (rule_refused: source_mismatch) attempt 3/3
work: t.meenible.code.repo… complete on code evidence from seat.code
```

The first line is a rule doing its job on a `git:`-shaped string that did not match. The completion above
required two distinct sources (`git:abc1234`, `ci:run/9`), and dedupes by source, so five copies of one
commit is still one commit.

## the catalog became scope control

`objective.product_line` is a real column now, backfilled by longest-prefix match, and `replenish` refuses any
objective whose line is `planned` or `retired`:

```
replenish: - obj.…bondee-dolls… (line_not_live)
```

Three of the four meeniable styles are ideas. Without this rule the org would happily have invented work for
them, because their metrics are zero and zero looks catastrophic. **Not launched is not behind.**

## three corrections worth recording

1. **The rename emptied the evidence.** `obj.meenible.*` objectives were copied to
   `obj.trinketeer.meeniable.*` but the evidence rows still pointed at the old names, so every objective read
   as unmeasured and replenishment refused all twelve. Fixed in `20261113000002` — a rename has to carry the
   references, not just the rows.
2. **The ledger checksum caught me editing an applied migration.** I appended a statement to
   `20261113000001` and the runner refused: *"applied as 58c9995a1513, is now 417729bb32ab; write a new
   migration instead"*. That guard is the only reason the fix is auditable.
3. **Slice detection by position broke the moment the id grew a segment.** `obj.meenible.code.repo` →
   `obj.trinketeer.meeniable.code.repo` turned `meeniable` into the "slice", and every objective became
   `kind_unregistered`. The slice is now found by looking for a legal kind in the id, not by counting dots.

## what is left

`support` is the only kind with a live producer: the support pass writes `run:` evidence. For the other nine
the rules exist and nothing computes the artifacts yet, so a `code` task will sit in `requeue` until a seat
produces `git:` and `ci:` evidence. That asymmetry is the honest state: the org can judge all ten kinds and
can only *do* one. The next piece is a producer per kind, starting with `code`, since the repo already has a
git history to cite.
