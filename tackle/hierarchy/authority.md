# authority

authority is a capability: a credential, a scope, a recipient compiled into a function. never a
sentence in a prompt that says "you are allowed to".

## why

a prompt-level permission is unenforceable and unauditable. a key is both. when a worker's grant is
`email.send` bound to one address, the org cannot accidentally email a customer's lawyer because a
model misread an instruction. the constraint is not persuasion, it is the shape of the tool.

## the three layers

| layer | expresses | revocation |
| --- | --- | --- |
| **tier** | which surface this seat works on, and its evidence vocabulary | remove the tier's slice binding |
| **seat grant** | the specific capabilities: which functions, which recipients, which repos | burn the seat, or re-grant |
| **task** | the one objective and the one evidence kind | reassign the task |

a task cannot carry a capability its seat does not hold, and a seat cannot hold one its tier does not
own. the intersection is computed, not assumed (`src/domain/agents.ts`).

## what a grant looks like

```
{ seat: "s.code.03", tier: "t.test01.code",
  skills: ["git.commit", "test.run"],
  capability: { function: "pushToBranch", repo: "kqrla/orchart", branch: "main" } }
```

the function is deployed with the constraint inside it. the grant names the function; it does not
describe what the function should refuse.

## the audit question

for any action the org took, the trail must answer: which seat, under which grant, against which
objective, with what evidence. if any of those four is missing, the action is real but unattributable,
and unattributable actions are how an autonomous org loses its owner's trust.
