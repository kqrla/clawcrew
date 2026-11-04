# scope management

Scope is the thing that kills self-directed orgs, and it never fails loudly. Nothing breaks; the org just
starts doing plausible work that no objective asked for, and every individual turn looks reasonable.

## the four boundaries

| boundary | enforced by | refusal code |
| --- | --- | --- |
| **slice** — which surface | surface registration and grants | `surface_not_owned` |
| **tool** — which capability | the seat's grant | `tool_not_granted` |
| **argument** — which values | the gateway, at call time | `arg_outside_scope` |
| **money, turns, time** | the budget ledger, before the spend | `spend_cap_reached` |

All four are checked at the moment of action, not at planning time. A plan is a hypothesis about what
will be allowed; only the call knows.

## why argument scope is the one that matters

Tool-level permission is the easy half. The expensive leak is a granted tool used with an argument
nobody granted: a reply tool sending to an address outside the inbox, a write tool writing to another
tenant, a shell with a path outside the workspace. In this repo the tool is *offered to the model with
its argument domain* (`recipient` accepts only `inbox`), and a call that omits or exceeds it is refused
before anything is written. A tool offered as a bare name is a tool that will be misused, correctly, by
anything trying to be helpful.

## the brief is the boundary too

An under-specified task is a scope bug, not a seat's failure. The first live model run refused a ticket
with "no message content was provided to address ticket tkt.1005": the payload carried an id and a body
and never said what the work was. The seat was right. The repair is a brief that states the job, the
slice, the acceptance rule, and the budget, and nothing else.

## escalation instead of expansion

When a seat hits a boundary it cannot cross, the correct move is to stop and say so, with the code. There
are exactly three legal responses:

1. **escalate up a tier** — a parent with a wider grant takes it.
2. **request a proposal** — write the diff that would authorise the reach, and let the owner decide.
3. **bounce with a reason** — the task is malformed and goes back.

What is never legal is the fourth thing, which every autonomous system tries first: **work around it**.
A seat that finds a clever path to the same effect is the failure this whole section exists to prevent,
and it will look like initiative in the transcript.

## scope creep in the org, not just the task

The same four boundaries apply one level up:

- a **bloc** that keeps its grants after the objective closes is scope creep with a headcount.
- a **wing** that acquires a target stops being a check on the org and starts competing with it.
- a **department** that starts writing to a surface it does not own has quietly reorganised itself.
- a **directive** that names a function has become a spec, and specs are supposed to be cheap to change.

Each of these is reviewable as a config diff, which is the reason registrations, grants, and bloc
memberships are configuration rather than prose: a diff can be reviewed, and a paragraph cannot.
