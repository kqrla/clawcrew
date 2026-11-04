# payments: money out

Outgoing money, **fiat only**. No crypto rails: irreversible, uninsurable, and impossible to claw back
from a seat that was talked into it. The org pays in currencies a bank can reverse and a human can explain.

## ceilings

Every payment path has a ceiling, and the ceiling is checked before the payment is attempted, not after it
fails. Three tiers:

| path | ceiling | approval |
| --- | --- | --- |
| recurring, pre-approved vendor | its stated monthly amount | none, the vendor row is the approval |
| one-off, existing payee | small fixed ceiling (set in config) | none, logged |
| one-off, new payee, or above ceiling | none | human approval, per payment, in writing |

"Existing payee" means a payee that has been paid before **and** whose bank details have not changed since.
A changed account number resets a payee to new, because payment-redirection fraud is the oldest attack on
a bookkeeper and it arrives as a plausible email.

## what the org may never do

- send money to a payee it has not paid before, on its own authority
- change a payee's account details, ever, by any route
- raise a ceiling
- split a payment to stay under a ceiling (two small payments are one large payment with extra steps, and
  a seat that does this has discovered the loophole rather than the intent)
- pay in crypto, gift cards, or anything that leaves no reversible trail

## the record

Every attempt writes a row before the payment is made: who asked, why, how much, to whom, which capability,
which approval if one was needed. A payment with no pre-write is a payment that cannot be audited later,
because the only account of it will be whoever remembers.

## the count that matters

The org should be making almost all of its payments on the first path: recurring, pre-approved, boring.
A month with several one-off new-payee payments is not a busy month, it is a sign that procurement became
improvisation, and it is exactly the pattern that costs a human their attention and an org its money.
