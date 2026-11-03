# invariants

seven rules that do not bend for delivery. each names where it is enforced, because an invariant with
no enforcement is a wish with good typography.

| # | invariant | enforced by | test |
| --- | --- | --- | --- |
| 1 | evidence is a reference, not a sentence | `src/domain/custody.ts`, `src/domain/ontology.ts` | `custody.test.ts`, `ontology.test.ts` |
| 2 | no tier measures itself | `src/domain/measure.ts` (`self_measured`), `src/domain/project.ts` | `measure.test.ts` |
| 3 | one number, two expressions, different hands | `src/domain/measure.ts` (`corroborate`) | `measure.test.ts` |
| 4 | a third answer comes from outside the org | `src/domain/audit.ts` (`external_is_an_internal_expression`) | `audit.test.ts` |
| 5 | a phase moves on rows, never on a say-so | `src/domain/project.ts` (`advance`) | `project.test.ts` |
| 6 | authority is a capability, not a title | `src/domain/agents.ts` (subset grant), `docs/28` | `agents.test.ts` |
| 7 | burning is terminal | `src/domain/agents.ts` (`burn`, `thaw`) | `agents.test.ts` |

## how an invariant gets added

it has to arrive with its refusal. an invariant without a named refusal is a preference: something
everyone agrees with and nothing enforces. the moment it has a rule id, a refusal path, and a test
that fails when the rule is removed, it is an invariant.

## how an invariant gets removed

never in place. it gets superseded by a versioned statement with the reason attached, and the old
one stays readable, because six months later somebody will ask why the org stopped doing the obvious
thing, and "we changed our mind" is only useful with a date.
