# toolcalls

what a build can actually reach, what each one is allowed to do, and what it cannot do. this page is
the authority boundary, not a menu: an agent's grants are intersected with this list, and anything
absent is absent for a reason.

| resource | channel | can | cannot |
| --- | --- | --- | --- |
| GitHub | token in sandbox, `git push` over https | read and write source, open the audit trail | change repo settings, merge with review |
| InsForge | CLI + SQL | DDL, DML, queries | anything outside the project's schema |
| Stripe | API key | create products and prices, read charges, read payouts | move money, issue refunds without a human |
| print house | API | quote, place an order against a validated artifact | change prices, cancel after production |
| OpenSCAD | local binary and wasm | render, export STL | guarantee manifold output |
| email | connector | send from the org's own address | message a person who did not opt in |

## the two rules for every call

1. **the guard is in the deployed function, not in the prompt.** a worker granted `email.send` can
   only send to the recipient compiled into that function. if the constraint lives in instructions,
   it is a suggestion.
2. **every call that can be seen by a stranger is logged with its artifact.** a send, an order, a
   charge: each one leaves a reference the auditor can resolve without asking the sender.

## what a build may not add on its own

new OAuth scopes, new recipients, new payment rails, new external accounts. each is a human act and
each is recorded with who granted it. the org can build a great deal inside this boundary; what it
cannot do is widen the boundary to fit an idea.
