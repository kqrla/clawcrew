# agent lifecycle

four verbs. each one exists because the alternative is an org that cannot be reasoned about after a
month.

| verb | means | refuses |
| --- | --- | --- |
| **duplicate** | create a child seat from a parent, with a subset of its skills | a frozen or burned parent; a skill outside the parent's grant; a lineage deeper than the cap |
| **freeze** | stop working, preserve state, keep history | freezing a burned seat; freezing twice |
| **thaw** | resume from a freeze with the same grant | thawing a burned seat; thawing after the frozen deadline, which is a re-spawn |
| **burn** | terminal. the seat is gone and the reason is recorded | burning without a reason; any verb afterwards |

## why these four and not "stop/start"

`stop` conflates three different situations that need different audits: paused (will resume), done
(work finished), and dead (do not reuse). collapsing them is how an org ends up with seats that
"might still be running", which is the same as having no idea what is running.

## duplication, precisely

a duplicate is not a copy. it shares the parent's **lineage** (the root id and the reason it exists)
and differs in grant: strictly narrower. the lineage is what lets a burn propagate correctly: burning
a parent does not burn children that were already duplicated and are doing unrelated work, but it
does mark them orphaned, and an orphaned seat may not spawn.

## freezing, precisely

a freeze preserves: the grant, the open tasks, the evidence produced so far, and the lease history.
it releases: the on-call lease, because a frozen seat holding a responsibility is an outage waiting.

## thawing, precisely

a thaw after the window is refused rather than silently allowed. state that old is not state, it is
archaeology: the tools moved, the objective may have been superseded, the lease is gone. the correct
move is a re-spawn against the current ledger, and the refusal says so.

## burning, precisely

burning is the only verb that cannot be undone, and it is the one an angry org reaches for first, so
it carries the strictest conditions: a reason, and a terminal state that `thaw` and `duplicate` both
refuse. capabilities may be re-granted to a fresh seat; the burned seat's record stays, because "we
tried that and it failed" is the most valuable thing in the history.

## implementation

`src/domain/agents.ts`, with the refusals as return values rather than exceptions, because a refusal
is a normal outcome the tick has to handle. tests in `test/agents.test.ts`.
