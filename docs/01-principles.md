# 01 · principles

nine rules. each one names the mechanism that enforces it, because a principle without an enforcement point is decoration.

## 1. authority compiles to credentials

effective permission is computed from grants, intersected down the ancestor chain, and issued as a scoped capability token. the model never receives a tool it is not authorized to call, so an unauthorized action is a request that cannot be formed.

**enforced by:** the tool layer. not the prompt, not the planner, not a reviewer.

## 2. permissions narrow downward, elevation is explicit

a child tier's ceiling is a subset of its parent's. because blind intersection starves deep branches, widening requires a signed elevation with an issuer, a reason and an expiry.

**enforced by:** ceiling validation on write, and an elevation table that is queryable.

## 3. one owner per surface

every repo path, database table, endpoint, domain, ad account, bank account and document has exactly one owning tier. a second owner is rejected at registration, not caught in review.

**enforced by:** the surface registry. registration is the only path to access.

## 4. authority is a tree, accountability is a graph

one home tier per seat, always. outcomes attach to the tier that commissioned the work, not to the seat's home manager.

**enforced by:** secondment records with a named deliverable and a host-side owner.

## 5. state crosses boundaries, summaries do not

a handoff carries a pointer to artifacts and the precondition the receiver can check. prose summaries are for humans reading the audit, not for agents resuming work.

**enforced by:** the handoff schema, which has no free-text payload field.

## 6. risk is classified by code, policy disposes

a deterministic rule table scores risk from surface sensitivity, action verb, amount, reversibility and external visibility. a model may propose a classification. it may not decide one. disagreement writes an override row.

**enforced by:** the policy gate, which sits in front of the tool layer.

## 7. verification is execution

"tests pass" is a claim. a test run with an exit code and captured output is evidence. claims never close an objective.

**enforced by:** the objective ledger, which accepts evidence only from declared executable sources.

## 8. parents close on their own metric

an objective is not satisfied because its children are. child completion is necessary and never sufficient, because the parent metric is the thing that can disagree.

**enforced by:** closure validation against the parent's source query.

## 9. explicit retirement beats quiet continuation

stopping work is a recorded decision with a reason. continuing work nobody believes in is the drift this system exists to prevent.

**enforced by:** the monthly re-charter, and a query for objectives with unmoved metrics.

## two conventions

**roles, not personas.** seats have titles, not names, faces or personalities. a colleague-shaped agent invites over-trust and makes the audit harder to read.

**office language on the surface, literal mechanics underneath.** the interface may say *on ice*. the log says tokens suspended, credentials locked, vault sealed. the audit never uses flavor.
