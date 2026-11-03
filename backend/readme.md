# orchart backend

the engine that enforces the spec in [`../docs`](../docs). letters before lines: this is v0.1 of the backend, and it implements the parts that are load-bearing and testable, not the whole chart.

437 tests, zero failing. typecheck clean under `strict` + `noUncheckedIndexedAccess`.

## stack

| layer | choice | why |
| --- | --- | --- |
| language | typescript, node 20+ | one language for the engine, the api and the browser-first canvas. splitting the core across python and ts means writing the authority model twice, and the second copy is the one that drifts. |
| store | postgres 16 | recursive ctes for the ancestor chain, `select for update` for lease claiming, partial unique indexes for "one live holder", and advisory locks for the surface writer lock. sqlite cannot do the coordination half without hand-rolled locking. |
| http | hono | tiny, runs on node, bun, workers and deno. the api is not the product; it should be replaceable. |
| sql | hand-written, no orm | the schema is an artifact a security reviewer has to read. `migrations/0001_init.sql` is the review. |
| validation | zod | one schema per boundary, shared by the api and the plugin config. |
| tests | vitest | the domain modules are pure functions, so the suite runs in under a second and needs no database. |

no redis, no temporal, no queue. the ticker is a cron that does one pass and exits, because a long-lived worker that dies leaves a responsibility looking staffed.

## the one place the spec had to be inverted

`docs/11-memory.md` says git is the source of truth and memory is a derived index. that is right for decisions and transcripts. it is wrong for `leases`, `handoffs` and surface locks, which need atomic multi-row transitions a filesystem cannot join to a transaction.

so the record lives in postgres (hash-chained, append-only by trigger) and is **exported** as content-addressed jsonl segments with a weekly manifest. git is a destination, not a mechanism. see `../docs/16-durability-and-projections.md`.

artifacts are content-addressed blobs behind `src/ports/artifacts.ts`, because evidence must reference a hash and not a url: urls rot and pages change under you.

plane and karakeep are **projections**: write-only out, proposal-only in. a card dragged to done in plane becomes a `completion_request`, and `guardCompletion()` answers it with the ledger. a karakeep summary is tagged `runBy: karakeep` and can never close an objective.

## layout

```
src/domain/      pure functions. no io. this is the spec, executable.
  authority.ts     chain intersection, elevation, host context
  policy.ts        deterministic risk -> a0..a4, override rows
  leases.ts        expiry, heartbeat, escalation ladder
  handoff.ts       state machine, precondition, undelivered
  objectives.ts    ledger rules, closure, drift queries
  events.ts        canonical json, hash chain, jsonl
  relay.ts         crossings, envelopes, directional permeability, hop bounds
  convergence.ts   partition maps, barrier, join rules, integration gate
src/ports/       artifacts, projections (plane, karakeep), a2a boundary
src/jobs/        weekly projection reconciliation (drift, repair by re-push)
src/plugins/     the extension surface (see below)
src/store/       postgres. the only place that talks to a db
src/server/      hono app + a demo org for clicking around
src/cli/tick.ts  one pass: expire leases, bounce handoffs, write events
migrations/      schema, including the immutability trigger
test/            437 tests, no database required
```

## run it

```bash
cp .env.example .env
docker compose up -d
npm install
npm run migrate          # or: psql $DATABASE_URL -f migrations/0001_init.sql
npm test                 # 114 passing, no db needed
npm run dev              # http://localhost:8787
npm run tick             # one scheduler pass
```

```bash
curl localhost:8787/seats/seat.content/authority
curl -X POST localhost:8787/policy/evaluate \
  -H 'content-type: application/json' \
  -d '{"verb":"payout.send","actorTier":"fin","economic":{"direction":"out","amountUsd":5}}'
```

## the plugin surface

this is the part that matters for self-direction. nothing in `src/domain` imports a concrete adapter. everything that could change as the org gets more autonomous is a plugin with a declared abi, enabled by a committed config file.

| kind | what it lets you replace | without touching |
| --- | --- | --- |
| `objective_source` | how a metric is computed (`sql:`, `http:`, `git:`, `run:`) | the ledger |
| `auditor` | what the weekly audit asks and how it scores | the state machine |
| `trigger` | what wakes a tier (cron, webhook, event, human) | leases |
| `tool_adapter` | what tools exist, scoped by grant | the policy gate |
| `memory_store` | where derived memory lives | the record |
| `model_router` | which model serves which seat and stage | everything |

two rules make this safe rather than decorative:

1. **the abi is versioned and checked at registration.** a plugin built for another abi is refused at boot, not discovered at 3am.
2. **config is the authority.** a plugin present in code but absent from `orchart.config.json` is inert. enabling more autonomy is a reviewable diff in a committed file, not a runtime flag.

```ts
const registry = PluginRegistry.fromConfig(
  { version: 1, plugins: [{ kind: 'auditor', id: 'weekly-standard' }], policy: { spendApprovalThresholdUsd: 50 } },
  [sqlSource(), weeklyAuditor()],
);
```

## what is implemented

- authority intersection with a per-tool trace of which level dropped it
- host-context authority for secondments, including the zero-spend default
- elevation with expiry, ancestor check, issuer-ceiling check and window
- deterministic risk classification and the model-override row
- lease expiry, heartbeat staleness, the five-step escalation ladder
- handoff state machine, precondition check, `undelivered` as a real state
- objective validation, closure on own metric only, untraceable/unsupported/stalled
- hash-chained event log with tamper and gap detection, jsonl export
- weekly auditor: q1 claim vs measurement, q2 untraceable, q3 spend without movement
- postgres schema with one-live-holder index, append-only trigger, recursive chain view
- hono api: authority, policy, objectives, plugins, health
- content-addressed artifact store (filesystem; swap for minio behind three methods)
- plane projection with idempotent upsert, and a webhook guard that refuses completion without evidence
- karakeep indexer for sources, deliberately unable to close anything
- crossings and relay between sandboxed tiers, with rate, direction and expiry
- convergence barrier for parallel teams: exhaustive partitions, join semantics, conflict detection
- integration gate that refuses closure on a satisfied barrier alone
- projection reconciliation: drift findings, repair by re-push, never a local state change
- a2a boundary: narrowed agent cards, envelope-to-message round-trip, sender identity from transport only
- a2a task mapping onto handoffs, with completion treated as a claim

## what is not

- no channels, decisions or votes yet
- no secondment api (the domain function exists, the routes do not)
- no memory adapters, no model router implementation
- no minio adapter yet, and no weekly hash anchor job, which is the most skippable and most load-bearing step
- no auth. the api is a local surface; do not expose it
- no surface-lock integration in the tool layer yet
- the auditor is not yet a separate identity with separate credentials, which the spec says is the load-bearing part

## next three, in order

1. surface registry + registration endpoint, because every other write depends on ownership existing
2. secondment request/authorize flow, because it is the least-proven design in the spec
3. the auditor running as a separate process with a read-only role, because an auditor with the workers' credentials is a rubber stamp

## artifacts on insforge storage

evidence blobs live in the `artifacts` bucket, content addressed: the object key is
`sha256/<first two hex>/<full hash>`. the hash is the identity, so a retry overwrites
identical bytes instead of appending a version, and a read that does not hash back to
its key is treated as corruption rather than a new document.

two wire facts, discovered by probing rather than reading:

1. upload is `PUT /api/storage/buckets/<bucket>/objects/<key>` with **multipart form-data**
   and a field named `file`. a raw body is rejected as `STORAGE_INVALID_PARAMETER`.
2. download answers **302 to a signed url**, so the client must follow redirects or it
   silently reads the redirect body and fails the hash check.

verify with `node --import tsx src/cli/verify-artifacts.ts`, which round-trips real bytes
against the real bucket.

## hosting: insforge, and only insforge

the build runs entirely on insforge: its postgres for the record, its storage for
artifacts, its auth for identity. no step in the build asks for a supabase
credential, and nothing here reads one.

supabase exists later as a drop-in, not as a dependency. `supaforge.config.example.json`
is the shape that takes when the day comes: the bridge mirrors insforge to supabase
so cutover is a config flip instead of a migration project. it is an escape hatch.

two integration facts, verified the hard way:

1. **migration filenames** must be `<14-digit-version>_<name>.sql` and the name may
   not contain underscores. `0001_init.sql` is rejected; `20261031000000_init.sql`
   is accepted, and `20261031000001_scheduler-relay.sql` needs the hyphen.
2. **the sql endpoint is not the one the bridge expects.** insforge cloud answers raw
   sql on `/api/database/advance/rawsql`, not `/api/database/query`. the example config
   sets `insforge.sqlPath` accordingly.

the bridge's own constraint, for when the drop-in is wired: it exits with
`missing config: supabase.url` rather than running insforge-only. correct for its
purpose, and the reason it never runs during the build.
