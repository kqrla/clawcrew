# concept

this is the why. [../docs](../docs) is the how. the contracts that come before the code live on the `skeleton-base` branch, and they are the third voice in this argument.

read this folder if you want to know what the thing is *for*. read docs if you want to know what it does. if the two disagree, this folder is wrong and docs wins, because docs is the version that has been run.

## the three claims

everything in here reduces to four arguments, and each one is a correction of a common assumption.

**one.** a hierarchy is not a management diagram, it is an authority graph. the chart says what a seat *may* do, computed from the seats above it, and it is stored as rows so it can be diffed and reviewed. when the chart is prose, it is decoration.

**two.** an organization that runs for a month without a human is not a smart agent, it is a system that stays honest while nobody watches. the hard problem is not capability. it is drift, silence, and the fact that a plausible report is cheaper to produce than a true one.

**three.** an organization that maintains instead of delivering is judged continuously, by a metric, at runtime, and never by its own report. the loop is the unit of work, not the ticket.

**four.** work that diverges must be made to converge by evidence, not by agreement. the moment two teams can close a gap by concluding that they agree, the gap is gone and the org is measuring itself.

## what each folder covers

| folder | the question it answers |
| --- | --- |
| [00-dark-factory](00-dark-factory/readme.md) | what an org that iterates, ships and maintains is, versus one that manages deliverables |
| [01-hmas](01-hmas/readme.md) | what is a hierarchical multi-agent system, and when is a hierarchy the wrong answer |
| [02-org-chart](02-org-chart/readme.md) | who may do what, and why that is a table rather than a tree drawing |
| [03-autonomy](03-autonomy/readme.md) | how a run survives a month without a human in it |
| [04-decoupling](04-decoupling/readme.md) | how work splits apart and what forces it back together |
| [05-collaboration](05-collaboration/readme.md) | how two seats actually cooperate, given that they cannot trust each other's prose |
| [06-a2a](06-a2a/readme.md) | what crosses between agents, in what envelope, with what guarantee |
| [07-provenance](07-provenance/readme.md) | how a third party later proves what happened |
| [08-prioritization](08-prioritization/readme.md) | how a system with too many objectives decides what runs next |
| [09-doubling-down](09-doubling-down/readme.md) | how an org avoids sunk cost, doubling down and scope drift, structurally |
| [10-adversarial-qa](10-adversarial-qa/readme.md) | why an org cannot certify its own work, and what replaces the review |
| [11-slices](11-slices/readme.md) | why no seat sees the whole picture, and what each one gets instead |
| [12-identity-and-money](12-identity-and-money/readme.md) | how the org holds its own keys, its own money, and what it refuses to do with them |
| [13-ontology](13-ontology/readme.md) | why a slice carries its own vocabulary, and what "done" means when the work is not code |

the order is not arbitrary. authority has to exist before collaboration means anything, and provenance has to exist before prioritization can be trusted, because priority without a record is just whoever spoke last.

## what this folder is not

not a pitch. there is no section claiming the system is better than a human team, because for most work it is not, and the cases where it is are narrow and specific: work that is parallel, measurable, and boring enough that a person would stop checking.

not a specification. nothing here is precise enough to implement, deliberately. precision belongs in docs, where it can be wrong in a way that a test catches.

not neutral. each folder says what breaks without its idea, because a concept that cannot name its own failure is a slogan.
