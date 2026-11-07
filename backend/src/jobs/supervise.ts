/**
 * docs/43. supervision: the decision, kept pure so it can be argued with.
 *
 * an unsupervised loop fails in the quiet way: it stops, nothing restarts it, and the only
 * evidence is a ticket that stayed open. the decision below is the whole policy, and it is
 * a function rather than a flag soup so that "restart it" and "stop and shout" can be tested.
 */
export interface Attempt {
  /** how many times this supervisor has restarted the child so far */
  restarts: number;
  maxRestarts: number;
  /** null means it has not exited */
  exitCode: number | null;
  /** how long the child ran before exiting */
  ranForMs: number;
  /** a child that dies sooner than this is crashing, not working */
  minUptimeMs: number;
  /** consecutive short-lived exits: dying instantly is a different fault from failing */
  crashes: number;
  maxCrashes: number;
  /** consecutive non-zero exits, however long each attempt lasted */
  failures: number;
  maxFailures: number;
}

export type Step =
  | { action: 'run' }
  | { action: 'restart'; delayMs: number }
  | { action: 'stop'; reason: 'finished' | 'crash_loop' | 'failing' | 'too_many_restarts'; page: boolean };

/** the backoff: a crash loop must not become a hot loop that spends money on every pass */
export function backoffMs(restarts: number): number {
  return Math.min(1000 * 2 ** Math.min(restarts, 6), 60_000);
}

export function decide(a: Attempt): Step {
  if (a.exitCode === null) return { action: 'run' };
  if (a.exitCode === 0 && a.crashes === 0) return { action: 'stop', reason: 'finished', page: false };
  if (a.ranForMs < a.minUptimeMs) {
    if (a.crashes >= a.maxCrashes) return { action: 'stop', reason: 'crash_loop', page: true };
    return { action: 'restart', delayMs: backoffMs(a.crashes) };
  }
  // a child that keeps exiting non-zero is failing, whatever its uptime. the first version
  // only counted instant deaths, so a provider returning 401 every 23 seconds was restarted
  // five times before anyone was told, and each attempt claimed and released a real ticket
  if (a.failures >= a.maxFailures) return { action: 'stop', reason: 'failing', page: true };
  if (a.restarts >= a.maxRestarts) return { action: 'stop', reason: 'too_many_restarts', page: true };
  return { action: 'restart', delayMs: backoffMs(a.restarts) };
}

/**
 * docs/46. the supervisor must own the cadence, not share it.
 *
 * a child started with `--every 30000` is itself a loop that never exits, so the supervisor
 * waits forever on a child it will never see finish: no restarts, no logs, one heartbeat at
 * startup, and a container that says "Up". the health watcher caught this; nothing else did.
 * so `--every` belongs to the supervisor, and the child runs one pass at a time.
 */
export function planChild(argv: string[]): { childArgs: string[]; everyMs: number; job: string } {
  const rest: string[] = [];
  let everyMs = 0;
  let job = 'support';
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]!;
    if (a === '--every') {
      everyMs = Number(argv[i + 1] ?? 0) || 0;
      i += 1;
      continue;
    }
    if (a.startsWith('--every=')) {
      everyMs = Number(a.slice('--every='.length)) || 0;
      continue;
    }
    if (a === '--job') {
      job = argv[i + 1] ?? 'support';
      i += 1;
      continue;
    }
    if (a === '--cycles') {
      i += 1; // a single pass is the whole point; the supervisor repeats it
      continue;
    }
    if (a.startsWith('--cycles=')) continue;
    rest.push(a);
  }
  return { childArgs: [...rest, '--cycles', '1'], everyMs, job };
}
