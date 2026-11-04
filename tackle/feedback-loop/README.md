# feedback loops

The loops that make the org self-correcting, ordered by how fast they are. A loop that never fires is a
ritual; a loop that fires constantly is noise. Each one below names its clock and what it can actually
change.

## 1 · the turn (seconds)

propose → act → report. The seat returns claims with evidence, or it returns a coded refusal. Nothing
downstream trusts prose: a claim without evidence is refused at the gateway, not argued with later.

## 2 · the completion check (per task)

answered is not done. Completion is a checkpoint chain per task kind, and the last checkpoint must be
signed by a *different* seat than the one that did the work. The verifier reads what was stored, not what
was reported. This is the loop that catches a seat grading its own homework, which is the most common way
an autonomous org lies to itself.

## 3 · strikes and freezing (per turn, cumulative)

A refusal is recorded as a strike with a code. The code is the point: `tool_not_granted` and
`arg_outside_scope` are different mistakes and teach different lessons. Two strikes freeze the seat, and
a frozen seat is refused before any money is spent. Freezing is not punishment; it is the org noticing a
seat that keeps reaching outside its grant, which is usually a grant that was drawn wrong.

## 4 · the objective ledger (daily)

Every task references a versioned objective whose metric is computed by something outside the org's own
narration: SQL against the operational database, an HTTP endpoint, a git query. Self-reported numbers are
allowed to exist and are never used for the decision.

**the rule that matters:** the primary metric and the witness metric are computed from different places.
When they disagree, the disagreement is the finding. A single metric that everyone trusts is a metric
that will eventually be optimised instead of satisfied.

## 5 · the audit (weekly, slow clock)

A separate seat, on a slow clock, cross-checks the primary data against the witness data and opens an
alert when they diverge. Weekly because daily auditing of daily work just doubles the work at the same
resolution. The auditor's authority is a veto plus a report, not a budget.

## 6 · the review (monthly, human)

The one loop with a person in it, kept deliberately thin: read the alerts, read the objective movement,
decide whether the org is doing the right thing rather than doing things right. Target is under five
interventions a month. That number is the design goal of everything above it, not a promise.

## what makes a loop real

- **it changes something.** a loop whose output is a log line is a diary.
- **it has an owner** who reads it, and an escalation if nobody does.
- **it fails visibly.** if the audit cannot reach the witness, that is an alert, not a silent pass.
- **it is on a clock suited to its subject.** per-turn auditing is theatre; annual auditing is a postmortem.
