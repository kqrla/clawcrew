/**
 * docs/43. the supervisor. it does not do work; it makes sure work is being attempted and
 * says so in a row a stranger can read.
 *
 *   npx tsx scripts/supervise.ts --cycles 2
 *   npx tsx scripts/supervise.ts                 # forever, restarting as policy allows
 *
 * every state change writes a heartbeat, so "is the org working?" is a query rather than a
 * question about whether a terminal is still open.
 */
import { spawnSync } from 'node:child_process';
import { Attempt, backoffMs, decide } from '../src/jobs/supervise.js';
import { cell, sql } from '../src/store/sql-cli.js';

const RUNNER = 'support-loop';
const MIN_UPTIME_MS = 5_000;
const MAX_RESTARTS = 5;
const MAX_CRASHES = 2;
const MAX_FAILURES = 3;

function beat(state: string, detail: string): void {
  sql(
    `insert into runner_heartbeat (id, at, state, detail) values ('${RUNNER}', now(), '${state}', '${detail.replace(/'/g, "''")}')
     on conflict (id) do update set at = excluded.at, state = excluded.state, detail = excluded.detail,
       cycles = runner_heartbeat.cycles + 1`,
  );
}

function sleep(ms: number): void {
  // synchronous on purpose: one supervisor, one child, nothing else to do while waiting
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function main(): void {
  const passThrough = process.argv.slice(2);
  let restarts = 0;
  let crashes = 0;
  let failures = 0;

  for (;;) {
    const started = Date.now();
    beat('running', `attempt ${restarts + 1}`);
    const child = spawnSync('npx', ['tsx', 'scripts/support-once.ts', ...passThrough], { encoding: 'utf8' });
    const ranForMs = Date.now() - started;
    if (child.stdout) process.stdout.write(child.stdout);
    if (child.stderr) process.stderr.write(child.stderr);

    const attempt: Attempt = {
      restarts,
      maxRestarts: MAX_RESTARTS,
      exitCode: child.status ?? 1,
      ranForMs,
      minUptimeMs: MIN_UPTIME_MS,
      crashes,
      maxCrashes: MAX_CRASHES,
      failures,
      maxFailures: MAX_FAILURES,
    };
    const step = decide(attempt);

    if (step.action === 'run') {
      beat('running', 'still running');
    } else if (step.action === 'restart') {
      restarts += 1;
      crashes = ranForMs < MIN_UPTIME_MS ? crashes + 1 : 0;
      failures += 1;
      beat('restarting', `exit ${attempt.exitCode} after ${ranForMs}ms`);
      console.log(`[supervisor] restart in ${step.delayMs}ms (exit ${attempt.exitCode}, ${ranForMs}ms)`);
      sleep(step.delayMs);
    } else {
      beat('stopped', `${step.reason}${step.page ? ' PAGE' : ''}`);
      console.log(`[supervisor] stopped: ${step.reason}${step.page ? ' (this needs a person)' : ''}`);
      if (step.page) process.exitCode = 3;
      return;
    }
  }
}

main();
