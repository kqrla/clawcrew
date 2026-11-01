# 05 · collaboration

agents in an organization do not collaborate the way people do. there is no goodwill, no shared understanding built up over months, and no cost to asserting something false. so collaboration here is not a cultural property, it is a small set of **mechanical transactions** with defined obligations on both sides.

the design rule that follows: if two seats cooperate, the cooperation leaves a record that a third party could audit without asking either of them what happened.

## the four ways anything crosses

a seat is isolated by default. what may enter and leave is enumerated, and each kind of movement means something different. conflating them is the source of most confusion in multi-agent systems, because "the agent talked to another agent" covers four unrelated events.

**crossing.** a permissive read or write across a boundary, logged but not negotiated. cheap, frequent, and asymmetric: permission to read in one direction never implies the reverse.

**relay.** a message that crosses with a receipt. the sender learns that it arrived, which is a different fact from the receiver having acted on it. this distinction is why relay carries an idempotency key: redelivery is normal, double execution is not.

**handoff.** responsibility moves. the sender stops owning the task and the receiver starts. a handoff is not complete when sent, and not complete when received. it is complete when **accepted**, and acceptance is an explicit affirmation by the receiver, recorded with a timestamp and the state it accepted.

**secondment.** a seat is assigned into another tier for a bounded period, carrying its home authority narrowed by the host's ceiling. this is the only kind where an agent's identity stays fixed while its permissions change, which is why it is the one that most needs an expiry.

the four are ordered by cost and by how much they can break. a crossing that fails is a log entry. a handoff that fails silently is work that is nobody's, and that is how a month-long run loses a week.

## acceptance and bounce-back

the acceptance rule is worth stating on its own because it is the cheapest control in the system and the one most often omitted.

**a handoff is not real until affirmed.** the receiver either accepts, which transfers ownership, or returns it, which keeps ownership with the sender and states why. there is no third state where the message was delivered and everyone assumes it landed.

the bounce is not a failure. it is the receiver doing its job, because the common case for a bounce is a handoff that arrived without what it needed: a missing artifact reference, a scope the receiver cannot hold, a dependency that has not landed. without bounce, that handoff is accepted and then quietly stalls, and the stall is attributed to the wrong tier.

the sender's obligation does not end at the bounce either. a bounced handoff returns to the sender's queue, still owned by the sender, with the reason attached. it cannot be dropped by ignoring it.

## cooperation without trust

two seats collaborating cannot trust each other's prose. not because agents lie, but because a sentence like "the migration is done" is compatible with a dozen states, most of which are not done.

so the currency of collaboration is **references, not narratives**:

- an artifact is cited by content hash, so the receiver can verify it is the same bytes the sender saw.
- a claim is cited by the objective it serves and the measurement that supports it.
- a status is not a message, it is a query against the record.

this makes collaboration cheap in the good case and unambiguous in the bad case. the receiver does not need to evaluate a story, it needs to resolve a reference, and a broken reference is an error rather than a slightly stale summary.

## what a handoff is not

not an escalation. escalation goes up, to an ancestor with the authority to decide. a handoff goes sideways or down, to a peer better placed to do the work. mixing them means the org's vertical channel fills with operational traffic and the human channel fills with things a peer could have taken.

not a broadcast. a message to everyone is a message to no one, and it makes ownership ambiguous at exactly the moment it needs to be sharp. broadcasts are for notices, not for work.

not a merge. two seats that both worked on a surface have not collaborated, they have collided, and the resolution is the surface owner's, not theirs.

## what breaks without this

without acceptance, work disappears in the gap between sent and received, and every long run loses tasks that no one can point to a drop for. without references, collaboration degrades into agents summarizing each other, and summaries of summaries are how an org ends up with confident people describing a system that no longer exists. without distinct kinds of crossing, an audit cannot tell whether a message changed a fact or only announced one.

## what we do not claim

that this is how good human teams work. it is how a team works when nobody remembers yesterday, everyone is replaceable on an hour's notice, and nobody can be asked what they meant. the record is doing the work that memory and trust do in a human org, and it is a poor substitute for a good team. it is a decent substitute for no team at all.
