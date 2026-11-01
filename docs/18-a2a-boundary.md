# 18 · a2a at the boundary

## the three repos, briefly

none of them is an a2a implementation, and none is a base to fork for one.

| repo | what it actually is | what it would cost | worth taking |
| --- | --- | --- | --- |
| [`block/buzz`](https://github.com/block/buzz) | a self-hostable workspace on a nostr relay: 3.1k commits of rust, a desktop app, mobile clients, channels, git events. apache-2.0 | forking a platform. you inherit its release cadence, its nostr model and a rust toolchain | the identity idea: agents are members with **their own keypair**, so every message is a signed event in the same log as a human's. that is the audit design in [09](09-audit.md), built by someone else |
| [`MapleTechLabs/hazel`](https://github.com/MapleTechLabs/hazel) | a chat app on cloudflare durable objects, effect-ts, tanstack db. 2.6k commits | runtime lock-in. the interesting part is the durability model, not the chat | one object per org/channel with its own sqlite, and a transactional outbox between objects. good pattern, wrong home for a system whose record is postgres |
| [`tashfeenahmed/circlechat`](https://github.com/tashfeenahmed/circlechat) | the closest thing to this project's surface: agents as first-class members, typed action allowlist, approvals, a verification gate, decision memory. mit, typescript, fastify, postgres 16 | less than the other two, and it is the only one where the stack matches | the **surface**: transcript view, approval ux, reply-guard. these are the parts of an agent org that humans actually touch |

circlechat deserves a longer note because it is genuinely good and dangerously adjacent. its authority is a **typed action allowlist** enforced by the platform (`post_message`, `react`, `update_task`, ...), and its safety valve is a human approval click. ours is a credential intersection computed down an ancestor chain. the first is easier to build and much easier to bypass: the allowlist decides what an agent may *say*, not what it may *do* to a surface it was never granted. it also has no crossings, no secondments, no objective ledger and no external metric rule.

so: mine circlechat for the ui, do not adopt its permission model.

## why a2a is a port, not a platform

a2a describes how two **opaque** agents exchange a message and run a task. an agent card advertises what an endpoint accepts; `message/send` delivers a message; a task moves through `submitted → working → input-required → completed / canceled / failed / rejected`; artifacts ride along.

it does not describe authority. anyone who can reach the endpoint can send a message, and the protocol has no concept of whether that sender was allowed to ask. that is not a flaw, it is the boundary: a2a is designed for agents that do not share an owner.

which is exactly why it belongs behind `relay()` and `crossing`. a2a says what the bytes look like. the crossing says whether the door exists.

## mapping

| a2a | orchart | the caveat |
| --- | --- | --- |
| agent card | a **narrowed** card generated from the crossings | skills are derived from what was authorized, never from what the circle can theoretically do |
| `message/send` | a relay envelope | the envelope still needs a `crossing`, a rate, a hop bound and a dedupe key |
| task | a handoff | responsibility, not just correspondence |
| `completed` | **a claim** | same guard as a closed plane card. `completionIsAClaim()` |
| `input-required` | blocked, or an approval card | the remote is asking; nothing has moved |
| artifact | `artifact://sha256:…` | content hash, never a url |
| push notification | the ticker and the escalation ladder | a2a has the hook, the policy is ours |
| security scheme | crossing + grant | two controls, not one: who may call, and what the call may touch |

## three rules at the boundary

**1. identity comes from the transport, never the payload.** an a2a message is untrusted input. a self-declared `from` field is a claim, and `messageToEnvelope()` rejects a mismatch rather than resolving it in the payload's favour.

**2. the card is narrowed before publication.** it is the only part of the org outsiders can read, so it says what this endpoint accepts and nothing about where it sits: no parent, no siblings, no objectives, no grants, no seat ids. a card that leaks the tree is an org chart handed to a stranger.

**3. a completed task is a claim.** the remote saying done is an event about the remote. it is not evidence about us, and it cannot close an objective. this is the third time the same rule appears, which is the point: plane, karakeep and a2a are all just places a claim can arrive from.

## what a2a actually buys

- **interop with agents we do not run.** another org, a vendor, a customer's assistant. without it, the only agents that can talk to this org are the ones it spawned.
- **a task lifecycle vocabulary others already implement.** handoffs stop being an internal dialect.
- **discovery.** `.well-known/agent-card.json` is a real convention.

## what it does not buy

- no authority, no objectives, no dedupe, no hop bound, no rate limit, no secondment
- no proof the remote did the work, only that it said it did
- no notion of a partition set converging, which is the whole problem in [17](17-sandbox-permeability-and-convergence.md)

## being reachable is a cost

a published card is a published attack surface. three separate controls are needed and none substitutes for another:

1. **authentication** at the transport (token, oauth, mtls)
2. **a crossing** declaring that this pair may exchange this kind of thing
3. **rate limits** on the door, because a valid caller can still be a runaway loop

## on the mastra article

its four patterns are useful vocabulary: supervisor, handoffs, workflows, council. **handoffs** is the one this project already implements as a state machine with an acceptance gate, which is the right level of rigour for a primitive that decides who owes work.

the piece to disagree with is council. averaging several independent takes is a decent way to handle *judgment*, and a bad way to handle *truth*: three agents agreeing is not evidence, and a majority vote over a metric is how an org converges on a number nobody measured. use council where the output is an opinion. use the convergence barrier where the output is a result, because the barrier asks each partition for an artifact and then measures the parent.

## implementation

`src/ports/a2a.ts`, ~200 lines, 16 tests. all wire-format detail is isolated in that one file because the spec has churned its discriminator and method names between revisions.

## not done

- no `.well-known/agent-card.json` route
- no streaming or `subscribe`
- no push-notification registration (`createPushNotificationConfig`)
- no signed cards, so a card cannot yet be verified as issued by the circle it claims to be
- no key rotation for the transport credential, which is the gap that will matter first
