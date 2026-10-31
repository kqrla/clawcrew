# 10 · lifecycle

## three states

| state | reversible | grants | leases | appears in votes | keeps history |
| --- | --- | --- | --- | --- | --- |
| active | yes | yes | yes | yes | yes |
| frozen | yes | no | released | no | yes |
| burned | no | no | no | no | tombstone only |

## freeze

reversible, cheap and used constantly. freeze a circle when it is being restructured, when its objective is paused, or when its spend is out of control.

on freeze:

- every active lease is released and the responsibilities escalate to the next holder
- every capability token is suspended, not deleted
- pending approval cards are routed up the chain, not dropped
- the circle keeps its place in the tree and its history

## thaw

thaw re-validates rather than resuming:

- tool definitions are re-hashed. a changed definition requires re-approval.
- policy version is re-checked. a circle frozen under an older policy does not resume under the newer one without review.
- credentials are re-issued. tokens issued before the freeze are never reused.
- objectives are re-checked against the ledger. an objective retired during the freeze does not reactivate.
- open handoffs are reconciled: accepted, re-offered or closed as undelivered.

thawing into a changed world is the normal case. a freeze that resumes exactly where it stopped is a bug.

## burn

irreversible. used when a seat or circle is retired, compromised or replaced.

- tokens revoked, secrets purged, memory namespaces deleted
- leases released, handoffs closed as `undelivered`
- every reference to the seat remains in the log as a tombstone: id, title, dates, and what it did
- a burned id is never reused

burning is the only correct response to a suspected integrity failure. revoking and re-issuing under the same id leaves the audit ambiguous.

## succession

a manager cannot be frozen or burned until succession is chosen. this is the one lifecycle rule with no exceptions, because a manager node with no manager takes its whole subtree out of authority.

two options:

1. **acting manager.** a named seat, capped at the acting seat's own ceiling. the cap matters: an acting manager inherits the *responsibilities*, never the *authority* of the absent seat.
2. **reparent.** the children move to the parent circle.

both show a permission diff for every affected seat first. pending approval cards route to the new chain. the choice is logged with a reason and an expiry: acting management always expires, because temporary arrangements become permanent.

## the frozen-manager hole

a frozen manager whose children remain active is the most common way an org silently loses control. the children keep working under a ceiling nobody is maintaining, and no one is accountable for their objectives.

the runtime prevents this by construction: freezing a circle with active children requires succession first, or the freeze cascades to the children. there is no third option.

## reorg

covered in [02](02-org-model.md). one rule belongs here too: a reorganization is a **lifecycle event**, not a config edit. it is dated, reasoned and diffed, and it triggers lease revalidation and approval rerouting in the same transaction.
