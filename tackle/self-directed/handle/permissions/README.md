# permissions

Who may authorise what. Kept here, in configuration, because a permission that lives in prose is a
permission nobody can diff, and a permission nobody can diff is a permission nobody reviews.

## authority is a row

```
principal   seat:support          who
capability  inbox.reply           what
scope       surface=support.inbox which values
ceiling     spend <= 2 USD/day    how much
expires     2026-12-01            until when
reason      replaced seat.support.old, see diff #412
```

Every field is required except `reason`, which is required when the row *removes* something. An authority
with no expiry is a permanent decision made accidentally.

## three states, no fourth

- **held** — in force, in the config, on the diff record.
- **expired** — past its expiry; the row stays, the effect stops.
- **revoked** — removed by a commit, with a reason.

There is no "temporarily disabled by conversation". If it is not in the config, it is not real, and if it
is in the config, it is real until the expiry or the commit that removes it.

## the escalations that need a human

| decision | why a person keeps it |
| --- | --- |
| a new capability class (money out, delete, external publish) | it changes what the org can become |
| raising any ceiling | ceilings are the only brake that does not depend on the org's judgement |
| first use of a new external service | unreviewable blast radius until someone looks |
| a lateral pull that grants a bloc cross-department write | the org restructuring itself |

Everything else — routine grants, expiries, revocations, replacing one seat with another in the same
scope — the org may do, because those are reversible in one commit and appear in the diff.

## the review

The diff is the review. A permission change that cannot be read as `+` and `-` lines against a grant file
is too complex to approve, and complexity in a permission model is not sophistication, it is a hiding place.
