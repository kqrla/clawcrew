# 33 · the auditor

**the rule: a number the org computes twice is still a number the org computed.**

[32](32-corroboration.md) made every metric ask twice, in two expressions, by two runners. that closes a whole class of bug: a typo, a wrong column, a filter someone inverted. it does not close the class that matters most, because both expressions are written by the same org, run against the same tables, in the same warehouse. when the table is wrong, both readings are wrong *and they agree*, and agreement is what corroboration rewards.

so the auditor asks a third time, from outside.

## what outside means

the test is not "a different query" and it is not "a different runner". it is **a different system**. the payment provider's settled charges, the printer's own order log, the customer's confirmation email, the seller's payout report. those are answers the org cannot edit, produced by parties with no incentive to agree with it.

three refusals in the code enforce this rather than trusting the label:

- `external_is_an_internal_expression` — the witness ran the primary or the crosscheck expression. same question, new hat.
- `external_observer_is_the_org` — the third reading came from the same runner as one of the first two.
- `same_runner` — the internal pair was one hand twice, so there was never a pair to audit.

## the verdicts

| verdict | meaning | alert |
| --- | --- | --- |
| `agrees` | three answers, inside tolerance | none |
| `disputes` | the org disagrees with itself; the outsider is not needed to know that | `audit_dispute`, high |
| `blind_spot` | the org agrees with itself and the outsider does not | `audit_blind_spot`, high |
| `unverifiable` | primary missing, crosscheck missing, witness missing or failed | `audit_cannot_verify`, medium |

`blind_spot` is the reason this exists. it is the only verdict that could not have been reached from inside: everything internal said the number was fine.

the first real audit found a smaller version of exactly this. the primary gauge reported one commit on `main` in the last week; github, asked separately, said twenty-five. the number was not fabricated, it was read from a stale local tracking ref, and a two-way check would have recorded it in good faith. recorded in [32](32-corroboration.md) as it happened.

## the slow clock

weekly, `604800` seconds, as a normal `schedule` row (`sch.audit.weekly`) so a paused org stops auditing rather than silently continuing to. a disagreement is not an outage: nothing it finds needs to be known within the hour, and something it finds needs to be impossible to forget.

`dueForAudit` refuses to treat an unreadable timestamp as fresh, because "the clock is broken" is the most common way a watchdog stops watching. `audit_overdue` lists every live project whose last run is older than eight days, including projects that have never been audited.

## alerts close on evidence, never on time

`open_audit_alerts` is defined as: the newest finding per objective is not `agrees`. a later round that agrees closes it. a round that finds nothing leaves it open, which is the opposite of how monitoring usually behaves and is deliberate - a disagreement that fell out of the window is not a disagreement that was fixed.

`reconcileAlerts` compares by `code:objective` rather than by objective alone, so a resolved blind spot cannot quietly close an unrelated dispute about the same number.

every tick now carries `auditAlerts` in its report, next to the lag and the deferred count. the number is in the heartbeat, so an unattended month shows a rising count instead of a clean log.

## what this replaced

`project.facts.auditAgrees` was a boolean a seat typed in. that is the self-reporting problem wearing a hat, and it was the weakest line in [30](30-project-lifecycle.md): the project gate that was supposed to catch self-measurement was itself self-measured.

`audit_alerts_clear` reads a count. unknown is not zero: a review with no count available refuses exactly like a review with ten open alerts, and the refusal says which (`{ open: 'unknown' }`).

## the first round, live

eleven objectives, one audit round:

- `agrees`: 1. `main` commits, 25 primary, 25 crosscheck, 24 from a different github endpoint, 4% spread.
- `unverifiable`: 10, all `crosscheck_missing`, because ten of meenible's gauges have never returned a value.

that is the true state of the business, and it is now an alert that stands until it changes rather than a query somebody remembers to run.

## what is still weak

- **the witness for the one working metric is the same provider as the crosscheck.** different endpoint, different expression, same company. the machinery works; the independence of that particular number does not, and the doc says so rather than counting it as a pass.
- **weekly is a single interval for every objective.** a payment rail deserves a daily look; a design catalogue does not. per-objective cadence is a small change to `dueForAudit` and a real one to the schema.
- **nothing schedules the round into a worker yet.** the schedule row exists and `dueForAudit` is tested; the seat that would run it, and the credential each witness needs, do not exist.
- **alerts have no owner.** an open alert is visible in the heartbeat and to any human reading the view. it is not yet assigned to a tier with a lease, so nobody is on the hook for closing it. that is the next thing worth building, and it is the last link between "the org noticed" and "the org did something".
