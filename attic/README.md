# attic

two source documents this project started from, kept verbatim. neither is normative. `docs/` is.

## orchart-design-notes-v0.1.md

the first working draft, october 2026. it named the product, set the office metaphor (desk, badge, on ice, burning), and got the lifecycle vocabulary right.

what survived into `docs/`: the badge, freeze and burn, succession, the view-as read-only inspection, the principle that office language sits on the surface while the engine stays literal, and the requirement that the audit log has no flavour.

what did not: a fixed three-layer hierarchy with blocs demoted to "groupings, not a fourth layer", which cannot express the nested pyramid; no objective ledger; no drift control beyond a weekly brief and a readiness score.

## myboard/

a python reference implementation of an autonomous board for a founder with no board. MIT, by sairaj. 74 files: `src/core` (policy, state machine, router, sandbox, meetings, leads, context), `src/agents` (board, decision, action, governance, monitor, summarizer), `pipelines/`, `prompts/`, `tests/`, and exported runs under `docs/runs/`.

worth reading for four things:

- `src/core/policy.py` — a risk tag attached to an action decides how autonomous the agent may be. the gate is data, not prose.
- `src/core/state_machine.py` — the run is an explicit state machine, so a failed step is a state and not a stack trace.
- verification by execution. the agent runs real tests and reads the result; it cannot mark its own work passing.
- `docs/runs/` — exported transcripts of full runs. unusually honest evidence, and the reason the design holds up on inspection.

what it is not: it has no tiers, no authority model, no objective ledger, no leases, no surfaces, and its governance is a deliberative vote among model seats. in `docs/` terms it is a decision-review apparatus (a council) for a human founder, not an operating runtime for a fleet. `docs/13-non-goals.md` explains why council is not how convergence works here.

## how to use this

read `myboard` for mechanics, not architecture: the risk tag, the state machine, the test-as-proof pattern. read the v0.1 notes for product language. take structure from `docs/`.
