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
