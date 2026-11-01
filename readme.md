# orchart

*wordplay on the portmanteau for orgchart + orchestration*

an open-source office for ai agents that operate a software business, with human customers and a real chain of command.

this repository is the specification, not the implementation. it defines the org model, the authority model, the control loop that keeps a long-running agent organization from drifting off its objectives, and the surfaces a first build has to get right.

**status:** spec v0.2 plus a working backend v0.1, october 2026. comments and counterexamples welcome.

## the problem

a business run by agents is not a chat session with tools bolted on. it is a standing organization. roles persist across runs. work arrives without anyone asking for it. money moves. customers notice. once the thing runs for weeks instead of minutes, generation is not the bottleneck. coordination and drift are.

three failures define the design:

1. **authority leaks.** a role described in a prompt is a suggestion. if a worker holds ambient tool access, the org chart is decoration.
2. **work silently drops.** a task handed off to an agent that died is not an error anywhere. it is just gone.
3. **success is plausible instead of true.** thirty days of agents closing tickets produces something coherent-looking and wrong in forty places, and by then the wrongness is load-bearing.

orchart is built around the mechanisms that answer those three, and nothing else.

## what it is

- a **recursive org model**. one entity, the circle, at any depth. department, bloc, team and pod are labels a human puts on it.
- **authority that compiles to credentials.** effective permission is an intersection down the ancestor chain, never a sentence in a prompt.
- **a secondment model** for work that crosses branches, because real orgs are matrices even when authority is a tree.
- **shift leases and typed handoffs**, so a dead agent produces an alarm instead of a gap.
- **an objective ledger with executable sources**, and a weekly auditor that compares what the org claimed to what is measurably true.

## what it is not

not an orchestration framework, not a crew library, not a multi-agent debate club, not a headcount simulator. see [docs/13-non-goals.md](docs/13-non-goals.md).

## who it is for

one legal entity, many teams, human customers. the small end is a founder with five seats and one revenue-bearing surface. the large end is a saas where several teams own different surfaces and different revenue streams and no human reads the tickets.

the wedge is narrower than the vision: run **one** revenue-bearing surface end to end with three seats and a working audit trail before adding a second department. a tree that cannot close one loop will not close six.

## reading order

| doc | what it settles |
| --- | --- |
| [00-thesis](docs/00-thesis.md) | the argument, in one page |
| [01-principles](docs/01-principles.md) | nine rules that are enforced, not aspired to |
| [02-org-model](docs/02-org-model.md) | circles, seats, surfaces, depth |
| [03-authority](docs/03-authority.md) | grants, intersection, elevation, approval classes |
| [04-secondments](docs/04-secondments.md) | how the matrix resolves without two bosses |
| [05-shifts](docs/05-shifts-and-handoffs.md) | leases, on-call relay, parallel convergence, handoffs |
| [06-channels](docs/06-channels.md) | bounded meetings and decision records |
| [07-objective-ledger](docs/07-objective-ledger.md) | the set point |
| [08-control-loop](docs/08-control-loop.md) | shift, weekly, monthly clocks |
| [09-audit](docs/09-audit.md) | what a third party must be able to reconstruct |
| [10-lifecycle](docs/10-lifecycle.md) | freeze, thaw, burn, succession |
| [11-memory](docs/11-memory.md) | what is durable and what is derived |
| [12-runtime](docs/12-runtime.md) | where it runs and what it costs |
| [13-non-goals](docs/13-non-goals.md) | the things this refuses to become |
| [14-open-questions](docs/14-open-questions.md) | unresolved, deliberately |
| [15-references](docs/15-references.md) | what was taken from whom, and what was not |
| [backend](backend/readme.md) | the working v0.1 engine: stack, plugin surface, 60 tests |

diagram: [diagrams/org-model.svg](diagrams/org-model.svg)

## changes from v0.1

- **depth is unbounded.** v0.1 fixed three layers and declared blocs a grouping rather than a layer. that could not express a department containing blocs containing teams, which is the thing being specified here.
- **the matrix resolves.** v0.1 gave a worker one home manager and many bloc memberships but never said who owns a cross-bloc outcome. secondments name the deliverable owner.
- **drift control exists.** v0.1 had a weekly brief and a readiness score, which are outputs. this version adds an objective ledger, an executable-source rule and an independent weekly auditor.
- **market corrected.** v0.1 aimed at pre-launch solo founders. the brief is an agent-operated saas with human customers and several revenue streams. solo founder is now the small template of one model, not the definition.
