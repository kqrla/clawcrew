# 07 · the objective ledger

## why a ledger and not a roadmap

a roadmap says what we intend. it cannot tell you whether the intention still holds. a task board says what moved. it cannot tell you whether movement meant anything.

the ledger is the set point. it is a small, versioned list of objectives, each with a metric that can be computed from a source outside the agent that owns it.

## objective

```yaml
objective:
  id: obj.activation
  parent: obj.revenue
  owner_tier: product.onboarding
  statement: "new accounts reach a first successful sync within 24 hours"
  metric: pct_accounts_first_sync_24h
  source: "sql:analytics.activation_daily"      # executable, versioned
  baseline: 0.31
  target: 0.55
  deadline: 2026-12-15
  rollup: ratio                                  # sum | ratio | min | weighted
  status: active     # active | met | failed | retired | superseded
  retired_reason: null
  version: 3
```

the `source` is not prose and not a dashboard link. it is an executable reference that returns a number, with a stored result and a timestamp. if the source cannot be run, the objective cannot be evaluated, and that is itself a finding.

## five rules

### 1. every task cites an objective

`tasks where objective_id is null` is the drift report. small, bounded, high-signal.

work that genuinely cannot cite one is **exploration**, and exploration is a capped budget whose output is a proposal, never a production change. see [08-control-loop](08-control-loop.md).

### 2. every objective has an executable source

no source, no objective. this single rule kills most roadmap theater, because "improve onboarding" cannot be entered.

### 3. at least one metric per tier is computed outside it

a tier that computes its own success can move the number without moving the objective. the metric must come from a system the tier does not write to: the product database, the billing provider, the crm, a customer survey, a third-party api.

where a tier genuinely owns the only instrument, the number is marked `self_reported: true` and cannot alone satisfy a parent objective.

### 4. a parent never closes on child claims

children completing is necessary, never sufficient. the parent closes on its own metric, from its own source.

this is the rule that catches the month-long failure. eight teams finish eight projects, the parent metric does not move, and the org cannot declare victory.

### 5. retirement is an act, not a lapse

```yaml
status: retired
retired_reason: "paid acquisition no longer viable at current cac; replaced by obj.partner-channel"
superseded_by: obj.partner-channel
```

retiring an objective is a success. quietly continuing one nobody believes in is the drift.

## structure

objectives form a tree separate from the org tree. the two connect at `owner_tier`.

```
obj.revenue
├── obj.activation        → product.onboarding
├── obj.retention         → product.core
├── obj.gross-margin      → finance-ops
└── obj.uptime            → eng.platform.infra
```

a tier may own several. an objective has exactly one owner. shared objectives are a modeling error: split them by the metric each tier actually moves.

## rollup

a parent's value is computed from its own source, not from its children. the children are how the parent is *pursued*, not how it is *measured*.

this is counterintuitive and load-bearing. if the parent metric were derived from children, the org could satisfy it by satisfying itself.

a parent may still declare a **contribution model** for planning:

```yaml
contribution:
  - {objective: obj.activation, weight: 0.4}
  - {objective: obj.retention, weight: 0.5}
  - {objective: obj.gross-margin, weight: 0.1}
```

the model is used to allocate budget and to explain movement. it never overrides the measurement.

## evidence

```yaml
evidence:
  id: ev.9d2
  objective: obj.activation
  kind: query_result | test_run | invoice_reconciliation | survey | external_api
  source: "sql:analytics.activation_daily"
  value: 0.47
  computed_at: 2026-11-07T06:00:00Z
  run_by: auditor              # not the owning tier
  artifact: artifact://evidence/9d2.json
```

evidence is produced by execution and stored. a claim in a message is not evidence, even when it is correct. the difference is provenance.

## drift queries

these run weekly and are the auditor's raw material.

```sql
-- work with no objective
select * from tasks where objective_id is null and state in ('in_progress','done');

-- objectives with no work
select * from objectives
where status = 'active'
  and id not in (select objective_id from tasks where updated_at > now() - interval '14 days');

-- objectives that stopped moving
select o.*, e1.value as v0, e2.value as v1
from objectives o
join evidence e1 on e1.objective = o.id and e1.computed_at = o.baseline_at
join evidence e2 on e2.objective = o.id and e2.computed_at > now() - interval '7 days'
where o.status = 'active'
  and abs(e2.value - e1.value) < 0.02 * o.target
  and o.created_at < now() - interval '30 days';

-- spend that did not buy movement
select objective_id, sum(cost_usd) as spend
from tasks where state = 'done'
group by 1
having sum(cost_usd) > 0;

-- production changes with no objective
select * from actions
where surface is not null and class in ('a1','a2','a3')
  and objective_id is null;
```

## amending

changing a target mid-flight is legal and visible.

- amending requires a diff, a reason and an authorizer.
- the previous version is retained with its evidence.
- an amendment within 14 days of a deadline is flagged for human review, because that is the shape of a target being gamed.

a target moved because the market moved is strategy. a target moved because the team was going to miss it is drift. the system cannot always tell the difference, but it can make the difference visible, which is most of the value.
