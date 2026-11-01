# 12 · keys and money

an organization that runs for a month needs two things a chat session never does: **its own credentials**, and **its own money**. both are places where a small design mistake is unrecoverable, so both are narrow on purpose.

## custody, in four levels

the org does not hold secrets in a prompt, and it does not use the human's personal vault. it has its own vault account (vaultwarden, bitwarden, 1password: the choice is operational, the shape is the same).

**level 0, break glass.** the human holds a recovery credential the org cannot read. used rarely, assumed to exist always. if the org can read its own recovery path, it is not a recovery path.

**level 1, custody.** a supervising seat holds the vault session. this is the only seat that can mint access, and it is deliberately not the seat that does the work.

**level 2, scoped sessions.** a working seat receives a credential narrowed to one surface, one purpose, one expiry. a seat with a login is a seat that will eventually use it for something adjacent, and the vault exists to make that impossible rather than discouraged.

**level 3, one-time grants.** for a task that needs one action with no standing access, the supervisor mints a single-use grant (agentvault-style) and performs or delegates exactly that action. the primary worker never receives the secret, which means a compromised worker cannot retain access it never held.

the default is level 3 and it is chosen more often than feels efficient. the reason is attribution: a grant that exists for one call is a record that says what was done with it. a session that lives for a day produces a record that says a session existed.

## the supervising seat may refuse to hand off

this is a policy with an obvious cost and a specific benefit.

the org may decide that a task does not need delegated access, and the supervisor performs the action itself, using its own custody, while the worker directs it. slower, and it keeps the number of live credentials in the system small.

the benefit is that handing off access is a *permanent widening that nobody records*. the worker finishes, moves on, and the credential outlives the reason it existed. if the org's default is to hand off, it will accumulate standing access across the month and nobody will be able to say why any particular grant exists. this is the same failure as authority drift in [02-org-chart](../02-org-chart/readme.md), one layer down.

## browsers are unattended infrastructure

the org runs browsers, and unattended browsers meet anti-automation everywhere: signups, dashboards, uploads, support portals. so the org uses stealth-capable sessions (kernel-style) as a managed capability rather than a lambda per action.

two rules keep that honest:

- **stealth is for the org's own accounts.** it is used to hold a session on a service the org legitimately has, not to scrape or automate a third party's site against their terms. this line matters because the capability does not enforce it and the org's own judgment has to.
- **a browser session is a credential.** it carries every login it touched. sessions expire on a clock tied to the task that opened them, and a session that outlives its task is a finding in the audit, not a convenience.

## money

fiat only. the org may receive payment and spend within a mandate. it may not hold, move, or speculate on instruments of any kind: no crypto, no tokens, no minting, no trading of anything, and no "treasury" function that turns holding into a strategy.

this is a short list and it is the whole policy, because the interesting part is why it is absolute rather than calibrated.

**reversibility.** fiat rails have chargebacks, holds and disputes. irreversible rails turn every agent error into a permanent loss, and a system that can lose money permanently needs a human on the seconds clock, which contradicts the entire premise.

**accounting.** multiple revenue streams are required and each has to be measurable separately. that is straightforward when every movement is a card or a transfer with a statement. it is not straightforward across chains and tokens, and an objective whose metric cannot be recomputed from a statement cannot be audited.

**self-reference.** this is the one that actually decides it. if the org earns by trading, its objective metric becomes its own profit and loss, which it can move by choosing its own bets. measuring yourself by your own bets is not measurement, it is a mirror. the org may earn by building and maintaining things other people pay for, because the payer is external and their payment is evidence. it may not earn by moving money around, because then the evidence is the org's own positions.

## rails

the org's payment authority is separate from its deploy authority, and separate again from its credential custody. three permissions, three ceilings, three audit entries.

for machines paying and being paid, the working set is the card networks' agent layers and the processors' equivalents: mastercard agent pay, visa intelligent commerce, and the stripe agentic commerce suite with scoped shared payment tokens rather than raw card numbers in an agent's context. the shape is what matters and it is the same at every provider:

- **a mandate**, written, with a total ceiling, a per-transaction limit and an allowlist of counterparties.
- **scoped tokens** that expire and that cannot be replayed outside their intended purchase.
- **a statement** that the auditor can reconcile against the objective's metric without asking the org what it did.

a payment is the one action in the system that is both irreversible and adversarial by default: the counterparty is a stranger who benefits from the org being wrong. it gets the same treatment as a deploy, with a stricter ceiling and a lower autonomy mode.

## multiple streams, one ledger

each revenue stream is an objective with its own metric, its own horizon, and its own kill criterion ([09-doubling-down](../09-doubling-down/readme.md)).

the org may not net them. a stream that loses money hidden inside a total is scope drift in finance, and it is the most comfortable kind of drift because the total looks fine. gross, per stream, always.

## what breaks without this

without custody separation, every worker holds a login and the secrets outlive the work. without one-time grants, attribution degrades into "a session existed". without the fiat-only rule, a single failure is permanent and the human budget in [03-autonomy](../03-autonomy/readme.md) becomes fiction. without per-stream accounting, the org cannot tell a business from a hobby with revenue.

## what we do not claim

that a mandate plus a ceiling is safe. it bounds the loss per action, not the number of actions, and a org making a thousand small correct payments can still spend a month's budget on the wrong thing. the defense against that is the objective's metric and the auditor, not the payment rail.
