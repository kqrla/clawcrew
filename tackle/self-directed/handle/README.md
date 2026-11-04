# handle

Everything the org touches outside its own repo: keys, money in, money out, and who may authorise each.
This is the part where an autonomous org does real damage, so the rules are written down before any of it
is connected.

## the four drawers

| drawer | holds | the hard rule |
| --- | --- | --- |
| `credentials/` | API keys, tokens, service accounts | a seat never holds a raw secret; it holds a capability that uses one |
| `finances/` | incoming money, revenue streams, invoices issued | every number is reconciled against a bank or processor record, never self-reported |
| `payments/` | outgoing money, fiat only | no seat pays anything above the approved ceiling without a human approval, in writing, per payment |
| `permissions/` | who may authorise what, ceilings, revocations | authority is a signed config diff, reviewed, with an expiry |

## the principle that decides everything here

**capability, not role.** The org does not decide that "the finance seat may spend"; it decides that one
specific capability, with a named ceiling and an expiry, exists, and which seat currently holds it. A
role can be argued about. A capability can be revoked in one commit.

## what is never automated

- sending money to a new payee for the first time
- raising a ceiling
- creating a credential with a wider scope than the one it replaces
- anything where the org is both the requester and the approver

Those four are the human's, by design, and the target of fewer than five interventions a month is
measured *excluding* them. An org that has automated its own approval is not autonomous; it is
unsupervised.
