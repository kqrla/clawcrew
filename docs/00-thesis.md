# 00 · thesis

## the claim

coordination between agents is not a conversation problem. it is an authority problem.

most multi-agent systems are built the other way around. agents are given a shared context, a role sentence and a set of tools, and then expected to behave like colleagues. this works in demos because a demo has one goal, no money and a human watching. it fails in an organization because an organization has many goals, real money and nobody watching.

three consequences follow.

### 1. a role described in prose is not a permission

if an agent can call a tool, the agent will call the tool. the only meaningful org chart is the one that compiles to credentials: which keys exist, which surfaces they reach, which spend ceilings they carry and when they expire. everything else is a wish.

this is not a security argument first. it is a coordination argument. an org chart exists to make some actions possible and others impossible without a decision. if nothing is impossible, there is no chart.

### 2. over long runs, the failure mode is plausible success

short runs fail loudly. a context window overflows, a test crashes, a tool 500s. long runs fail quietly: work is claimed done, tasks close, dashboards stay green, and the artifact drifts from the objective one defensible local decision at a time.

no amount of better prompting fixes this, because the incoming work is locally coherent at every step. what fixes it is a set point and an independent measurement. this is why orchart specifies an objective ledger and an auditor that executes nothing. the auditor is the only role whose job is to be annoying.

### 3. the unit that needs protecting is the objective, not the task

a task board tells you whether work moved. it cannot tell you whether the work was worth doing. over weeks, objectives decay: the market shifts, the metric stops meaning the goal, the goal stops being worth the spend. a task board will keep the machine busy through all of it.

so objectives are first-class objects with metrics and executable sources, tasks must cite them, and retirement is an explicit act with a date and a reason.

## what this implies for the org model

authority is a tree. accountability is a graph. conflating the two is what makes agent org charts either unsafe (everyone can do everything) or paralyzed (everything needs a manager who is also an agent).

keep them separate and the rest follows: one home circle per seat for authority, per-deliverable ownership in the host circle for accountability, and a secondment record that joins them.

## what success looks like

a business where, for a month:

- every production change traces to an objective that a human would still endorse
- every external action traces to a seat, a grant and an approval
- every dead agent produced an alarm within one lease interval
- the weekly audit found at least one discrepancy, and the discrepancy got fixed

the last one matters. an audit that never finds anything is not evidence of health. it is evidence that the auditor is not looking.
