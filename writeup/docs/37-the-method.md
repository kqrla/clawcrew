# 37 · the workable method

no framework, and nothing exotic. four sentences, then the code that holds each one up.

**the org's memory is rows.** a seat is a row with a lease, a task is a row with a state, a claim is a
row with its provenance. a process that dies mid-turn loses nothing, because it was never holding
anything: restart is free, and the ledger does not care which machine wrote the row.

**the org's speech is claims.** every crossing carries atomic claims with a kind, a confidence, an
evidence reference or an explicit gap, and an author. A2A, Postgres, HTTP, a file on disk — the
transport is replaceable because the semantics live in the payload.

**the org's authority is a table.** a grant names tools, the toolbox binds each tool to one slice
surface, and the ontology says which surfaces exist. there is no registry of capabilities inside a
library, so "who can do what" is a config diff somebody can review.

**the org's decisions are gates over rows.** a phase moves, a task closes, a project dies — each is a
pure function of rows and returns the unmet condition by name. nobody votes, nobody calls it done.

## the loop that makes it run

```
task row ──► seat (grant: its slice only) ──► model proposes
                                                   │
                        ┌──────────────────────────┘
                        ▼
              auditProposal: tools granted? surface right?
              artifact present? facts referenced? reason given?
                        │
             accepted ──┴── refused with codes
                 │                  │
          ledger writes         receipt row, retryable?
          task, claims,          codes say what to change;
          evidence refs          nothing is silently dropped
```

`runTurn` (`src/domain/turn.ts`) is that loop, and the model is a **port**: `propose()` takes the task,
the seat's own tools and the claims in scope, and returns a proposal. swap in a fixture, a local
llama, a frontier model, or a person filling a form, and nothing else in the system changes. that is
the whole reason no framework is needed: the framework's job is to be the only thing that knows what
an agent is, and here an agent is a row plus a grant.

## why the check runs after generation

a prompt is not a policy. a model told "you may only reply to support tickets" will mostly comply, and
mostly is a description of a rate, not a guarantee. `auditProposal` runs on the output, so compliance
is a property of the ledger rather than a hope about the weights. the refusal codes are also the
feedback signal: a seat that tried `stripe.charge` gets `tool_not_granted` and can try something else,
which is more useful than a silent no.

## what this buys, concretely

- adding a model provider is one file, and it cannot widen anyone's reach
- a turn costs a row plus tokens, so the org's spend is countable per seat per day
- every refusal is a typed code, so "the agent was confused" becomes a histogram
- a month-long run is restartable at any instant, because there is no in-memory agent to lose

## what is not built

nothing calls `runTurn` yet. there is no process that leases a task, calls a model, and writes the
result back, so the loop is correct and unexercised, same as the project gates before meenible. the
next honest step is not another abstraction: it is one operational script that leases one task for one
seat from `t.operations`, runs a turn against a real model through an OpenRouter key, and writes the
receipt — because until a dollar is spent and a row lands, "the org is running" is a claim with no
evidence reference.
