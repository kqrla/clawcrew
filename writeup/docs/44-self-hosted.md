# 44 · self-hosted, or it is a rental

The rule: **nothing in the path of the org may be a service you cannot run yourself.** A clock that lives
in somebody else's platform is a clock that stops when the plan changes, and this org is meant to run for a
month without being watched.

## what was platform-shaped, and what it cost to remove it

Until now the only way to reach the database was `@insforge/cli` over https, because the sandbox blocks
port 5432. That is fine for a demo and disqualifying for the thing itself: the store shelled out to one
vendor's CLI on every statement, so hosting it meant renting it.

The store now picks a driver in one place (`src/store/sql-cli.ts`):

| condition | driver | why |
| --- | --- | --- |
| `DATABASE_URL` is set | `psql` | a postgres url is the only thing a self-hosted deployment needs |
| no url | the cli | so the same code still runs in a sandbox that cannot open 5432 |

Both are synchronous and both frame results with markers, because the domain is synchronous and because a
driver that changes the shape of the data changes every caller. `setRunner()` exists so a test never shells
out to a real database.

The honest limit: **the psql path is untested here**, because this sandbox has no postgres client and no
route to 5432. It is the same statements, the same markers, and `-v ON_ERROR_STOP=1` so a failure cannot be
misread as an empty result, but it has not executed. First thing to run on a real box:

```
docker compose -f ops/compose.yml run --rm migrate
```

## the packaging, three ways

- `ops/compose.yml` — postgres 16, a one-shot migration, the supervised runner, and a separate health
  watcher. `restart: unless-stopped` on both long-running services. This is the recommended path.
- `ops/clawcrew-support.service` + `clawcrew-health.timer` — for a box that already runs postgres. The
  supervisor is `Restart=always`; the timer runs the heartbeat check every five minutes.
- `ops/crontab.example` — the smallest thing that can work, for a machine with cron and nothing else.

## why the watcher is a separate process

A supervisor cannot report its own death. Every "self-healing" system that supervises itself has the same
hole: when it dies, nothing fires. So `health.ts` is a different process on a different clock, reading a
row the runner writes. The row is the contract:

```
state=stopped age=2s cycles=23 stale=false
```

## what a person still has to do

Set `POSTGRES_PASSWORD`, `MODEL_API_KEY`, and take a backup. Everything else is `compose up`. Backups are
the one thing that cannot be automated away: a postgres volume is a single point of loss, and an org that
runs a month unattended will one day need Tuesday back.

## where it runs, if not your box

Tenki Cloud: a microVM per session, snapshots, volumes, and secret substitution so the model key is never
inside the guest. The runbook with verified commands is `ops/tenki-sandbox.md`.

Verified in a real session (Ubuntu 24.04, node v24): clone, `npm install`, and the whole suite green in
5.6 seconds. Also verified, and more useful: the base image has **no psql and no root**, so the
`DATABASE_URL` path needs an image that carries `postgresql-client` (the `backend/Dockerfile` builds one)
or a snapshot of a prepared guest. Until then a sandbox runs the CLI driver over https, which is the
sandbox-shaped path rather than the self-hosted one.

I filed the Tenki key under search/crawl before this. That was wrong: it is compute. The correction is
worth recording because the mistake was classification, not execution: I had a working key and a working
CLI and spent a day proving the org could not be hosted anywhere while the hosting was one `curl | bash`
away.
