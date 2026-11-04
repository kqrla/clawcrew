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

## the clock, the cap, and a kill

`scripts/support-once.ts --every 2000 --cycles 2` is the night shift. one ticket per cycle, no state kept
between cycles, so stopping it is safe at any instant.

**money is decided before the model, not after the invoice.** the first version checked the cap after the
proposal came back, which means a seat at its ceiling still bought one more call before being told no.
the order is now standing, then money, then the model, and a test asserts the responder is never invoked
at the cap. the ledger counts cents (`usd_cents` is the only metric the table accepts) and the domain
counts dollars, so the conversion lives in one place in the store.

**a claim is a lease, including against a kill.** a process killed between the claim and the reply left
`tkt.1006` in `answered` with no reply, invisible to every later run: three runs saw `no_work` while a
customer waited. the claim now stamps `claimed_at` and a stale claim comes back after ten minutes. the
recovery is the row above: `tkt.1006` answered by `gpt-5.4-mini`, verified, objective back to `1.0`.

```
2026-11-04T13:42:21Z verified Hi, thanks for letting us know about ticket tkt.1006...
2026-11-04T13:42:27Z no_work
```

**what is still not true.** the loop is a script with a flag, not a supervised service: nothing restarts
it, and it is not in the ticker because the ticker needs a direct postgres connection and this sandbox
reaches the database over https only. the per-call cost is a flat one-cent reservation, not measured
tokens. and `tkt.1001` and `tkt.1002` carry no provider, because they were answered before the column
existed. those nulls mean unknown provenance and are left as they are rather than backfilled with a
reconstruction.
