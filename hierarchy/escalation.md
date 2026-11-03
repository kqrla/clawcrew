# escalation

the org wakes a human fewer than five times a month. that is the target, and it is a design
constraint rather than an aspiration: every wake is a cost with an owner, and an org that asks
constantly has moved the work rather than done it.

## what earns a wake

| category | example | why it cannot wait |
| --- | --- | --- |
| irreversible | publishing a paid price, cancelling a production order | undo does not exist |
| money | raising a ceiling, refunding, paying a supplier | the org cannot authorise its own spend |
| a person | contacting a customer, licensing a character | consent is not inferable |
| legality | a licence, a trademark, a privacy question | the org's judgement is not the one that counts |
| authority | widening a grant, adding a recipient | escalation of capability is always human |

## what does not

- a build that is broken. retry, then bisect, then swap the approach.
- a metric that has not moved yet. that is what the window is for.
- a decision with a reversible default. take the default, record it, move on.
- a conflict between two slices. the contract check and the phase gate already decide it.

## the shape of an escalation

four lines, always: **what happened**, **what the org already tried**, **the decision needed**, **the
default it will take if nobody answers**. the fourth line is what makes an escalation honest: an
escalation with no default is a hostage note.

## the budget

escalations are counted per project per month, in the same table as spend. a project that exceeds its
escalation budget is not "high touch", it is mis-scoped, and the mis-scoping is the finding.
