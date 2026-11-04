/**
 * docs/41. the sandbox reaches the database over https only, so 5432 is not on offer
 * and the cli is the driver. results come back between markers because the cli draws
 * a box and reading a drawn table is how a migration once reported 90 tables.
 */
import { execFileSync } from 'node:child_process';

export function sql(statement: string): string {
  return execFileSync('npx', ['--yes', '@insforge/cli', 'db', 'query', statement], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 120_000,
    cwd: process.cwd(),
  });
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

export const lit = (s: string | null | undefined): string =>
  s === null || s === undefined ? 'null' : `'${String(s).replace(/'/g, "''")}'`;
