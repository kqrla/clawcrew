# 12 · runtime

## shape

```
            ┌──────────── browser (byok) ────────────┐
            │  canvas · approval inbox · transcripts │
            │  keys encrypted in indexeddb           │
            └───────────────┬────────────────────────┘
                            │
                    ┌───────▼────────┐
                    │   core engine  │
                    │  circles·auth  │
                    │  leases·ledger │
                    └───────┬────────┘
        ┌───────────────────┼───────────────────┐
   ┌────▼─────┐      ┌──────▼──────┐     ┌──────▼──────┐
   │ adapters │      │   policy    │     │   runners   │
   │ git·db   │      │    gate     │     │ ci·sandbox  │
   └──────────┘      └─────────────┘     └─────────────┘
```

## browser first, byok

v1 runs in the browser with the user's own keys, encrypted at rest in indexeddb. this keeps the trust story simple: no server holds credentials, and the audit log is local until it is pushed.

the honest caveat, which belongs in the ui and not only in the docs: once keys are placed in ci secrets for unattended runs, the browser-only guarantee ends. the user is choosing a different threat model, and should be told in one sentence.

## night shift

the same core runs headless on a schedule:

- **ci scheduler**: github actions, gitlab ci, bitbucket pipelines. the org commits to a dedicated branch and opens pull requests against the product branch.
- **managed sandbox**: for users without ci.
- **local cron**: for self-hosters.

night shift runs at **lower authority** than the interactive session: read and draft only, with every outbound or money-touching action converted to an approval card. unattended is a privilege the org earns by having a clean audit history, not a default.

## single writer per surface

a surface has one owner and, at any moment, one writer. concurrent writes to the same repo path are serialized with a lock derived from the surface id.

this is not a performance decision. two agents editing the same file is the most common source of silent corruption in multi-agent systems, and it is invisible until much later.

for parallel work across a partitioned surface, the partition key is the lock granularity.

## model routing

each seat names a model and a fallback. routing is per seat, never per prompt, so the same role produces consistent behavior and the cost is attributable to a circle.

- a cheap model for intake, classification and summarizing.
- a strong model for planning, arbitration and code.
- a separate identity (and ideally separate provider) for the auditor.

## cost

every call carries `circle_id` and `objective_id`. there is no un-attributed spend.

the report that matters is not total cost. it is **cost per unit of measured movement**, by objective, which is also the auditor's q3.

## failure handling

- tool call failure: retry with backoff, bounded at 3. then the task goes to `blocked`, never to `done`.
- model refusal: log, do not retry with a rephrase designed to bypass it.
- timeout: the lease heartbeat decides liveness, not the http timeout.
- partial completion: the task remains `in_progress` with an explicit `partial` flag. it cannot be closed by anyone but its owner.

## adapters

the engine talks to nothing directly. adapters implement a small interface:

```
git:      clone, branch, commit, open_pr, read_file
data:     query(sql), read_table, write_row
payments: balance, list_transactions, create_invoice
comms:    send, list_threads
browser:  navigate, read, screenshot
runner:   execute(cmd, timeout) -> {exit, stdout, stderr}
```

an adapter that cannot enforce surface scoping is not an adapter. it is a hole.
