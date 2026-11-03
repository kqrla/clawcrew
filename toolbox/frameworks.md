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

## elizaOS: the one that changes the answer at the edge

`elizaos/eliza` is not LangChain with a different name. it is MIT-licensed TypeScript, it exports
`AgentRuntime` from `@elizaos/core` with authorization, memory and plugin contracts as primitives,
and it ships the thing this repo would otherwise spend a month failing to build: connectors. Discord,
Slack, Telegram, X, an inbox, a browser, and a phone bridge, all as installable plugins behind one
interface.

run it through the four questions:

1. **task between processes** — its memory store, not our ledger. fails.
2. **who may call what** — plugins register actions and their own authorization; grants would live in
   a plugin config rather than in `toolbox/toolcalls.md`. fails as an engine.
3. **mid-write failure** — its loop is message-and-evaluator, not transactional steps. fails.
4. **unit of audit** — a runtime trace, readable by whoever runs the runtime. fails as the record.

so it cannot be the substrate. but the same four answers say where it is *better* than anything we
would write: a support slice needs a real inbox on a real platform, and the media slice needs a real
distribution surface. those are connectors, and connectors are the one part of this stack that is
pure commodity cost.

### the verdict: sidecar, not engine

run elizaOS as a **separate process at the edge**, with a contract narrow enough that it could be
replaced by a webhook in a week:

- the factory sends it a message with our envelope (`discourse.ts` claims, provenance, dissent).
- it posts, listens, and returns messages in the same envelope.
- every action it may take is a grant issued by us, and it holds no grant we did not issue. its own
  authorization layer is a second lock, never the only one.
- nothing it knows becomes fact here without passing a gate. a chat message is a claim, not a metric.

### what must be true before it may be adopted

not a vibe check, a promotion test, in the order the toolbox rule requires:

1. **licence and provenance recorded**, with the pinned version and its lockfile, in `oss.md`.
2. **an envelope round-trip**: a claim sent survives the trip to Discord and back with its evidence
   ref, author and `opposes` set intact. if it flattens to prose, it does not pass, and that is the
   failure this layer exists to prevent.
3. **a grant refusal**: with our grant removed, the sidecar must fail to act even though its own
   config would allow it. if it acts, we are trusting their authorization and the test fails.
4. **it ran once here** and produced an artifact in the repo, per the toolbox rule.

until all four hold it stays in *candidates*, below, and the support and media slices stay blocked on
connectors rather than pretending a webhook is an inbox.
