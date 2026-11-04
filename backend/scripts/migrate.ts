/**
 * docs/40. a migration runner that cannot report a green it did not earn.
 *
 * the failure this replaces: statements were applied by a helper that shelled out
 * from whatever directory the caller happened to be in, printed `ok` when the output
 * did not look like an error, and exited zero either way. five okays and one failure
 * came back from a run that never reached a database.
 *
 * the rule now: probe first, require a zero exit code per statement, record what was
 * applied, and exit non-zero on anything surprising. a run that cannot prove the
 * database answered is a failed run.
 */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const MIGRATIONS = join(ROOT, 'migrations');

class Refusal extends Error {
  constructor(readonly code: string, message: string, readonly exitCode = 1) {
    super(message);
  }
}

function cli(sql: string): string {
  try {
    return execFileSync('npx', ['--yes', '@insforge/cli', 'db', 'query', sql], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 120_000,
    });
  } catch (err) {
    const e = err as { stdout?: string; stderr?: string; status?: number };
    throw new Refusal(
      'statement_failed',
      `${(e.stderr || e.stdout || String(err)).trim().slice(0, 400)} (exit ${e.status ?? '?'})`,
    );
  }
}

/** the cli draws a box; a marker inside the value survives any amount of padding */
function marked(expr: string, from = ''): string {
  const out = cli(`select '##' || (${expr}) || '##' as k ${from ? `from ${from}` : ''}`);
  const m = /##([\s\S]*?)##/.exec(out.replace(/\n/g, ' '));
  if (!m) throw new Refusal('unreadable_result', `could not read the result of: ${expr}\n${out.slice(0, 300)}`);
  return m[1]!.trim();
}

function probe(): void {
  let out: string;
  try {
    out = cli('select 1 as reachable');
  } catch (err) {
    const message = (err as Refusal).message ?? String(err);
    if (/No project linked|not linked/i.test(message)) {
      throw new Refusal('not_linked', `this directory is not linked to a database: ${message.slice(0, 200)}`, 2);
    }
    throw err;
  }
  if (!/reachable/.test(out)) throw new Refusal('probe_silent', `probe returned no result: ${out.slice(0, 200)}`, 2);
  if (/No project linked|not linked/i.test(out)) {
    throw new Refusal('not_linked', 'the cli is not linked to a project from this directory', 2);
  }
}

export function statements(sql: string): string[] {
  const clean = sql
    .split('\n')
    .filter((l) => !l.trim().startsWith('--'))
    .join('\n');
  // a dollar-quoted body cannot be split safely, so it goes as one batch
  if (clean.includes('$$')) return [clean.trim()].filter(Boolean);
  return clean
    .split(/;\s*(?:\n|$)/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * a baseline is a claim, so it gets checked. every table and view the file says it
 * creates has to actually exist, or the file was never applied and recording it as
 * applied is the same lie in a new place.
 */
export function objectNames(sql: string): string[] {
  const names = new Set<string>();
  const re = /create\s+(?:or\s+replace\s+)?(?:table|view)\s+(?:if\s+not\s+exists\s+)?([a-z_][a-z0-9_]*)/gi;
  for (const m of sql.matchAll(re)) names.add(m[1]!.toLowerCase());
  return [...names].sort();
}

function verifyObjects(file: string, sql: string): void {
  const names = new Set(objectNames(sql));
  if (names.size === 0) return;

  const list = [...names].map((n) => `'${n}'`).join(',');
  const present = new Set(
    marked(
      "coalesce(string_agg(table_name, ';'), '')",
      `information_schema.tables where table_schema = 'public' and table_name in (${list})`,
    )
      .split(';')
      .filter(Boolean),
  );
  const found = [...names].filter((n) => present.has(n)).length;
  if (found !== names.size) {
    throw new Refusal(
      'baseline_unverified',
      `${file} creates ${names.size} objects and only ${found} exist; it was never applied, so it cannot be baselined`,
    );
  }
}

function main(): void {
  const baseline = process.argv.includes('--baseline');
  probe();
  cli(
    'create table if not exists schema_migration (filename text primary key, sha256 text not null, applied_at timestamptz not null default now())',
  );

  cli(
    'create table if not exists schema_migration_statement (filename text not null, idx int not null, sha256 text not null, applied_at timestamptz not null default now(), primary key (filename, idx))',
  );

  const statementLedger = new Map<string, string>();
  for (const row of marked("coalesce(string_agg(filename || '#' || idx || '|' || sha256, ';'), '')", 'schema_migration_statement')
    .split(';')
    .filter(Boolean)) {
    const [key, hash] = row.split('|');
    if (key && hash) statementLedger.set(key, hash);
  }

  const applied = new Map<string, string>();
  const ledger = marked("coalesce(string_agg(filename || '|' || sha256, ';'), '')", 'schema_migration');
  for (const row of ledger.split(';').filter(Boolean)) {
    const [name, hash] = row.split('|');
    if (name && hash) applied.set(name, hash);
  }

  const files = readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort();
  if (applied.size === 0 && files.length > 0 && !baseline) {
    // an empty ledger means either a fresh database or a failed read. those look
    // identical from here, and guessing wrong means re-running DDL over live tables
    throw new Refusal('ledger_unreadable', 'the migration ledger returned nothing; refusing to assume it is empty', 2);
  }
  let touched = 0;

  for (const file of files) {
    const sql = readFileSync(join(MIGRATIONS, file), 'utf8');
    const hash = createHash('sha256').update(sql).digest('hex');
    const before = applied.get(file);

    if (before === hash) {
      console.log(`= ${file}  already applied`);
      continue;
    }
    if (before && before !== hash) {
      throw new Refusal('migration_changed', `${file} was applied as ${before.slice(0, 12)} and is now ${hash.slice(0, 12)}; write a new migration instead`);
    }

    if (baseline) {
      verifyObjects(file, sql);
      cli(`insert into schema_migration (filename, sha256) values ('${file}', '${hash}') on conflict (filename) do update set sha256 = '${hash}'`);
      console.log(`~ ${file}  BASELINED without executing: recorded as applied because it predates the ledger`);
      touched += 1;
      continue;
    }

    const parts = statements(sql);

    // the api refuses begin/rollback, so a file cannot be one transaction. what it
    // can be is idempotent and resumable: every statement is recorded as it lands, so
    // a failure names the line and a re-run continues from there instead of pretending
    // the file never happened.
    let done = 0;
    parts.forEach((part, i) => {
      const key = `${file}#${i + 1}`;
      const already = statementLedger.get(key);
      if (already === hash) {
        done += 1;
        return;
      }
      try {
        cli(part);
      } catch (err) {
        const snippet = part.replace(/\s+/g, ' ').slice(0, 80);
        throw new Refusal(
          'statement_failed',
          `${file} statement ${i + 1}/${parts.length}: ${snippet}\n  ${(err as Refusal).message.split('\n')[0]}\n  ${done} statements already recorded as applied`,
        );
      }
      cli(`insert into schema_migration_statement (filename, idx, sha256) values ('${file}', ${i + 1}, '${hash}') on conflict (filename, idx) do nothing`);
      done += 1;
    });
    console.log(`+ ${file}  applied (${parts.length} statements, ${done} now recorded)`);
    cli(
      `insert into schema_migration (filename, sha256) values ('${file}', '${hash}') on conflict (filename) do update set sha256 = '${hash}', applied_at = now()`,
    );
    touched += 1;
  }

  const n = marked("count(*)::text", "information_schema.tables where table_schema = 'public'");
  console.log(`\nverified: ${files.length} migrations known, ${touched} applied this run, ${n} public tables present`);
}

if (process.argv[1] && !process.argv[1].endsWith('migrate.ts')) {
  // imported by a test: no side effects
} else {
  try {
    main();
  } catch (err) {
    const r = err as Refusal;
    console.error(`\nFAILED ${r.code ?? 'unknown'}: ${r.message}`);
    console.error('nothing after this point was applied; the exit code is the report');
    process.exit(r.exitCode ?? 1);
  }
}
