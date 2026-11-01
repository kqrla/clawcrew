# 02 · the org chart

an org chart is normally a drawing that describes a report line. here it is a **graph that describes permission**, and the drawing is a view of it.

the distinction is not cosmetic. in a reporting chart, writing "the engineer reports to the lead" changes nothing until someone acts on it. in an authority graph, writing a parent edge changes what the child can do the next time it tries, with no human in between.

## authority is computed, never declared

a seat's authority is the intersection of every ceiling from the root down to the seat itself. the algorithm is one line of set mathematics and the consequences are large:

- **narrowing is free.** a new tier inserts a ceiling and every seat beneath it loses whatever the new tier does not hold, with no migration and no audit of existing grants.
- **widening is impossible by construction.** no downstream declaration can exceed its ancestors. privilege escalation is not a policy to be enforced, it is an operation that has no representation.
- **the chain is the explanation.** when a seat lacks a permission, the answer is the first tier in the chain that also lacks it, which is a query rather than an investigation.

authority is also recomputed at use time rather than cached at issue time. a cached grant is a grant that survives the revocation that was supposed to cancel it.

## the one widening path

a system with no widening path is a system that cannot respond, because every new need requires a human to edit an ancestor. so there is exactly one, and it is constrained on three sides:

**elevation** is a temporary grant issued by an ancestor, bounded by that ancestor's own ceiling, carrying an expiry, and visible in the chain. it widens for one seat, for one scope, until a timestamp. it cannot be issued downward by a peer, cannot exceed the issuer, and cannot be renewed by its holder.

the point of having exactly one path is that every case of "how did it get that permission" has one answer shape. if there are two paths, there is a class of question the audit cannot answer.

## matrix, without the mess

real organizations are matrixed: a security specialist embedded in a product team, a designer seconded to a launch. the usual failure is that the matrix is expressed as a fuzzy second reporting line, and then nobody knows whose ceiling applies.

this structure resolves it by separating authority from accountability:

- **authority comes from home.** a seat's home chain computes its ceiling. that does not change when it is borrowed.
- **the host narrows, never widens.** working inside another team applies that team's ceiling as an additional intersection. a borrowed seat cannot grant itself the host's permissions, and cannot bring its home permissions into a place that forbids them.
- **accountability stays home.** the borrowed seat reports to its home tier, and the host reports on the work separately. two claims, not one blended claim, which is what makes it possible to tell whose assumption was wrong.

secondment also has a residency rule that exists purely to stop drift: a seat borrowed beyond a fixed fraction of its home tier's window stops being a visitor. at that point the arrangement is either made permanent or dissolved, because a seat that lives in two horizons has no honest deadline.

## surfaces

permission answers "may this seat act". surface ownership answers "may this seat change *this*".

every surface has one owner. a seat outside the registration proposes a change rather than making one, and the proposal is a row, so a refused change is as visible as an accepted one. this is the single most effective control in the system, because the expensive failures are not unauthorized actions, they are authorized actions in the wrong place.

surfaces are also why the chart can be reviewed by a person. a diff to the tier table and the surface registry reads as a change to who can touch what, in a reviewable form, without reading any agent's reasoning.

## what breaks without this

without computed authority, permissions accumulate: each team grants what it needs and nothing removes what it no longer needs, so after a month the org has the union of every team's worst day. without the single widening path, elevation happens through side channels and the audit sees privileges that appear from nowhere. without surface ownership, the org is fast and untraceable, which is the worst combination.

## what we do not claim

that this is a security model. it constrains what the org's own agents may do to the org's own surfaces, and it assumes the substrate holding the table is not compromised. it also does not model intent. a seat with permission to deploy has permission to deploy badly, and the defence against that is the objective's metric in [08-prioritization](../08-prioritization/readme.md), not the chart.
