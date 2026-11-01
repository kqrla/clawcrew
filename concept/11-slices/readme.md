# 11 · slices

the rule: **every seat sees a slice, and no seat sees the whole picture.**

this is not secrecy. it is a claim about output quality, and it is the least intuitive idea in the folder, so it needs an argument rather than an assertion.

## why full context makes an agent worse

an agent holding the entire specification, every objective, and the whole history will produce work that is *about* the whole thing. it will generalize, hedge, add a section on architecture to a task about a retry loop, and describe the system in the language of the system rather than doing one part of it.

call it slop, though it is not laziness: it is what an average over everything looks like. context is a prior, and a prior over the whole organization is a prior toward generality. generality is exactly wrong for work that has to be specific.

a narrow briefing produces narrow, checkable work. the agent knows its surface, its objective, its interfaces, and the standard it is held to. everything else is someone else's slice, and it can resolve a reference to it but cannot wander into it.

## what a slice contains

a slice is not a summary of the org. it is a projection of the record, filtered by the seat, and it is built from four things:

- **the surface.** what this seat may change, and the current state of those things.
- **the objective.** one measurable claim, with its horizon and kill criteria.
- **the interfaces.** the contracts at the edge of the surface, shared and versioned, in full. this is the one thing that is not narrowed, because a worker who does not know the shape of its boundary builds something the neighbour cannot use.
- **the standard.** what acceptance means, in the certifier's terms rather than the author's.

everything else is deliberate omission. history, other teams' objectives, the org's strategy, the pipeline definition, the runbook for a system it does not own: all omitted, all resolvable by reference if it turns out to be needed, and none of it ambient.

## share interfaces, hide implementations

this is the nuance that makes the whole thing work rather than collapse. compartmentalization that hides the interface produces two halves that do not meet, and the org discovers it at convergence, which is the most expensive possible moment.

so: **interfaces are public and implementations are private.** the contract is in every slice that touches it, byte for byte. the code behind it appears in exactly one slice. this is also why contract-first is a structural requirement rather than a preference: the contract has to exist before the implementation is hidden behind it, or there is nothing shared.

## the apex is the only whole view

someone has to hold the intersections, and the only seat whose slice is not a projection is the apex of a tier. that seat's job is precisely to see across its children so that no child has to.

this is a real constraint on the shape of the org, not a detail. it means the full picture exists in exactly one place per branch, and that place is the one that measures rather than builds. an org where the builders see everything has no reason to have a manager tier at all.

## compartmentalized agents, never a compartmentalized record

the record is whole. the audit from [07-provenance](../07-provenance/readme.md) sees every slice at once and reconstructs the month from it.

if the record were also compartmentalized, the organization could not audit itself, and the compartmentalization would have become a way to hide rather than a way to focus. the difference is that a slice constrains what a seat **reads**, not what the system **keeps**.

## loans and upskilling, in slice terms

the two human interventions on the chart are slice operations, which is why they are cheap to reason about:

- **upskill** widens a seat's slice by adding a surface and a standard, time-boxed, and it does not add the org's context. a seat that is upskilled learns a new thing to be responsible for, not more about everything.
- **loan** moves a seat into a collaborative bloc, and its slice becomes the intersection of the bloc's surfaces and its own objective. it does not receive the bloc's history. it receives the bloc's contract, which is the same thing every member of the bloc has.

a loaned seat that arrives with the host's full context would immediately start proposing redesigns of a system it has known for an hour. the slice is what makes a loan useful within the day rather than in a week.

## what breaks without this

without slices, every agent is a generalist, and a room of generalists converges on the org's own language, which is fluent and unmeasured. without shared interfaces, the halves do not meet. without a whole record, the slices become a way to hide failures instead of a way to focus work. and without an apex that sees across, no one can adjudicate between two slices that disagree.

## what we do not claim

that less context is always better. a hard debugging task on a large surface genuinely needs breadth, and a slice that is too narrow produces confident local fixes that break the whole. the rule is not "narrow", it is "narrow by default, wide on purpose, and when it widens, that is recorded" because a widened slice is a grant and grants are reviewable.
