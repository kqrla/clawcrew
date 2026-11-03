# skills

a skill is one capability with a fixed input, a fixed output, and a refusal. task dividing is the
act of replacing a task that needs judgement with a sequence of skills that do not.

## the skill record

```
name:        mesh.validate
tool:        trimesh 4.4.1  (MIT)
command:     python -m harness.stlcheck <file.stl>
output:      { closed, manifold, volume_mm3, bbox_mm }
refuses:     a file over 200 MB, a mesh with more than 2M triangles, an empty file
proves:      exit 0 and a JSON object matching the schema
```

four fields are non-negotiable: the tool and its version, the exact command, the output shape, and
what it refuses. a skill whose refusals are unstated will be handed something absurd and will
succeed at it.

## how a task gets cut

1. **name the evidence first.** the kind of proof the task must produce decides the skills, not the
   other way round. a task wanting `commit:` cannot be done with a design skill.
2. **cut until every step is a skill.** if a step still needs judgement, it is either a smaller task
   or a decision, and a decision needs an objective, not a skill.
3. **attach the ceiling.** each step carries its own cost, so a step that exceeds it is visible
   before the whole task fails.

## spawning a child

a seat may spawn a child when the work is **parallel**, **independent**, and **cheaper to verify than
to do serially**. the child gets:

- a **subset** of the parent's skills. never a superset, never a new capability.
- **one objective**, copied by reference, not restated (a restated objective drifts).
- **a deadline**, because a child with no deadline is a leak.
- **its own evidence obligation**, so a child's output is checkable without asking the parent.

the spawn is refused when the subset is not a subset, when the objective is not in the ledger, or
when the parent is frozen or burned. `src/domain/agents.ts` implements those three refusals.

## sourcing from the shelf

skills are built from [the oss shelf](../toolbox/oss.md), and the shelf's rules apply: recorded
licence, pinned version, a check that proves the skill ran. an agent may wrap a tool it does not
understand; it may not ship a product that depends on behaviour nobody verified.
