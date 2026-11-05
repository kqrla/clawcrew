# 46 · the compose stack, actually run

`ops/compose.yml` had never executed. Docker is available inside a Tenki sandbox, so it ran there, on
postgres 16, from an empty volume. Six things were wrong and one of them was the kind this repo exists to
catch.

## what the stack does now

```
===PS===         db Up (healthy)   migrate Exited(0)   runner Up   health Up
===MIGRATE===    verified: 20 migrations known, 51 public tables present
===RUNNER===     seat.support: active strikes=0 | objective: 1.0000 | spend today: 1
===HEALTH===     state=running age=28s cycles=192 stale=false
```

a ticket is answered and signed inside the containers, the spend ledger records it in cents, the heartbeat
advances every cycle, and the watcher reads it from a different service.

## the six fixes

1. **docker needs a bigger disk.** the default 5 GiB cannot hold `node:20-slim` plus `postgres:16` plus
   layers, and the failure is not "no space" on the image pull: it is postgres exiting(1) with the compose
   dependency error on top. `--disk-size-gb 20`.
2. **a background process does not survive an exec session.** `docker compose up -d` in one call and
   `docker compose ps` in the next finds no daemon. the daemon and the command have to live in the same
   `tenki sandbox exec`.
3. **`POSTGRES_PASSWORD=x sudo docker compose` does not reach compose.** sudo drops the environment, and
   compose reports the variable as unset, which reads like a compose bug. an `ops/.env` file is the answer.
4. **the image could not run its own entrypoint.** `npm install --omit=dev` omitted `tsx`, which the CMD
   runs, so the container started and immediately failed. `tsx` is a runtime dependency here, because the
   runtime *is* TypeScript under tsx.
5. **no postgres client is needed at all.** the Dockerfile no longer installs one: the driver is node-pg.
6. **half a model configuration is a refusal, and the compose file was asking for one.** defaulting
   `MODEL_NAME` while `MODEL_API_KEY` is empty made the port refuse on purpose. compose now passes empty
   strings, and empty means the scripted responder.

## the one that mattered

the runner container came up `Up` and did nothing. the heartbeat was frozen, the logs were empty, and
`restart: unless-stopped` was happy, because nothing had exited. the cause: the supervisor passed
`--every 30000` to its child, and a child with `--every` is *itself* a loop that never exits, so the
supervisor never saw a cycle finish, never restarted, never logged, and beat once at startup.

that is the exact failure the supervision work exists to prevent, sitting inside the supervisor. the health
watcher caught it, because a stale heartbeat is the only thing that can see a container that is "Up".

the fix, `planChild`: the supervisor owns the cadence. `--every` is consumed by the supervisor, the child
gets `--cycles 1`, a clean pass beats `cycle done, next in 30000ms` and sleeps. tested, then watched:
`cycles=189` to `cycles=192` with `age` resetting each time.

## still not true

`docker compose up` is proven by hand in a VM, not in CI, and not on your host. the `ops/compose.yml`
pins postgres 16 and that is the version exercised. migrations are idempotent on a re-run but a
half-applied failure (mid-file) is still a manual repair, because the statement ledger records per
statement and the runner stops at the first refusal by design.
