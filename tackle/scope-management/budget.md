# budget

drift is cheap to prevent and expensive to stop. the ceilings exist so that a mediocre business
costs a week rather than a month.

## the three ceilings

| ceiling | unit | enforced |
| --- | --- | --- |
| per unit cost | currency, per shipped item | `unit_cost_under_ceiling`, from a live quote |
| per project spend | currency and tokens, per window | reservations before work (`docs/27`) |
| per tier attention | ops per tick | `workDeferred`, and the starvation alarm |

## why reservations rather than accounting

an org that measures spend after the fact is an org that finds out at the end of the month. a
reservation is taken *before* the work, so the answer to "can I afford this" is available at the
moment somebody asks, and a refusal is information rather than a surprise.

## the shape of a healthy month

most work inside the ceiling, occasional deferrals, no starvation alarms, and at least one raise
requested by a human rather than by the org. if the org never approaches its ceiling, the ceiling is
decoration; if it lives against it, the plan was wrong and the plan is the thing to change.
