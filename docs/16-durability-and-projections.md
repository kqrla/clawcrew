# 16 · durability and projections

supersedes the export-to-git assumption in v0.2.

## git is out

three reasons, in descending order of how much they cost.

**1. the token is the problem.** to write exports to a repo you hand some agent a token to a repo. that token also reads the repo, opens pull requests and, depending on the host, edits branch protection. a system whose whole thesis is that authority compiles to credentials should not hand out a credential that quietly reopens the write path it just closed.

**2. it fails requirement six.** [09-audit](09-audit.md) says a third party who is not an ai must be able to reconstruct what happened. a commit log is legible to engineers on the first read and to nobody else ever. `git log -p` is not books.

**3. it duplicates the surface you are going to build anyway.** you want a board. if the board is a separate system from the record, you have two truths. if it is a projection of the record, you have one truth and a nice board.

## the four layers

| layer | holds | owner of truth |
| --- | --- | --- |
| coordination | leases, handoffs, surface locks, live state | postgres |
| record | the hash-chained event log, one stream per circle | postgres, exported |
| artifacts | snapshots, diffs, query results, invoices | content-addressed blobs (minio) |
| projections | a board for humans, an archive for research | plane, karakeep |

the record is exported as jsonl segments named by content hash, with a weekly manifest listing every segment hash and the head. **one hash per week is anchored outside the org's write scope**: mailed to the owner, posted to a channel the agents cannot post to, or written to a timestamping service. that single number is what makes the whole log tamper-evident, and it costs nothing to produce.

git remains a fine *destination* for that export if you want it. it is no longer the mechanism.

## the rule

**projections are write-only out and proposal-only in.**

- out: a task or objective change produces a card. the card is derived, disposable and rebuildable.
- in: anything arriving from a projection is a proposal. it is never a state change.

this is not caution for its own sake. it is the same failure the whole spec is built against: an external system saying "done" and being believed.

## why plane cannot be the tracker of record

plane has a state machine. the moment a card's state is authoritative, the cheapest way to close work is to drag the card, and the objective ledger becomes a decoration next to a green board. that is drift with a nicer interface.

so a webhook that sets an issue to done is a **request**:

```
plane webhook  → interpretPlaneWebhook  → completion_request
               → guardCompletion(closureOk?)
                   false → { accepted: false, reason: 'completion_requires_evidence' }
                   true  → accepted
```

`closureOk` comes from the ledger: evidence exists, from the declared source, computed after the last amendment, meeting the target. a human dragging a card can therefore *ask* for closure, and only evidence can grant it.

implementation: `src/ports/projections.ts`.

## why karakeep cannot be evidence

karakeep archives the whole page and summarizes it with a model. the archive is useful. the summary is a claim.

- evidence stores the **snapshot hash**. the blob is the witness.
- a reading produced by karakeep is recorded with `runBy: 'karakeep'` and listed in `forbidRunBy`, so `canClose()` refuses it.
- karakeep is excellent at the part that is hard: finding the source again in six weeks, with tags pointing back at an objective id.

so: karakeep is a reader, not a witness. it makes research cheap and durable; it does not make a number true.

## what each is actually good at

| need | plane | karakeep | neither |
| --- | --- | --- | --- |
| where is this task, for a human | yes | | |
| blockers a person can see | yes | | |
| find the source behind a decision in six weeks | | yes | |
| snapshot a page before it changes | | yes | |
| prove a metric moved | | | ledger |
| prove nothing was rewritten | | | hash chain |
| be the record | | | postgres |

## reconciliation

once a week, alongside the audit:

1. pull remote state for every mapped card
2. diff against the record
3. every divergence becomes a `projection_drift` finding and **no state changes**
4. re-push from the record, which is the only direction that repairs anything

drift is expected. somebody will close a card while an agent is mid-flight. the finding is the point: it tells you a human is working around the system, which is the most useful thing a board can tell you.

## licensing

plane and karakeep are both AGPL-3.0. running them as separate services that orchart talks to over http is ordinary use, not linking, and does not reach orchart's own code. two cautions:

- plane has publicly discussed moving off AGPL. pin a version and keep the adapter under a hundred lines, which `src/ports/projections.ts` already is.
- if you ever host modified versions for other people, the AGPL's network clause is your problem, not orchart's.

## failure modes

- **projection lag.** the board is stale for minutes. acceptable; it is a view.
- **webhook replay.** a duplicate done event must be idempotent. proposals key on `(task, remote, state)`.
- **summary poisoning.** a karakeep summary is injected into context and reads as fact. mitigated by `runBy` labelling and by never rendering a summary with the evidence styling.
- **anchor loss.** if the weekly hash is never written down, tamper evidence degrades to "trust the database". the anchor is a one-line job in the ticker and the most skipped step in every system like this.
