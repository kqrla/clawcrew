/**
 * docs/56. the producer: for every leased code task that names a repo, compute what the repo can
 * prove. git for the artifact, the test suite for whether it works.
 *
 * it runs the tests rather than trusting a claim, so it is the slowest pass in the org, which is
 * why it is its own job on its own clock.
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { lit, marked, sql } from '../src/store/sql-cli.js';
import { CodeTask, Probe, buildEvidence } from '../src/jobs/code-evidence.js';

const F = '\u001f';
const rows = (select: string): string[] => {
  const out = marked(`select '##' || coalesce((${select}), '') || '##' as k`);
  return out.split('~').filter(Boolean);
};
const parts = (r: string): string[] => r.split(F);

const leased = rows(
  `select string_agg(t.id || '${F}' || t.kind || '${F}' || coalesce(t.repo, '') || '${F}' || l.seat || '${F}' ||
                     (select count(*) from task c where c.parent_task = t.id), '~' order by t.id)
     from task t join seat_lease l on l.task_id = t.id and l.released_at is null and l.expires_at > now()
    where t.kind = 'code'`,
).map((r) => {
  const [id, kind, repo, seat, children] = parts(r);
  return { task: { id: id!, kind: kind!, repo: repo || null, children: Number(children ?? 0) } as CodeTask, seat: seat! };
});

const probe = (repo: string): Probe => {
  const git = (args: string[]): string => execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8' }).trim();
  if (!existsSync(join(repo, '.git'))) return { sha: null, commitsAhead: 0, tests: null };
  const sha = git(['rev-parse', 'HEAD']);
  // "ahead" is measured against the merge base with origin/main, so a clean checkout of the
  // branch the lease started from counts as zero work rather than as progress
  let ahead = 0;
  try {
    ahead = Number(git(['rev-list', '--count', 'HEAD', '^origin/main']));
  } catch {
    ahead = Number(git(['rev-list', '--count', 'HEAD'])) > 0 ? 1 : 0;
  }
  return { sha, commitsAhead: ahead, tests: null };
};

let written = 0;
let refused = 0;
for (const { task, seat } of leased) {
  const verdictRepo = task.repo;
  if (!verdictRepo) {
    const v = buildEvidence(task, { sha: null, commitsAhead: 0, tests: null }, seat);
    console.log(`code-evidence: ${task.id} refused (${v.ok ? 'ok' : v.why})`);
    refused += 1;
    continue;
  }

  const p = probe(verdictRepo);
  // the suite is the ci half, and it is run here so the number is computed, never reported
  if (p.sha) {
    try {
      // the suite lives where its config lives: a monorepo's root has no vitest config, and
      // running there fails for a reason that has nothing to do with the change being proved
      const suiteRoot = existsSync(join(verdictRepo, 'backend', 'package.json'))
        ? join(verdictRepo, 'backend')
        : verdictRepo;
      const out = execFileSync('npx', ['vitest', 'run', '--reporter=basic'], {
        cwd: suiteRoot, encoding: 'utf8', timeout: 900_000, maxBuffer: 20 * 1024 * 1024,
      });
      const m = /Tests\s+(\d+) passed/.exec(out);
      const failed = /(\d+) failed/.exec(out);
      p.tests = { passed: Number(m?.[1] ?? 0), failed: Number(failed?.[1] ?? 0) };
    } catch (e) {
      const out = String((e as { stdout?: string }).stdout ?? '');
      const failed = /(\d+) failed/.exec(out);
      const passed = /Tests\s+(\d+) passed/.exec(out);
      p.tests = { passed: Number(passed?.[1] ?? 0), failed: Number(failed?.[1] ?? 1) };
    }
  }

  const verdict = buildEvidence(task, p, seat);
  if (!verdict.ok) {
    console.log(`code-evidence: ${task.id} refused (${verdict.why})`);
    refused += 1;
    continue;
  }
  for (const proof of verdict.proofs) {
    sql(
      `insert into evidence (objective, kind, source, value, run_by, computed_at, task_id)
       select objective_id, ${lit(proof.kind)}, ${lit(proof.source)}, ${proof.value}, ${lit(proof.runBy)}, now(), ${lit(task.id)}
         from task where id = ${lit(task.id)}`,
    );
    written += 1;
    console.log(`code-evidence: ${task.id} + ${proof.source}`);
  }
}
console.log(`code-evidence: ${written} proofs written, ${refused} refused, ${leased.length} leased code tasks`);
