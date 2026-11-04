# running clawcrew in a Tenki sandbox

Tenki Cloud is where the runner can live when it is not on your own box: a microVM per session, snapshots,
volumes, and secret substitution so the model key never exists inside the guest. This file is the runbook,
and every command in it was executed against a real session while writing it.

> Correction of record: I first filed the Tenki key under search/crawl alongside Tavily and Firecrawl.
> That was wrong. Tenki provides **sandboxes** (compute), which is the thing a runner actually needs, and
> the key authenticates the CLI.

## install and authenticate

```bash
curl -fsSL https://tenki.cloud/install.sh | bash     # binary lands in ~/.local/bin
export PATH="$HOME/.local/bin:$PATH"
export TENKI_API_KEY=...                             # the CLI reads it from the environment
tenki sandbox list                                   # proves auth without creating anything
```

## create

```bash
tenki sandbox create --name clawcrew-runner --cpu 2 --memory-mb 4096
```

```
name: clawcrew-runner   cpu: 2   memory_mb: 4096   disk_size_gb: 5   state: RUNNING
```

**Secrets go in at create time**, not at exec:

```bash
tenki sandbox create --name clawcrew-runner --cpu 2 --memory-mb 4096 \
  --env "MODEL_API_KEY=$MODEL_API_KEY" \
  --env "MODEL_NAME=gpt-5.4-mini" \
  --env "MODEL_BASE_URL=https://api.openai.com/v1"
```

Better still, use Tenki's Secrets so the value is a placeholder swapped outside the guest, which is exactly
the rule in `tackle/self-directed/handle/credentials/README.md`: the seat holds a capability, never a
secret. A key passed as `--env` also ends up inside every snapshot taken from that session.

## what the base image actually has

| present | absent |
| --- | --- |
| node v24, npm, git, curl | psql |

`sudo apt-get install postgresql-client` fails: the base image has no root. This matters, because the
self-hosted path (`DATABASE_URL` → `psql`) needs a client the base image does not carry. Two ways out, in
order of preference:

1. **build the image** in `backend/Dockerfile` and launch it as a Tenki template, which carries
   `postgresql-client` already;
2. **prepare a sandbox once**, then snapshot it and launch from the snapshot reference.

Until one of those is done, a sandbox runs the CLI driver (https), which is the sandbox-shaped path this
repo grew up on, not the self-hosted one.

## clone and run

```bash
tenki sandbox exec --session clawcrew-runner -c '
  cd $HOME && git clone -q https://github.com/kqrla/clawcrew.git clawcrew &&
  cd clawcrew/backend && npm install --silent'
```

clone into `$HOME`. `/srv` is not writable by the session user and fails with `Permission denied`.

```bash
tenki sandbox exec --session clawcrew-runner -c 'cd $HOME/clawcrew/backend && npx vitest run'
```

```
Test Files  44 passed (44)
     Tests  536 passed (536)
```

then the supervisor:

```bash
tenki sandbox exec --session clawcrew-runner -c '
  cd $HOME/clawcrew/backend && npx tsx scripts/supervise.ts --every 30000'
```

`tenki sandbox exec` takes `-c <shell>` or `-- <argv>`. It has **no `--env` flag**: a `K=V cmd` prefix is
treated as the binary name and fails with `fork/exec ... no such file or directory`.

## keeping state

- **volume** for the repo, so a re-created session does not clone again.
- **snapshot** for a prepared guest: `tenki sandbox snapshot create --session <name> --name <snap>`
  (note the `create` subcommand; `tenki sandbox snapshot --session ...` is not the syntax): dependencies installed, database client present, one command to run.
  A snapshot taken after a key was passed as `--env` contains that key.
- **terminate** when done: `tenki sandbox terminate clawcrew-runner`. A paused sandbox still costs disk.

## the shape this gives the org

One sandbox is one seat's body: an isolation boundary that can read and write inside itself, cannot reach
the host, other sessions, or the control plane, and reaches the network only through normal egress. That is
a better boundary than a container on a shared host, and it is the one the docs in `tackle/` were written
assuming.
