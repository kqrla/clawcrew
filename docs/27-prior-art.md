# 27 · prior art: hierarchical multi-agent systems that model an org chart

read against this spec, so the question is narrow: what have other people already
decided about organizing agents into a hierarchy, and where did they land on the
same columns we did.

depth is uneven and it says so per system. nothing here was taken as a
dependency, and no code was copied: the value is in the shapes people arrived at
independently, and in the mistakes they made that we have already paid for.

| system | what it is | how deep |
| --- | --- | --- |
| [paperclipai/paperclip](https://github.com/paperclipai/paperclip) | self-hosted product: org chart, budgets, approvals, portable company export | read the schema of eight tables and two services. did not read the run loop |
| [camel-ai/camel](https://github.com/camel-ai/camel) | `Workforce`: in-process hierarchical coordinator | read `workforce.py` (6,314 lines) selectively, `task_channel.py` (326), `worker.py` (230) |
| [microsoft/autogen](https://github.com/microsoft/autogen) | `MagenticOneGroupChat`: the standard plan/act/stall loop | read `_magentic_one_orchestrator.py` (536) nearly whole |
| [geekan/MetaGPT](https://github.com/geekan/MetaGPT) | SOP-driven roles on a shared message pool | read the addressing model only |
| [openai/swarm](https://github.com/openai/swarm) | handoffs as function calls | read `core.py` (about 300 lines) |
| [crewAIInc/crewAI](https://github.com/crewAIInc/crewAI) | `Process.hierarchical` with a manager agent | read the process/branch logic only |

---

## 1 · Paperclip is the closest thing to this spec, and it already shipped

it is a self-hosted Node/React app that models a company: agents get managers,
job descriptions, budgets, approvals, and tasks. it is the product form of what
docs/01 and docs/21 are trying to be.

**their `case_handoffs` table (migration 0363) is our task row, plus four things
we do not have.** columns that matter:

```
version, from_agent_id, to_agent_id, phase, instructions,
expected_issue_status_version, applied_issue_status_version,
wakeup_request_id NOT NULL, idempotency_key, input_fingerprint,
state, attempt_count, next_attempt_at, lease_expires_at
```

`attempt_count`, `next_attempt_at` and `lease_expires_at` are docs/25's
`attempts`, `next_action_at` and `custody_expires_at`. they arrived at the same
three columns from a running product; we arrived from the failure modes. that is
the strongest support the liveness design has, and it is the kind you cannot get
from reading a paper.

**budgets are a policy plus a reservation, not a number.** `budget_policies`
carries `scope_type`/`scope_id`, `window_kind`, `metric`, `warn_percent`,
`hard_stop_enabled`. `budget_reservations` is the state machine that spends
against it: `amount_cents`, `state in ('held','settled','released')`,
`provider_started_at`, `settled_at`. a reservation is to money what our custody
lease is to a time-boxed shift, and the analogy is exact enough to copy.

**identity is Ed25519, per agent.** `agent_identity_keys` stores
`algorithm` (constrained to Ed25519), `key_id`, `public_key_pem`, and
private material as encrypted jsonb. `server/src/services/agent-identity.ts`
validates that the derived public key equals the stored one and that `key_id` is
a fingerprint of the SPKI encoding, and it refuses to provision on a read. that
is the signed-card mechanism, already decided, and we should not invent our own.

**briefs are versioned with a head pointer.** `agent_instruction_revisions`,
`agent_instruction_heads`, `agent_instruction_working_copies`: a rewritten brief
is a new revision with a head that moves. attribution comes for free.

**the human gate is a row.** `approvals` (`type`, `requested_by_agent_id`,
`status`, `payload`, `decision_note`, `decided_at`) and `approval_comments`. not
a channel, not a notification: a record that can be waited on.

what paperclip does _not_ appear to have, from what i read: database-level
enforcement of its own state invariants (its checks are in application code), a
hash-chained audit log (`activity_log` is a table, not a chain), and a
progress-based spin detector. i did not read enough of their runner to claim the
last one is absent, only that i did not find it.

---

## 2 · CAMEL `Workforce` is the most complete in-process hierarchy

one coordinator object owns everything. `WorkforceMode.AUTO_DECOMPOSE` versus
`PIPELINE`; `_decompose_task` splits a task into children with an LLM;
`TaskChannel` (326 lines) is the queue with packet statuses, `post_dependency`,
in-flight tracking per publisher, and archiving.

the part worth stealing is `_analyze_task` → `TaskAnalysisResult` with
`quality_score`, `issues`, `reasoning`, and a `recovery_strategy` that
`_apply_recovery_strategy` then carries out:

- `RETRY`: re-post to the same worker
- `REPLAN`: rewrite `task.content`, then re-post to the same worker
- `REASSIGN`: hand to a different worker

**they distinguish "the holder failed" from "the brief was wrong".** we do not.
our `attempts` counter treats both as one attempt toward `maxAttempts`, so a
mis-specified objective burns three good holders and then blocks for a human,
which is the most expensive failure mode we have.

their weakness is structural and it is the thing this design exists to fix: the
channel is memory in one process, custody is a field the coordinator mutates, and
a restart loses the org. `docs/25` moves that state into rows with constraints for
exactly this reason.

---

## 3 · AutoGen Magentic-One is the standard stall loop, judged by a model

536 lines, two ledgers. the **task ledger** holds facts and a plan. the
**progress ledger** is a JSON the orchestrator's model fills each turn:

```
is_request_satisfied, is_progress_being_made, is_in_loop, next_speaker, instruction_or_question
```

`_n_stalls` counts bad answers and `max_stalls` bounds it. on exceed, it updates
the task ledger and re-enters the outer loop. two details are better than ours:

**the counter decays, it does not reset.** `_n_stalls = max(0, _n_stalls - 1)`
when progress is seen. ours resets to zero on every `progress` call, so three
renewals plus one trivial artifact keeps a seat alive forever. a decay is not
sufficient either, but it is strictly harder to game than a reset.

**the loop is guarded by turn count as well as stalls** (`max_turns`), so a team
cannot orbit forever while looking busy.

what to refuse: their progress judgment is a model's opinion of its own progress.
our `progress_version` is a column. the standing rule is that convergence must be
a code-computed fact over rows, and Magentic-One is the counter-example that
shows why the rule exists: an agent that believes it is making progress is the
cheapest thing in the system to fake.

---

## 4 · MetaGPT routes on a blackboard

`Message.send_to` is a **set** defaulting to `MESSAGE_ROUTE_TO_ALL`
(`metagpt/schema.py:241`), and `Environment.publish_message(msg, peekable=True)`
(`metagpt/environment/base_env.py:175`) puts it where anyone can read it.
`Team.run_project(idea, send_to=...)` sets a route for the initial message only.

this is routing by name onto a shared surface. nobody is assigned, nobody
accepts, and a message can be read by every role or by none. our relay row with a
receipt and an acceptance is the correction.

---

## 5 · OpenAI Swarm: a handoff is a variable assignment

`swarm/core.py` is about 300 lines. a handoff is the model returning a function
call whose result swaps `active_agent` in the loop (line ~149) and the loop
continues with the new agent. there is no state, no record, and no acceptance. it
is the cleanest statement of the anti-pattern the handoff row exists to replace:
in Swarm, a handoff that nobody accepted is indistinguishable from one that was
carried out.

---

## 6 · CrewAI: hierarchy one level deep, decided by a model

`Process` has `sequential`, `hierarchical`, and a `consensual` TODO
(`lib/crewai/src/crewai/process.py:4`). hierarchical requires `manager_llm` or
`manager_agent` or it errors (`crew.py:729`), and the manager is the executing
agent for tasks (`crew.py:494–505`). one manager, one level, assignment by
prompt. it is a supervisor, not an org: nothing below the manager has authority,
and nothing above it has a metric.

---

## 7 · what all of them converge on

plan → assign → execute → judge → recover, with four recovery verbs: retry,
rewrite the brief, reassign, escalate. every system that runs for more than a
task has had to invent the fourth one. **we are the only one of the six with no
"rewrite the brief" verb**, and we have the constraint that makes it necessary:
a blocked row costs a human contact, and we are budgeted at fewer than five a
month.

## 8 · what none of them do

- **no constraints.** none enforce their own invariants in the database. ours can
  refuse a row that has no deadline (`task_nonterminal_deadline`) or a done row
  without evidence (`task_done_evidence`). a check in application code is a
  check that the next caller can forget.
- **no code-computed progress.** Magentic-One and CAMEL both ask a model whether
  the work is going well. `progress_version` does not have an opinion.
- **no chained audit.** paperclip has `activity_log`; nobody has a hash chain.
- **no acceptance.** paperclip is closest (`state`, `idempotency_key`,
  `wakeup_request_id`), and everyone else treats a handoff as a message.

## 9 · four things worth taking, ranked

**a. budgets as policy plus reservation.** we have `tier.budget jsonb NOT NULL`
and **zero call sites that read it** (`grep -rn budget backend/src` returns the
tick's work budget and a comment). we store a spending limit and never enforce
it, which in a dark factory is the exposure that matters most. take paperclip's
shape: a policy per scope with a window and a warn/hard-stop split, and a
reservation with `held → settled | released` that is taken before the spend and
settled after.

**b. Ed25519 identity keys.** `key_id` is the fingerprint of the SPKI encoding,
private material is encrypted at rest, and the public half is readable without
provisioning. this replaces the "sign entity cards for parent verification" item
on the backlog with the standard shape instead of a bespoke one.

**c. replan as a verb distinct from retry.** a rewrite of the brief, attributed
to the tier that wrote it, that resets the attempt count and bumps the objective
version. without it, our recovery vocabulary cannot express the most common
failure in the system.

**d. `idempotency_key` plus `input_fingerprint` on claim.** a replay against
changed inputs is a different operation, and today nothing distinguishes them. we
have `progress_version` for ordering but no guard against delivering twice.

## 10 · what not to copy

- **the single in-process coordinator** (CAMEL, CrewAI, AutoGen). that is the
  thing being replaced.
- **model-judged progress** (Magentic-One). it violates the standing rule that
  the metric be computed, not reported.
- **blackboard routing** (MetaGPT). readable by everyone, owned by nobody.
- **stateless handoff** (Swarm).
- **a manager as the hierarchy** (CrewAI). a manager is a router with a title.

## 11 · the gap this reading leaves us with

`progress` resets the spin counter to zero, and progress is self-reported by the
seat that benefits from it. Magentic-One's decaying counter is a mitigation, not
a fix. the fix is the one thing in our design that the others lack entirely: tie
`progress` to the objective's **external metric** moving, so the only way to reset
the counter is to change a number we compute somewhere else. paperclip puts
`metric` on `budget_policies` and nowhere on the work itself; CAMEL has
`quality_score` from a model. nobody has closed that loop, and it is the loop
this project exists to close.
