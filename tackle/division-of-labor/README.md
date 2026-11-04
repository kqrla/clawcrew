# division of labor

Who does what, decided by surface ownership rather than by job description. The test for a clean
division: for any surface you can name the one party allowed to change it, and for any change you can
name the config diff that authorised it.

## the rule

1. **a surface has an owner.** one department, one writer. Not "primarily" and not "with input from".
2. **ownership is declared in registration**, not inferred from who happened to push.
3. **reaching into someone else's surface is a proposal**, never an edit: the change is written as a
   diff against the owner's registration and reviewed by that owner.
4. **tools follow surfaces.** a tool that claims a surface it was not granted is refused
   (`engine_tool_claims_a_surface`), which is what stops a generic "write anywhere" helper from quietly
   becoming an admin.
5. **a lone seat cannot own a surface it cannot verify.** if nobody can sign the second checkpoint, the
   work is not division, it is delegation with no oversight.

## the two axes, again

Authority (tiers) says how far a decision reaches. Division (departments) says which surface it lands on.
A task is well-formed only when both are named: *the support department, at tier support, owns
`support.inbox` this week.* Ambiguity on either axis produces the same bug: work that is assigned to
everybody gets done by nobody.

## departmental shape

| department | surfaces | what "done" means |
| --- | --- | --- |
| support | `support.inbox` | a reply, verified by a second seat, referencing the ticket |
| code | `code.repo` | a commit that builds, reviewed by someone who did not write it |
| accounting | `accounting.books` | a reconciled entry with a source document reference |
| design | `design.studio` | an artifact at a version, on the design floor's vocabulary |
| documentation | `docs.public` | a page that exists at a URL and says something checkable |

The table is deliberately short. A department that cannot state its surface and its evidence type in one
row is not a department yet; it is an intention.

## blocs and wings, in labour terms

- a **bloc** borrows seats from departments for one objective. Members keep their home grants and gain a
  temporary bloc grant with an expiry. When the objective closes, the grant expires and the seats go
  home. No reorganisation, no permanent headcount move.
- a **wing** holds a capability nobody's metric rewards: security review, on-call, legal. It has a veto
  in its domain and no budget of its own. A wing with a growth target stops being a wing.

## what this look costs

Slow starts. A new surface needs an owner, a registration, and an evidence type before anyone may write
to it, which is most of a day. The alternative is faster and produces the failure this whole repo exists
to prevent: an org where every seat can write anywhere, nobody can say who broke a surface, and the
audit trail is a log of good intentions.
