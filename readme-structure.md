# folder map

the repo is two things at once: an implementation, and the beliefs that constrain it. the split is
deliberate, and each folder answers exactly one kind of question.

| folder | answers | is not |
| --- | --- | --- |
| [`directive/`](directive/readme.md) | what this is for, and what it refuses | a spec |
| [`toolbox/`](toolbox/readme.md) | what a build may stand on: stack, tool calls, oss, vendoring | a wishlist |
| [`scope-management/`](scope-management/readme.md) | how it stays the same project for a month | a backlog |
| [`feedback-loop/`](feedback-loop/readme.md) | how a number changing causes something to happen | a dashboard |
| [`hierarchy/`](hierarchy/readme.md) | tiers, seats, authority, escalation | an org chart |
| [`division-of-labor/`](division-of-labor/readme.md) | how work is cut, and the four agent verbs | a process diagram |
| [`docs/`](docs) | how each mechanism works, numbered, one idea each | marketing |
| [`test-projects/`](test-projects) | the businesses the factory builds | demos |
| `backend/` | the implementation the above constrains | the design |

## the rule that keeps them from rotting

a page here that cannot name its evidence is a page that gets deleted. the directive cites code, the
toolbox cites artifacts, the scope pages cite gates, and the lifecycle pages cite tests. prose that
cites nothing is a preference, and preferences belong in a chat, not in a repository an autonomous
org reads at 3am.
