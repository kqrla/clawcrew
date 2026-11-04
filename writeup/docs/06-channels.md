# 06 · channels

## why channels exist

authority is a tree, so cross-branch work has no natural home. a channel is that home: a bounded space where seats from different tiers can resolve something together without creating a second reporting line.

a channel is **not** a chat room. it has a purpose, an authority limit, a protocol, an output and a cost cap. when it stops producing decisions, it is deleted.

## shape

```yaml
channel:
  id: ch.pricing-lab
  purpose: "set the q1 price for the team plan"
  members: [seat.cfo, seat.cpl, seat.cbo, seat.analyst]   # analyst seconded
  authority_limit: a1        # the highest class the channel may produce
  protocol: typed            # see below
  caps: {turns: 12, tokens: 60000, wall_clock: 45m}
  trigger: on_objective_amend | on_schedule | on_ask
  output: decision_record
  expires_at: 2026-11-07T00:00:00Z
```

## typed messages

free-form agent conversation is where multi-agent systems go to die: it burns tokens, produces summaries of summaries and ends without a record. every message in a channel is one of six types.

| type | carries | who may send |
| --- | --- | --- |
| `finding` | a fact with a source | any member |
| `proposal` | an option with a cost and an owner | any member |
| `objection` | a specific defect in a proposal | any member |
| `vote` | accept, reject, abstain, with reason | any member not authoring the proposal |
| `decision` | the chosen option, dissent, evidence | the channel's authority holder |
| `approval_request` | an action above the channel's limit | any member |

anything that does not fit one of these does not belong in a channel. it belongs in a transcript attached to a finding, or it belongs on a seat's own board.

## decision record

the only required output. a channel that ends without one has failed, and the failure is recorded.

```yaml
decision:
  id: dec.3a1
  channel: ch.pricing-lab
  question: "team plan price for q1"
  options: [{id: o1, price: 29}, {id: o2, price: 39}]
  votes: [{seat: cfo, option: o1, reason: "..."}]
  dissent: [{seat: cpl, option: o2, reason: "..."}]
  evidence: [obj.billing-retention, doc://pricing-research-2026-10]
  authority_basis: grant.4b21    # what made this decision legitimate
  approver: seat.cfo
  decided_at: 2026-11-03T14:20:00Z
  affects: [surface://billing/plans]
```

every decision names its **authority basis**. a decision without one is a suggestion, and downstream work may not cite it.

dissent is preserved, not resolved away. the point of keeping it is that it is the input to the monthly re-charter: a decision that shipped with a named objection is a candidate for reversal if the objection's concern materializes.

## cost control

- **turn cap** and **token cap** are enforced by the runtime, not by politeness.
- **no-change short circuit:** if no input has changed since the last run, the meeting is skipped and a `skipped_no_delta` event is written.
- **one question per channel.** a channel with three questions produces a decision nobody can cite.
- **no meetings about meetings.** a channel may not decide to create a channel. that is a manager's act, with a budget.

## anti-theater rule

agent debate is expensive and easy to mistake for work. two measurements keep it honest:

1. **decision yield** = decisions that changed a downstream task / channel cost.
2. **reversal rate** = decisions reversed within one cycle.

a channel below a threshold yield for two consecutive cycles is archived automatically. a channel with a high reversal rate is a signal that its authority limit is too low and it is deciding things it cannot really bind.

## relationship to the tree

a channel never grants authority. it produces a decision, and the decision is executed by a seat, in its home tier, under its own grants, at the class its surface requires.

this is why a channel can be cross-branch without breaking the single-parent rule. the meeting is a graph. execution is a tree.

## channels are in-band, crossings are out-of-band

a channel is the synchronous case: seats in one place, for one question, ending in one record. most cross-team traffic is not that. it is a proposal, a source, or a signal that needs to survive a wall and land on someone's board without either team sharing a session.

that is a **crossing** and a **relay**, specified in [17](17-sandbox-permeability-and-convergence.md). the split is: a channel changes a decision, a crossing moves an artifact, and neither one creates an obligation. only a handoff does that.
