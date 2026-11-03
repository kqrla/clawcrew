# signals

a signal is a number that can change a decision. everything else is telemetry, and telemetry is
allowed to be approximate.

## the noise floor

a metric moves every period by some amount that means nothing. the floor is estimated from the
metric's own history: the median absolute change over quiet periods. a move inside the floor is not
progress, and a verdict based on one is a coin flip wearing a chart.

for a business this thin, the floor is usually one unit of the thing being counted. that is why the
targets in meenible's ledger are small integers: a target of 25 paid orders is above a floor of 1,
and a target of 25.4 would be self-deception.

## what is not a signal

- a count of the org's own activity (commits, tickets, tasks). it is not external.
- a metric whose source is `sql:select count(*) from task`. same failure, different table.
- a number with one expression behind it.
- a number that moved because the denominator changed.

## the cadence rule

a signal is read on the cadence of its business, not the cadence of the org's anxiety. a weekly
audit over a monthly metric is right. a nightly audit over revenue is theatre: nothing can change
that fast, and the alert fatigue costs more than the alert.

## dashboard, honestly

there is no dashboard yet, and that is deliberate. a dashboard nobody is required to read is a
place to put uncomfortable numbers. the current surface is the heartbeat's alert count, which is
impossible to ignore because it is in every tick.
