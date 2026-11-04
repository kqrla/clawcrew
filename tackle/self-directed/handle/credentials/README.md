# credentials

How the org gets the ability to act without ever being handed the ability to act *as* anyone.

## the rule

A seat holds a **capability**, never a secret. The secret lives in the environment of a process the seat
cannot read; the capability is a narrow function that uses it, with the arguments the seat may supply
enumerated. If a seat can print the key, the key is in the transcript, and the transcript is in the audit
log, and the audit log is legible to third parties. That is how a credential leaks without anyone making
a mistake.

## shape of a capability

```
name          inbox_reply
uses          SMTP credential (never exposed)
arguments     recipient (enum: the ticket's asker), body (string, <= 1200 chars)
refuses       a draft, an empty body, a recipient not on the ticket
audit         every call writes a row: who, what, to whom, when, outcome
```

Note the pattern: the arguments are *enumerated and narrowed*, not typed loosely. A capability that takes
a free-form recipient address is a spam machine with a nice name.

## rotation and revocation

- **one credential, one purpose.** a key that does two things cannot be revoked by half.
- **every credential has an owner and an expiry.** a key with no expiry outlives the reason it was made.
- **revocation is a commit, not a conversation.** removing a line from a grant file is the whole procedure.
- **a leaked key is rotated, not watched.** rotating takes a minute; watching takes an incident.

## what the org may do on its own

| may | may not |
| --- | --- |
| use an existing capability within its arguments | create a new credential |
| ask for a capability in writing | grant one to itself |
| read a secret's *existence* and expiry | read a secret's value |
| revoke a capability it holds | widen the scope of one it holds |

## the test

Hand the seat's whole tool list to a hostile reader. If anything in that list can be used to move money,
read another tenant's data, or reach the internet unconstrained, the grant is wrong, and it is wrong now,
not on the day it is exploited.
