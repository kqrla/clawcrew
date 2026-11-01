# 13 · the per-slice ontology

the rule: **a slice carries its own vocabulary, and every slice carries the same skeleton.**

[11-slices](11-slices/readme.md) says a seat sees a slice and never the whole picture. it does not say what the slice is *made of*, and the current answer is a list of surface strings plus a free-text brief. that answer is only true for one kind of work, the kind where a surface is a file.

a factory that also runs a pipeline, a docs site, a support queue and a dataset has surfaces that are not files. `repo.orchart` and `crm.pipeline` are both surfaces; a commit hash proves something about the first and nothing at all about the second. the layer that knows the difference is the ontology, and it lives per slice.

## three sources, one piece each

**salesforce, on the shape.** ontology sits at the end of a spectrum: a pick list (controlled values), a taxonomy (values with hierarchy), a thesaurus (hierarchy plus associated terms), and finally a graph of classes, individuals, relations and axioms. the property that matters is not richness, it is that *a taxonomy has to be reorganized to grow and a graph does not*. a graph absorbs a new concept by adding a node; a tree absorbs it by choosing a branch for it, which means choosing wrong and then moving everything under it. a month-long org adds concepts constantly. trees do not survive that.

**memorium, on the living part.** its tag system is the AO3 model: canonical terms, aliases, a parent for branches and subbranches, explicit exclusions between terms, weighted associations, and a per-perspective relevance for the same term. two rules transfer directly.

the first: **an alias is provenance, and the canonical term is a resolution, not a replacement.** "dev", "coding", "sw eng" all resolve to `programming`, and the original phrasing is kept. the raw term is evidence about who wrote it and how the org actually talks, and a system that normalises it away has deleted the most honest data it had.

the second: **the same term is not equally relevant to every seat.** memorium weights tags per persona. here it is per seat, and it solves a problem a single global vocabulary creates: `stage` means deal state to sales and deployment environment to ops. one canonical id, two slices, two weights, no ambiguity at the point of use.

**kiro, on the brief.** kiro's spec is three artifacts, requirements with acceptance criteria, a design, and discrete tasks, plus a bugfix variant that states current, expected and unchanged behaviour. that shape is not about code and it survives translation: a deal needs qualification criteria, a sequence of touches and steps; a document needs claims, an outline and sections; a dataset migration needs a schema intent, a join plan and backfill batches. what must *not* transfer is the assumption underneath it, that the artifact is a file under version control and the evidence is a test run. take the shape, drop the substrate.

## the skeleton, and the vocabulary

the shared half is small and it is the only thing that makes cross-slice reasoning possible at all: a **class** (what kinds of thing exist here), an **individual** (an instance of one), a **relation** (how two individuals connect, with direction), an **axiom** (a statement that constrains the graph, like "a deal has exactly one owner"), an **action** (a verb a seat may apply to a class), a **term** (the canonical name, its aliases, its parent, its exclusions), and an **evidence type** (what a completion reference must resolve to).

the per-slice half is everything that makes those concrete, and it is where the org's claim about itself actually lives.

| task kind | done is proved by | a gate that cannot be talked around |
| --- | --- | --- |
| code | a commit and a run of the test command | the run's exit code and the tree it ran on |
| doc | a published url and a content hash | the url resolves and the hash matches the source |
| data | a query result and a row count delta | the number moved, computed outside the seat |
| deal | a crm record id and a stage transition | the record exists at that stage after the run |
| design | an asset hash and an approval | the hash is pinned and someone with standing affirmed it |
| research | citations and the claims they support | every claim maps to a source that exists |
| support | a ticket id and its resolution state | the ticket closed by someone other than the author |
| ops | a check and the window it covers | the check ran across the whole window |

the right-hand column is the point. one shape, and four of these cannot be faked by a seat talking about itself, which is the same standard [07-provenance](../07-provenance/readme.md) sets for the audit trail.

## living means versioned, and versioned means diffable

an ontology is a document with a version, an author and a hash, and the hash is what a config diff review reads. adding a term, deprecating one, narrowing an axiom: each is a new version, never an edit in place, so the diff between two versions *is* the change request and a human can read it without a model's help.

an agent that meets a term it does not recognise does not fail and does not invent. it files a **proposal**: the raw term, the slice, the seat, the nearest canonical candidates, and what it was trying to do. proposals are the org's only mechanism for growing its own vocabulary, and they arrive with provenance attached, which is exactly what a canonical term added by hand never has.

deprecation is the same move in reverse: a term is retired with a replacement pointer, never deleted, because a month of history that references a deleted term is a month of history nobody can read.

## what breaks without this

**evidence collapses to code.** a deal gets closed with a commit hash because the only evidence scheme in the system knows about commits. nobody notices, because the field is populated and the gate is green.

**verbs go generic.** without per-slice actions, everything becomes `improve`, `handle`, `work on`. a verb that does not name its object cannot be refused, and an unrefusable task is one that completes itself.

**acceptance becomes opinion.** the per-kind table is the only place where "done" has a definition that a third party could check. without it, done means a model said so, which is the failure that [10-adversarial-qa](10-adversarial-qa/readme.md) exists to prevent.

**growth stalls.** a fixed schema means every new surface is a migration, and every migration is a human. the org's five contacts a month get spent on schema changes instead of on the decisions that actually need a person.
