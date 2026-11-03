# feedback-loop

the part that makes the month different from day one. a loop is not a dashboard: it is a mechanism
where a number changing causes something to happen without anybody deciding to look.

## the loop, in five steps

1. **produce** work against an objective (`src/domain/custody.ts`).
2. **measure** by running the objective's own expression (`src/domain/measure.ts`).
3. **corroborate** with a second expression, from different hands (`corroborate`).
4. **audit** from outside the org, weekly, on findings that stay open (`src/domain/audit.ts`).
5. **act**: the phase gate responds, or the alert stands until something closes it.

steps 2 through 5 are the difference between a project that reports and an org that notices.

## the four properties a signal must have

| property | test | what it excludes |
| --- | --- | --- |
| external | the expression reads a system the org does not write to | counts of our own activity |
| executable | the source is a real expression, and it has returned a number | a metric that names a team |
| corroborated | two expressions, two runners, within tolerance | one formula copied into two places |
| audited | a third reading from outside agrees | a shared blind spot |

a number missing any of these is a reading, not a signal, and the gates treat it that way.

## pages

- [signals](signals.md): what counts, what is noise, and the noise floor.
- [corrections](corrections.md): how a wrong number is corrected without rewriting what was believed.
