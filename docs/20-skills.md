# 20 · skills compound, and they rot

reference: voyager, an open-ended embodied agent (wang et al.). it writes a solved
task into a python function, stores it in a skill library, and retrieves it as a
tool later. no fine-tuning. behaviour is composed rather than re-derived.

the transfer to a business org is real, and the reason is economic: an org that can
only recall is an expensive memory. an org that accumulates tested capability is the
only version whose month gets cheaper instead of more expensive.

## what does not transfer

voyager's environment is fixed. minecraft's rules, blocks and crafting recipes do
not change between day 3 and day 40, so a skill that worked stays working, and
retrieval by embedding similarity is a good proxy for "this is still the right tool".

a live business is the opposite. a vendor ships v9 of an api, a price changes, a
table is renamed, a payment provider starts returning 202 instead of 200. the skill
still looks relevant to a similarity search. it is still what an agent reaches for.
it is now silently wrong, and it will keep being called by every tier that retrieves
it, because nothing in the loop checks the world.

that is the failure mode to design against, and it is the same shape as every other
failure in this spec: plausible, cheap, and invisible until it has propagated.

## four hazards, four rules

**1. rot.** a skill is only true as of the surface it was tested against. so a skill
carries `verifiedAgainst`, a fingerprint of that surface, and `lastVerifiedAt`. when
the fingerprint changes, or thirty days pass, `canInvoke` refuses. not because the
code changed, but because nobody has confirmed the world did not.

**2. retrieval conflates "worked before" with "works now".** retrieval keys on
surface and precondition first, keywords second: `select()` filters to the caller's
surface, drops anything unverified, and only then ranks. then the test runs before
the call. test-before-call is cheap and it is the whole difference between a library
and a liability.

**3. sprawl.** forty days of autonomy produces three hundred skills, most of them
near-duplicates with slightly different names, owned by nobody. `register()` refuses
the second skill with the same code hash on the same surface, and refuses a second
skill claiming the same intent on that surface. retirement is an event with a reason,
not a quiet deletion.

**4. authority laundering.** the one voyager did not have to care about, because
minecraft has no money. a skill is code that runs with the caller's credentials. if
a tier writes a skill that moves money and another tier retrieves it because the
description matched, the second tier has acquired a capability it was never granted.
the org chart has been bypassed through the library.

so invocation intersects: `effective = caller_grants ∩ skill.requires`. a skill can
narrow authority, never widen it. a skill that declares a requirement the caller does
not hold is refused, not escalated, because escalation on retrieval turns the library
into a privilege prompt.

## what this gives the audit

every invocation is an event carrying the skill id, its version and hash, the caller,
the effective grants, and the test artifact that justified the call. without that,
a state change exists in the record that no agent appears to have decided, and the
weekly auditor cannot tell the difference between a skill doing work and a system
doing something no one asked for.

## what is not built

- no scheduler that re-runs tests on a surface fingerprint change. the check exists,
  the trigger does not.
- no cross-tier skill sharing policy. today a skill is retrievable by any tier that
  holds the requirements, which is correct but coarse.
- no cost accounting per skill, so "this skill saves money" is still an assertion.
