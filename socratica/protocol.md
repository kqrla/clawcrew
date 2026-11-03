# socratica

a room where seats with genuinely different interests argue about **what work happens at all, and in
what order**, before any of it starts. pre-build, not pre-merge.

reconciling finished branches is a merge problem and the discourse layer already does it. the decision
that matters more is upstream: ten things are worth doing, four seats disagree about which of them is
first, and whichever gets picked determines what the next month is about. that is the question here,
and it is asked before a task exists.

## the output is a queue, not a memo

a decision that does not change what the scheduler picks up next is a memo, and memos are how a
self-directed org spends a month looking busy.

so deliberation returns a plan with three buckets and a dispatch rule:

| bucket | meaning | what gets it back |
| --- | --- | --- |
| `order` | dispatch order, highest argued score first, dependency-corrected | it happens |
| `deferred` | alive and postponed | a stated falsifier firing |
| `omitted` | not this month | nothing: it needs every voice to have said so |

`dispatchNext(plan, done)` is what the scheduler asks. it returns the first ordered candidate whose
dependencies are done. deferred and omitted tasks are simply not in that queue, which is how "not done
at all" is expressed without anyone holding a veto.

## the four rules that make it a decision instead of a conversation

1. **a postponement needs a falsifier.** "later" with no re-entry condition is a graveyard, and
   `postponement_without_a_falsifier` is a fault, not a note.
2. **omission needs unanimity among everyone who spoke.** one seat saying `never` produces a
   deferral, never an omission. this is the difference between influence and a veto, and it is
   enforced in code rather than promised in this document.
3. **an order must be executable.** a candidate cannot be sequenced before something it waits on, and
   a candidate whose dependency is postponed is postponed with it rather than silently dispatched into
   a wall.
4. **the argument carries provenance.** a stance with no claim is refused, and a claim of kind `fact`
   with no reference is refused, which is the same rule as everywhere else in this repo.

## advisory, and that is not a demotion

`gateAccepts(plan)` returns `false` unconditionally. no plan moves a phase, because phases move on
measurements. but a plan decides what gets measured next, and that is most of the power in a system
whose bottleneck is attention rather than will.

the two are not in conflict. the room cannot declare a metric true, and it also cannot be ignored,
because it is the thing that fills the queue.

## what socratica is not

- not a decision procedure. it does not pick.
- not consensus machinery. a split is a recorded outcome, not a failure.
- not a review. a review has authority, and this deliberately has none.
- not a debate club. every position must cost its holder something if wrong, which is what the
  falsifier field enforces.
