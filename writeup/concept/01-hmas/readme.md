# 01 · hierarchical multi-agent systems

a multi-agent system is easy to build and hard to keep honest. three agents with a shared scratchpad will produce work in an afternoon. the same three agents will produce unfalsifiable work by the end of the week, because nothing in the arrangement says who was responsible for what.

an hma is the specific answer to that: **structure is not how you get more work done, it is how you keep track of who owed it.**

## why a hierarchy, out of all the shapes

a flat swarm has one virtue and one defect. the virtue is that it explores widely, because no one is guarding a boundary. the defect is that no node can be held responsible for a region of the problem, so when the work is wrong, the wrongness belongs to nobody. flatness scales exploration and destroys accountability.

a single long-running agent has the opposite defect. it is fully accountable and cannot be parallel, so the month becomes a queue and the queue becomes the plan. it also degrades in a way that is hard to notice: a long context drifts toward whatever it discussed recently.

a hierarchy works because it can be both. a tier is simultaneously the apex of the pyramid beneath it and a subordinate in the pyramid above it. that single fact is what lets a million tokens of parallel work roll up into one accountable number. the count of tiers is unbounded, so depth is a choice rather than an architecture.

> a tier is the apex of its subordinates.

everything downstream follows from that sentence. it is why a parent reports on partitions rather than on tasks, why a child inherits authority instead of negotiating it, and why convergence needs the parent's number and not the children's summaries.

## the three nouns

**tier.** a node in the authority graph. it owns a region of the problem, a ceiling of permissions, and a horizon of time.

**seat.** a role that occupies a tier for a while. seats are leased, not assigned. the same model instance may hold two seats at different times, and one seat may be held by different instances across a month. a seat has a home tier and, temporarily, a host tier.

**surface.** a thing in the world that a seat may change: a repository, a deployment, a dataset, a document, a ledger row. surfaces are the unit of ownership, because "owns the build" is a sentence and "owns the build" without a registered surface is a sentence nobody can check.

the triad matters because the common failure is to conflate them. an agent is not a tier. a tier is not its current occupant. and a surface is not a permission: permission is what a seat has over a surface, and it is recomputed every time it is used.

## what a manager is here

not a boss. a tier's manager role does three mechanical things and nothing else:

1. **adjudicates** conflicts between children, by being the nearest common ancestor of both.
2. **validates** a child's claim of completion against the objective's own metric rather than against the child's confidence.
3. **is the ceiling** for what children may be granted. a child cannot be given a permission the parent does not hold, which makes privilege escalation structurally impossible rather than a policy.

the manager does not know how the work was done, does not review the code, and does not choose the method. an org where managers review the work has a manager per two workers, and the hierarchy has become a tax.

## what breaks without this

without tiers, parallel work has nowhere to roll up, so the only way to know if the month went well is to read the month. without seats, attribution is to a model instance, and instances are replaced. without surfaces, every agent may touch everything, which is not a permission model, it is a hope.

and without the apex sentence, the org drifts into a committee: a set of peers who converge by agreeing with each other, which is exactly the failure [04-decoupling](../04-decoupling/readme.md) exists to prevent.

## what we do not claim

that hierarchy is the natural or best shape for agent organization. it is the shape that makes responsibility legible. a swarm is better at search and a single agent is better at coherence, and an hma pays for its roll-up with coordination cost that a smaller problem does not deserve. below roughly four agents, or for any task where the objective cannot be measured, this structure is more machinery than the work needs.
