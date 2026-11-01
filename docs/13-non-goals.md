# 13 · non-goals

written down because scope creep is the failure mode this project exists to prevent, and the project is not exempt from it.

## not an orchestration framework

no graph api, no node-and-edge dsl, no plugin marketplace for "tools". if you want langgraph, use langgraph. orchart specifies an organization, not a way to wire functions.

## not free-roaming agent chat

agents do not discover each other and converse. authority follows the chart, and cross-branch work happens in a bounded channel with a decision record. emergent swarms are not a feature here.

## not a debate club

four models arguing is expensive and produces weak aggregation. evaluation and arbitration are specified as deterministic where possible, and as a single accountable decider where not.

## not a headcount simulation

no digital twin of a human org, no "hire 40 agents" fantasy. the chart exists to bound authority, and every node must pass the test in [02](02-org-model.md): does it change a decision, or only move one.

## not an enterprise compliance product

the audit trail is designed to be legible to a third party, but v1 does not ship soc 2 evidence collection, rbac for human teams, sso or dpa paperwork. those are real requirements and they are not this.

## not a model

orchart has no opinion about which model is best and no benchmark to sell. seats name models; the user brings keys.

## not multi-tenant in v1

one entity, one repo, one deployment. multi-tenancy is a later problem and pretending otherwise produces a permission model that is neither safe nor simple.

## not a place for personalities

seats have titles, not names, faces or backstories. the office metaphor is for legibility, not for attachment.

## not autonomous in the ways that matter legally

the entity is operated by agents; the legal person is human. contracts, filings and tax positions are drafted by seats and executed by a human or a licensed third party. anything else is a liability transfer this project will not design.

## not a trading operation

the org may be paid for work with fiat money and may spend within a written mandate. it does not hold, move, or speculate on instruments: no crypto rails, no tokens, no minting, no trading of anything, no treasury strategy that turns holding into a position.

three reasons, in order of weight.

**self-reference.** if the org's metric is its own profit and loss, it can move that metric by choosing its own bets, and measurement collapses into a mirror. revenue from a customer is external evidence. a gain on a position is the org grading its own homework, which the whole of `concept/10-adversarial-qa` exists to prevent.

**irreversibility.** card rails have disputes, holds and chargebacks. chain rails do not. a system that can lose money permanently needs a human on a seconds clock, and that contradicts the entire premise of a month-long run.

**accounting.** multiple revenue streams are required, and each has to be measurable separately against a statement. every stream is an objective with its own metric, its own horizon and its own kill criterion, and streams are never netted. a stream losing money inside a healthy total is scope drift in finance, and the most comfortable kind because the total looks fine.

concretely: mastercard agent pay, visa intelligent commerce, and the stripe agentic commerce suite with scoped shared payment tokens are in scope as payment rails, under a mandate with a total ceiling, a per-transaction limit and an allowlisted counterparty set. payment authority is a separate permission from deploy authority and from credential custody. a settled payment is one of the few actions in the system that is both irreversible and adversarial by default, and it is treated accordingly.
