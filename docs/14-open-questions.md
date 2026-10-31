# 14 · open questions

deliberately unresolved. each one blocks a design decision, not a line of code.

## 1 · elevation defaults

should elevation expire in 72 hours by default, or should it bind to a deliverable and expire with it? the second is more honest and more work to implement.

## 2 · where the ledger lives

metrics outlive code. does the objective ledger live in the product repo, versioned with the schema it measures, or beside it in a separate operations repo? the first keeps history; the second keeps the blast radius small.

## 3 · auditor independence

separate credentials are the load-bearing part. is a separate provider also required, or is a separate identity on the same provider enough? the failure to guard against is an auditor that has learned the workers' idiom.

## 4 · minimum viable tree

is a two-level tree with one secondment enough to prove the model, or does the matrix only become real at three levels? the demo should be the smallest tree that can express a cross-branch deliverable.

## 5 · customer evidence at small scale

the external-metric rule assumes a product database and a billing provider. a pre-revenue or single-customer business may have neither. what is the minimum honest external source for them?

## 6 · channel authority

a channel produces a decision, and a seat executes it under its own grants. what happens when the deciding seat has no authority to execute, and the executing seat disagrees with the decision? the current answer is escalation, which may just be a manager with extra steps.

## 7 · budget granularity

per circle per day is simple and coarse. does a busy release week need per-shift envelopes, or does that produce so many parameters that nobody tunes them?

## 8 · audit sampling

a rotating sample keeps cost flat, but catastrophic-but-rare errors sit outside samples by construction. is there a class of action (a3, a4) that must be audited exhaustively regardless of cost?

## 9 · succession depth

acting managers inherit responsibilities, not authority. for how long before the arrangement is a de facto promotion that nobody approved?

## 10 · name and namespace

is `orchart` free on npm, crates.io and as a domain, and does it collide with anything in the agent space? unresolved and cheap to check, and embarrassing to discover late.
