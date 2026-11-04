# 40 · a green that was earned

`npm run migrate` is the only way schema changes reach the database, and it is written to fail in the
four ways the previous helper succeeded.

## the failure it replaces

a python helper shelled out to the cli from whatever directory the caller happened to be in, printed
`ok` when the output did not look like an error, and exited zero regardless. one run reported five
okays and one failure from a directory that had never been linked to a database, and the commit was
pushed as if the schema had moved. nothing had touched postgres.

## what the runner does instead

1. **probes first.** one `select 1`. if the database does not answer, or answers `no project linked`,
   it exits 2 and says so. a run that cannot prove the database answered is a failed run.
2. **reads its ledger before writing.** `schema_migration` records each filename and its sha256. an
   applied file with the same hash is skipped and called `already applied`, not re-run.
3. **refuses a changed migration.** if a file was applied as one hash and now hashes differently, it
   exits 3 with `migration_changed`. editing history is how two environments quietly diverge.
4. **applies a file in one call.** postgres treats the batch as one transaction, so a file that fails
   halfway leaves nothing behind. per-statement calls cannot promise that: the old helper stopped at
   19 of 26 statements and the nineteen looked like progress.
5. **exit code is the report.** any non-zero exit means nothing after that point was applied.

## baselining, and why it is checked

files written before the ledger existed cannot be "already applied" in its terms, so `--baseline`
records them without executing. that is a claim, so it is verified: every table and view the file says
it creates must actually exist, or the run refuses `baseline_unverified`. recording an unapplied file
as applied is the original lie wearing a ledger.

## what proved it

| run | expected | got |
| --- | --- | --- |
| from the repository root | refuse | exit 2, `not_linked` |
| a migration naming a missing table | refuse | exit 1, `statement_failed`, nothing applied |
| unchanged tree | no writes | exit 0, `14 known, 0 applied`, 48 tables |

the third row is the one that matters for trust: it reports what it did not do.
