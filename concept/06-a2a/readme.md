# 06 · agent to agent

most "a2a" work is about interoperability: two agents built by different vendors discovering each other and exchanging a task. that problem is real and largely solved at the protocol level.

this folder is about a different problem, which the protocol does not solve: **an envelope that arrives intact can still destroy the organization**, because the receiver has no way to know whether the sender had the authority to send it, whether this is the same message it already processed, or whether the work it describes is still current.

## the envelope

every crossing carries the same small set of facts, and the set is deliberately small:

- **who sent it**, established by the transport, never by the payload.
- **where it is going**, a seat or a tier, not a role name.
- **what kind of thing it is**, from the fixed list in [05-collaboration](../05-collaboration/readme.md), because the kind determines the receiver's obligations.
- **a reference to the content**, not the content. a payload of prose is a payload nobody can verify.
- **an idempotency key**, chosen by the sender.
- **an expiry**, after which the message is dead rather than late.
- **a hop count and a path**, so a loop is detectable instead of infinite.

the absence of a large free-form body is the design decision worth defending. a message that carries a story invites the receiver to act on the story. a message that carries a reference invites it to resolve the reference, which either works or does not.

## identity comes from the transport

the single most important rule in this folder: **a sender's identity is never read from the message**. it is established by the channel that delivered it.

this is not a security nicety, it is what makes attribution possible at all. if identity is a field, then any seat can claim any identity, and every audit downstream is a record of claims rather than a record of events. when identity comes from the transport, the provenance in [07-provenance](../07-provenance/readme.md) is a record of what happened rather than a record of what was asserted.

the corollary is unpleasant and necessary: an agent card, the thing that describes what a seat can do, must be **narrowed at the boundary**, not trusted as published. a card that says more than the caller's authority allows is a card describing someone else.

## delivery, honestly stated

the transport promises **at least once**. not exactly once, not in order, not within a deadline.

this is not a limitation to be worked around, it is the honest description of any channel that can retry, and pretending otherwise produces systems that are correct in the diagram and wrong on the second delivery. so the receiver does the work:

- **idempotent by key.** same key, same effect, no second execution. the key is stored with the outcome, so a redelivery returns the original result rather than repeating it.
- **out of order is normal.** a receiver that needs ordering asks for it by referencing the predecessor explicitly, which makes the dependency visible instead of implicit in timing.
- **expiry is enforced by the receiver.** a message that arrives after its expiry is dead. processing it is worse than dropping it, because it applies a decision made about a world that has changed.

## default deny, and no inheritance

a door is open or it is closed. there is no ambient permission to talk, no inheritance of a parent tier's doors by its children, and no implicit reverse direction: permission to send from a to b does not permit b to reply to a.

the reply case is the one that always gets argued, and the answer is that a reply is a crossing in its own right. it is usually granted. it is not granted automatically, because "it was a reply" is precisely the reasoning an attacker uses and precisely the reasoning an auditor cannot check.

doors also carry a config hash, recorded with the message. this is a small detail with a large effect: the audit can later prove which version of the permission was open at the moment of the crossing, rather than which version is open now. those are different questions and only one of them is answerable after the fact without this field.

## crossing a tier boundary

traffic between siblings is not the interesting case. the interesting case is vertical: a child reporting up, a parent instructing down, a peer borrowing across.

vertical traffic is where authority is tested, because a child's report is a **claim** and a parent's instruction is a **grant of scope**. neither is a fact. the parent that treats a child's report as a measurement has given up its own metric. the child that treats an instruction as an expansion of its ceiling has escalated without an elevation.

## what breaks without this

without transport-derived identity, every downstream record is hearsay. without idempotency keys, at-least-once delivery becomes duplicate work, duplicate deploys, duplicate payments. without expiry, a message about a world that no longer exists is applied to the world that does. without the config hash, the audit can describe the rules as they are, never as they were.

## what we do not claim

that this replaces a standard a2a protocol. it sits above one: the wire format can be anything that carries a key, an expiry, a path and a reference. what is claimed is narrower and harder, that the envelope carries enough for the receiver to decide without trusting the sender, and that is the part protocols usually leave to the application.
