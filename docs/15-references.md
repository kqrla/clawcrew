# 15 · references

what was read, what was taken, and what was deliberately left behind.

## prior art, and the specific debt

### myboard (`sairajmn/myboard`)

an autonomous board for founders with no board. four advisory seats on different models, a deterministic risk table, an append-only audit, and a real test run as the only accepted proof that code works.

**taken:**
- risk is derived from the event type by deterministic code; the model never decides risk.
- policy overrides the model, and when they disagree an override row is written.
- "tests pass" is never trusted; verification truth comes from an executed run with an exit code.

**not taken:** the deliberation core. four seats debating and voting is expensive, produces weak aggregation and no binding authority. myboard is also single-tenant, single-company, simulated-fixture, and has no per-seat identity, budget, lease or surface ownership. it is a useful set of three invariants, not a base to build on.

**verdict:** the url was worth reading for those three rules. it is not an architectural dependency and should not be cited as one.

### paperclip · org chart

closest product to this spec at the surface level: roles, a real tree, issue trees with blockers, review-then-approve chains, escalation up the reporting line.

**taken:** the review/approve chain as a first-class path on an issue, and blockers that name their unblocking condition rather than a vague "blocked".

**not taken:** its own capability table concedes the boundary this spec is built on. a role title does not grant access, a saved goal is not proof it was achieved, and task-completion review does not gate every command or external call. orchart moves authority into credentials and adds the objective ledger.

### multi-agent is an org chart (`bfrackowiak.pl`)

the best short argument that the primitives are identical: roles, handoffs, escalation paths, trust boundaries; context windows as span of control; fuzzy interfaces producing hallucinated handoffs.

**taken:** the framing, and three design rules that follow from it: push decisions down, allow direct channels between frequent collaborators, and define escalation criteria rather than escalation habits.

**not taken:** governance as a dial that never stops being tuned. that is true for human orgs because the dial is turned by people with preferences. here it can be turned by a rule table and measured by an auditor.

### anthropic · building effective agents (dec 2024)

the canonical taxonomy: prompt chaining, routing, parallelization, orchestrator-workers, evaluator-optimizer.

**taken:** the warning that most production systems should be a single well-tooled agent, and that complexity must be justified by evidence. orchart is not a framework for adding agents; it is a structure for the ones that already earn their place.

### clawbank

an operating system for zero-human companies: formation, banking, policy engine with scoped keys and spend limits, escrow, arbitration.

**taken:** the shape of the policy engine. scoped keys with per-key spend ceilings, so a leaked key is a bounded problem. orchart extends the same idea from spend to action.

**not taken:** the single-entity, single-agent assumption. clawbank gives an entity one operator; this spec is about many seats inside one entity.

### agenticorgchart.com · cellcog · developersdigest

reference material on the seven canonical topologies and four human-ai team patterns.

**taken:** vocabulary and the useful distinction between routing, review and approval as separate concerns.

**not taken:** topology as the deliverable. a topology diagram is a picture of a decision that has already been made about authority. this repo specifies the decision.

## standards and primitives worth aligning to

- **mcp** for tool transport. tool definitions pinned by hash; tool output treated as untrusted input.
- **oauth scopes** as the outer bound of what any adapter can request.
- **jsonl + sha256 chain** for the event log. boring, portable, auditable without a vendor.
- **openapi** for the adapter interface, so a self-hoster can implement one surface without adopting the whole engine.

## what is missing from the reading

no public work was found that specifies the **accountability** half of a matrix: cross-branch ownership with a single-parent authority tree. most systems either flatten the org to avoid the problem or allow multiple managers and lose approval clarity. section [04](04-secondments.md) is the part of this spec with the least prior art and the most to prove.
