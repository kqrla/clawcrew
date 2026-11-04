/**
 * docs/44. self-hostable means the database is reachable over postgres, not over one
 * vendor's https api. the interface stays synchronous because the domain is synchronous,
 * so the driver is psql when DATABASE_URL is set and the cli otherwise.
 */
import { execFileSync } from 'node:child_process';
import { pgRunner } from './pg-runner.js';

export interface Runner {
  name: string;
  run(statement: string): string;
}

export const cliRunner: Runner = {
  name: 'insforge-cli',
  run(statement) {
    return execFileSync('npx', ['--yes', '@insforge/cli', 'db', 'query', statement], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 120_000,
      cwd: process.cwd(),
    });
  },
};

export const psqlRunner: Runner = {
  name: 'psql',
  run(statement) {
    // -A unaligned, -t tuples only, -q quiet: the marker in the statement does the framing
    return execFileSync('psql', [process.env.DATABASE_URL!, '-A', '-t', '-q', '-v', 'ON_ERROR_STOP=1', '-c', statement], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 120_000,
    });
  },
};

/** one place decides which, and it says which, so a log can be read without guessing */
export function chooseRunner(env: NodeJS.ProcessEnv): Runner {
  // node-pg needs nothing installed; psql stays available for a box that has it
  if (!env.DATABASE_URL) return cliRunner;
  return env.CLAWCREW_DRIVER === 'psql' ? psqlRunner : pgRunner;
}

let active: Runner | null = null;

function runner(): Runner {
  active ??= chooseRunner(process.env);
  return active;
}

export function setRunner(r: Runner): void {
  active = r;
}

export function sql(statement: string): string {
  return runner().run(statement);
}

export function cell(expr: string, from = ''): string {
  const out = sql(`select '##' || (${expr}) || '##' as k ${from ? `from ${from}` : ''}`).replace(/\n/g, ' ');
  const m = /##([\s\S]*?)##/.exec(out);
  if (!m) throw new Error(`unreadable result for ${expr}: ${out.slice(0, 200)}`);
  return m[1]!.trim();
}

/** read the marker out of a statement that had to be written top-level, not wrapped */
export function marked(statement: string): string {
  const out = sql(statement).replace(/\n/g, ' ');
  const m = /##([\s\S]*?)##/.exec(out);
  if (!m) throw new Error(`unreadable result: ${out.slice(0, 200)}`);
  return m[1]!.trim();
}

/** one quoting helper, so a value is never interpolated raw into a statement */
export const lit = (s: string | null | undefined): string =>
  s === null || s === undefined ? 'null' : `'${String(s).replace(/'/g, "''")}'`;
