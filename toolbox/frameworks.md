# frameworks: what to fold in, and what to decline

the question arrives with every new stack: adopt LangChain, LangGraph, CrewAI, AutoGen, Temporal,
the OpenAI Agents SDK, or keep building the runtime. the answer here is **build the runtime, adopt the
wire formats**, and the reason is specific to what this system already is.

## the test a framework has to pass

a framework must be able to answer four questions before it may own any state here:

1. **where does a task live between two processes?** if the answer is "in the agent's memory", it
   cannot survive a restart, and a month-long org restarts.
2. **who is allowed to call what?** if tool grants are registered inside the framework, then the
   grant is not reviewable as a config diff, and authority has moved into a library.
3. **what happens when a node fails mid-write?** if the answer is "retry the chain", then the
   idempotency the ledger depends on is gone.
4. **what is the unit of audit?** if the framework's trace is the only record, the audit trail is a
   vendor artifact rather than something a third party can read.

LangChain, CrewAI and AutoGen answer 1 with in-process state and 2 with a tool registry. LangGraph
answers 2 better and 1 with a checkpointer, but the checkpointer is a second state model next to
Postgres, and two state models drift. Temporal answers 1 and 3 properly and would be the right choice
for the scheduler if it did not already exist here. the OpenAI Agents SDK is a good client for a
model, not a substrate for a business.

## what this repo already owns

leases with heartbeats, a hash-chained event log, reservations, custody over completed work,
objectives with external sources, project phase gates, readings and corroboration, the auditor, and
the four agent verbs. every one of those is a thing a framework would sell back as a feature, and
each is a few hundred lines because the domain is narrow. folding in a framework now would put a
second, less auditable state model between the seat and the ledger.

## what to adopt, and it is the wire, not the engine

| adopt | why | what it does not solve |
| --- | --- | --- |
| **A2A** (agent cards, tasks, artifacts, streaming) | interop with agents outside this org, and a discoverable capability card is the same object as a grant | semantics: it carries a message, it does not say what a claim is, so it cannot stop a merge from flattening disagreement |
| **MCP** | tool interfaces that other people's servers already speak | authority. an MCP server's tools still need a grant and a scope here |
| **OpenTelemetry** | traces into whatever the operator already runs | truth. a trace shows what happened, not whether the number is right |
| **a model client** (any vendor, swappable) | the model is a dependency, not an architecture | everything above |

## the consequence, stated plainly

nuance is not lost in transport. it is lost in *synthesis*, which is why [35](../docs/35-a2a.md)
defines a claim with provenance and a merge that must account for every claim it was given. A2A gets
two seats talking across a boundary. the conservation rule is what stops the answer from being a
summary of the answer.

## elizaOS: corrected

the first version of this section argued for `elizaos/eliza` on its connectors: Discord, Slack,
Telegram, X, an inbox, MIT licensed, one plugin interface, TypeScript. that argument was wrong, and
the way it was wrong is worth keeping.

**it invented demand.** no slice in this set declares a chat surface. the twelve surfaces are
`design.asset`, `code.change`, `research.signal`, `security.control`, `payment.rail`, `media.asset`,
`runtime.deploy`, `oncall.roster`, `ledger.record`, `support.inbox`, `doc.page`. a support seat
reaches the world through `support.inbox` and nothing else; a design seat cannot post anywhere at
all. so a plugin shelf of channels is not capability here, it is blast radius, and it would have
arrived as a "nice to have" that no contract asked for.

that is now a check rather than a lesson: see [`toolbox/index.json`](index.json) and
`backend/src/domain/toolbox.ts`. a slice-held tool must name a surface that some slice provides, an
engine-held tool must name none, an adopted tool must show something it produced in this repo, and a
rejection must say why. an entry with no holder is one nobody may pick up, which is the only honest
status for a dependency nobody needs yet.

elizaOS stays a candidate for one narrow reason, and it is not connectors: its claim-carrying. if a
slice ever declares a chat surface, the question is whether a message survives the round trip with
its evidence refs, author and disagreements intact. that test stands. the rest of its runtime is
still refused on the four questions above, for the same reasons as LangChain.

