# slices and the context a seat is given

The design rule: **no seat ever receives the whole picture.** Not for secrecy. Because a seat handed
everything performs worse on everything: the spec gets summarised, the summary gets summarised, and the
evidence that mattered is gone two hops down. Compartmentalisation is a quality mechanism first and a
safety mechanism second.

## what a slice is

A slice is a coherent surface plus the vocabulary to talk about it: `support.inbox`, `accounting.books`,
`code.repo`. It carries an ontology with a version, terms, and an acceptance rule per task kind. The
ontology is what lets a task be *checked* rather than believed: `support` accepts a `ticket:$id`,
`code.repo` accepts a commit hash, a deal accepts a `deal:$id`.

A seat's grant names tools, the surfaces those tools may touch, and a daily spend ceiling. Capability,
not role. "You are the support seat" confers nothing; `inbox.reply` scoped to `inbox` confers the reply.

## the snapshot

What travels with a task:

```
slice + version      so the receiver knows which vocabulary is being spoken
kind                 what completion means for this kind of task
objective ref        the external metric this task is supposed to move, if any
budget               money, turns, wall clock
acceptance           the evidence types that will be checked
evidence so far      references, not narrations
everything else      withheld, deliberately
```

The withheld part is the point. A seat does not get the org chart, the other departments' plans, the
customer's full history, or last week's argument. It gets the smallest set of facts that makes a correct
turn possible, plus a way to ask for more through a recorded request rather than a guess. When a seat
needs something outside its slice it files a request; the answer becomes a reference in the task, so the
next seat inherits the fact without inheriting the conversation that produced it.

## why this makes parallel work possible

Two seats can work at once only if they cannot see each other's in-flight state, because in-flight state
is exactly what makes two workers contradict each other. Slices give that isolation cheaply:

- **decoupled start.** each seat works from a snapshot plus its own slice's rules.
- **no shared mutable context.** the only shared things are the surface and the evidence store.
- **conflict is detected at the surface, not in conversation.** two seats editing one surface are
  serialised by a surface lock; two seats in different slices never meet.

The cost is drift, and it is not optional: decoupled work diverges. Which is why nothing counts as done
until it converges (below).

## eventual convergence, not eventual consistency

Divergence is expected and temporary. What converges is not the databases, it is the *claims*.

1. each turn produces claims with evidence and a confidence, in the discourse envelope.
2. the merge is a diff-walk, not a rewrite: new claims are added, contradicted claims are marked, and a
   contradiction is never silently resolved in favour of whoever wrote last.
3. a claim that cannot be reconciled escalates as a disagreement with both sides attached, to the tier
   above, on a slow clock.
4. completion requires a second signature from a different seat on what was actually stored, so "it
   agrees with itself" is never enough.

So parallel work is safe to start and expensive to finish, on purpose. The expense is a review that reads
two artifacts and their evidence; the alternative was a review that reads one summary and hopes.
