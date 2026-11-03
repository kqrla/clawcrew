# toolbox

what a build is allowed to stand on. three questions, in this order, and the answer to the third
decides whether anything else matters:

1. **can it be verified here?** a tool whose output nobody in this org can check is a liability
   wearing a logo. it does not matter how good it is.
2. **does it fail loudly?** a silent success is worse than an error, because the org will build on it.
3. **what does it cost per unit of work?** per-call pricing turns engagement into burn. a tool that
   charges per generation is only tolerable if a human decides the cadence.

## sections

- [stack](stack.md): the pinned runtime, database, and the reasons the boring options won.
- [toolcalls](toolcalls.md): the resources actually reachable during a build, each with its authority
  boundary and what it cannot do.
- [oss](oss.md): open-source tools an agent may source skills from, with licence and determinism
  notes. this is the shelf, not a wishlist.
- [vendoring](vendoring.md): how a tool becomes part of a build: pin, hash, licence record, no
  surprises at runtime.

## the rule that keeps this folder honest

a tool is listed here only after it has produced something in this repo. no "we could use". the
entries that follow each carry the artifact that proves it ran. a shelf full of untried tools is a
shelf of assumptions, and assumptions are what the whole project is built to avoid.
