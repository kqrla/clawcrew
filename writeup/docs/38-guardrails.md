# 38 · guardrails, and why "done" is not a word a seat can use

two mechanisms, and they answer different halves of the same fear: a seat doing something it was never
given, and a seat declaring finished something that was never checked.

## guardrails: prevention in two layers, detection third

| layer | where | what it stops |
| --- | --- | --- |
| **L1 issue** | `toolsForSlice` | the seat is handed its slice's tools and never learns the others exist. blast radius is empty, not policed |
| **L2 invoke** | `judge` in `gateway.ts` | a granted tool used from the wrong surface, a scoped argument outside the grant, a call that would cross the daily ceiling, a seat already struck out |
| **L3 propose** | `auditProposal` in `turn.ts` | a proposal that reached across a slice, or claimed an advance with no artifact |

L3 is the one everybody builds, and it is the weakest, because it runs after the tokens are spent and
the tool may already have been called. So the gateway is the layer that matters: it sees the arguments
at call time and it is ours, not a library's. That is the whole reason the framework question kept
coming back to "no": a tool registry inside a framework is a second authority model, and with two
authority models, the more permissive one wins.

### the difference between a mistake and a reach

`consequence()` decides what the org does, and it lives next to the verdict so the two cannot drift:

- **spend and malformed arguments** are arithmetic. No strike, retryable, the seat gets the code and
  can try again.
- **surface or tool it was never given** is a reach. Strike, no retry, and on the second one the seat
  freezes. A seat that wandered once is a mistake; a seat that keeps testing the boundary is a
  finding, and coaching it back inside by re-prompting teaches it the boundary by braille.
- **scope outside the grant** (another repo, another branch) ends the turn without freezing, because
  the seat's competence is intact and its reach is not.

Two strikes is the limit (`STRIKE_LIMIT`), and the freeze is the same verb the lifecycle already
defines, so a frozen seat releases its lease rather than holding it.

## completion: a chain, and one link you cannot sign yourself

a task's kind declares its chain in `checkpoints.ts`. `evaluateCompletion` returns `ok` only when
every step has a passing run, with a reference of a scheme the kind accepts, in an order that
timestamps support, and at least one link signed by somebody other than the author.

- **never ran** and **failed** are different sentences, because one is a plan gap and the other is a bug.
- **self_signed** is the important one. `tested` may not be signed by the seat that wrote the code, and
  `settled` may not be signed by the seat that priced it. this is the same rule as the objective
  ledger's external source, applied to the parts of a job instead of the job.
- **out_of_order** compares timestamps, not arrival order, because a test signed before the merge it
  depends on ran against something else, and the surface-level tick boxes look identical either way.
- **evidence_kind_mismatch** routes through `evidenceFits`, so a code task cannot be closed on a
  `stripe:` reference, and a checkpoint cannot be closed on a paragraph.
- latest run wins, so a pass cannot be buried under a later failure, and a failure cannot be buried
  under an earlier pass.

### the chain stops at the slice boundary

the first draft of the code chain ended with `deployed`. it failed its own test, correctly: `deploy:`
is not evidence the `code` kind accepts, because deploying is `ops` work on `runtime.deploy`. the
chain now ends at `merged`, and the deploy is a separate task in a different slice with its own chain
ending at `handed`. this is the same rule as the toolbox: a seat may only evidence what its surface
makes.

## what this closes and what it does not

closed: a seat cannot widen its reach by asking nicely, cannot sign its own work off, cannot declare
done on prose, and cannot reorder its way past a check. each refusal is a typed code, so the histogram
of why the org stalled is a query, not an investigation.

not closed: nothing counts strikes yet, because nothing runs turns yet. `STRIKE_LIMIT` is a constant
with no store behind it, which makes it a policy the org must respect rather than one it cannot
ignore, exactly like the depth-before-breadth rule in `scope-management/`. the store is two columns on
the seat table and one insert on refusal, and it should be the next thing built rather than another
module.
