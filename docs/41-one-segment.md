# 41 · one segment, all the way through

everything before this was a mechanism with a test and no caller. this is a ticket that arrives, is
answered, is verified by a second seat, is counted by an objective, and survives being refused. every
row below came back from the database, not from a log the process wrote about itself.

## the path

```
support_ticket (open)
  → claimOpenTicket     open -> answered in one update, so claim and state cannot disagree
  → provider.propose    a port. a rule today, a model the moment there is a key
  → judge()             tool in grant? surface held? recipient in scope? spend under cap?
  → saveReply           the reply lands in the row a person can read, with who wrote it
  → verifyReply         seat.support.qa reads what was stored: id present, no placeholder, acknowledges
  → evaluateCompletion  answered is not done; closed must be signed by somebody else
  → markVerified        verified_at set, the objective's numerator moves
```

## what running it proved

| run | result |
| --- | --- |
| `scripts/support-once.ts` | `tkt.1001` verified; reply by `seat.support`; signature by `seat.support.qa`; objective `1.0000` primary and witness |
| same again | `no_work`; no second reply |
| `scripts/support-refusal.ts` | `tool_not_granted`; ticket back to `open`; one strike on `seat.support.qa` |
| `support-once.ts` after the refusal | the answering seat took the released ticket and verified it |

```
 id       state     provider         replied_by    verified_by
 tkt.1001 verified                   seat.support  seat.support.qa
 tkt.1002 verified                   seat.support  seat.support.qa
 tkt.1003 verified  scripted:no-key  seat.support  seat.support.qa
```

## the bug the live run found

the first version moved the ticket to `answered` at claim time, and the gateway then refused the turn.
the customer was left in `answered` with no reply: claimed by nobody, answerable by nobody. the claim is
a lease, so a refusal releases it now, and the recovery row is the proof rather than the intent.

## the one thing still stubbed, said plainly

this machine has no model key, so `provider` reads `scripted:no-key` and the reply is a template. the
column exists precisely so that sentence is true on the row instead of in a commit message: the two
tickets closed before the column existed have it empty, and that emptiness is also accurate.

docs/42 is the port. swapping the template for a model is one environment variable, and nothing in the
audit, the gateway, the checkpoints or the ledger changes when it happens.
