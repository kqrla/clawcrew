# 09 · audit trail

## the test

a third party who is not an ai, is not in the company and does not trust the agents must be able to answer, for any action:

1. **who** acted: which seat, in which circle
2. **under what authority**: which grant, elevation or secondment made it legal
3. **on what**: which surface, with which version
4. **with what effect**: state change, money moved, message sent
5. **with whose approval**: which approval card, which human
6. **what happened next**: the result, and whether it was verified

if any of the six is missing, the record is a log, not books.

## event

append-only. never updated, never deleted. corrections are new events that reference the old one.

```yaml
event:
  id: evt.01J9...
  at: 2026-11-03T14:22:07.412Z
  actor: {seat: seat.billing, circle: finance-ops, badge: badge.7f3a}
  authority:
    grant: grant.4b21
    elevation: null
    secondment: null
    class: a2
  action: {verb: invoice.send, surface: "billing/invoices", target: inv_8891}
  effect:
    economic: {amount_usd: 240.00, direction: in, account: stripe}
    state: {invoice_status: sent}
  approval: {card: apr.552, approved_by: human.karla, at: ...}
  result: {status: ok, verified_by: "stripe_api:invoice_status", verified_at: ...}
  prev_hash: sha256:...
  hash: sha256:...
```

## hash chain

each event hashes its canonical serialization plus the previous hash. this does not make tampering impossible; it makes silent tampering detectable, which is the property that matters when the only witnesses are agents.

weekly, the auditor stores the head hash somewhere the org cannot write: a separate repo, a commit signed by a human key, or a timestamping service. one anchor per week is enough to prove a record was not rewritten after the fact.

## the badge

every seat carries a badge: seat id, title, home circle, secondments, held tools, limits, state and a summary record. every message, tool call, handoff and lease carries the badge id.

the badge is a display object over the event log. it never carries authority by itself, and it is never accepted as proof of identity by a tool. the capability token is the proof; the badge is how humans read it.

## legibility for non-engineers

the raw log is jsonl. that is not what an accountant, a bank or a counterparty reads.

ship three projections:

- **the ledger view**: money in, money out, by circle, by objective, reconciled to the payment provider. exportable as csv.
- **the decision view**: decisions, who made them, under what authority, and what dissent was recorded.
- **the incident view**: everything classified a3 or a4, plus every integrity finding, in plain language.

the third projection is what a lawyer will ask for. design it before it is needed.

## redaction

- secrets never appear in the log. the log records that a secret reference was used, not the value.
- personal data is referenced by id and stored in one place, so a deletion request is one delete plus a tombstone event.
- redaction is an event with a reason and an approver, never an update in place.

## retention

| class | retention | reason |
| --- | --- | --- |
| money movement | 7 years | tax and audit |
| external communications | 3 years | dispute and regulatory |
| decisions and approvals | life of the entity | institutional memory |
| tool calls and transcripts | 180 days | debugging, then cost |
| integrity findings | life of the entity | never delete |

retention is enforced by the storage layer, not by a cron job that someone turns off.

## replay

because the log is append-only and hash-chained, any circle's state at time T can be reconstructed: replay its events, recompute effective permissions and leases, and diff against the current state.

replay is the debugging tool and the forensic tool. it is also the acceptance test for the storage layer: if a rebuild from events does not match live state, the live state is wrong.
