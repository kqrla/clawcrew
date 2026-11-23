/**
 * docs/56. what a code task can prove, and when it is too big to prove anything.
 *
 * evidence has to be computed by code, after the lease, from the artifact itself. a task high in
 * the breakdown cannot name a repo, and a task that cannot name a repo cannot produce a commit:
 * the honest answer there is "break it down", not a synthetic artifact.
 */
export interface CodeTask {
  id: string;
  kind: string;
  /** absolute path or owner/name. one repo, because one artifact is what evidence means */
  repo: string | null;
  /** how many subtasks this task already has: a parent is a plan, not a piece of work */
  children: number;
}
export interface Probe {
  /** full commit sha at HEAD, or null when the directory is not a repository */
  sha: string | null;
  commitsAhead: number;
  tests: { passed: number; failed: number } | null;
}
export type RepoVerdict = { ok: true; repo: string } | { ok: false; why: 'needs_breakdown' | 'repo_unknown' };
export interface Proof {
  kind: string;
  source: string;
  value: number;
  runBy: string;
}
export type EvidenceVerdict =
  | { ok: true; proofs: Proof[] }
  | { ok: false; why: 'repo_unknown' | 'needs_breakdown' | 'not_a_repo' | 'no_commit' | 'ci_not_green' | 'ci_missing' };

export function resolveRepo(task: CodeTask): RepoVerdict {
  if (task.repo && task.repo.trim().length > 0) return { ok: true, repo: task.repo.trim() };
  // a task with subtasks is a breakdown: its children are the ones that name repositories
  if (task.children > 0) return { ok: false, why: 'needs_breakdown' };
  return { ok: false, why: 'repo_unknown' };
}

export function buildEvidence(task: CodeTask, probe: Probe, runBy: string): EvidenceVerdict {
  const resolved = resolveRepo(task);
  if (!resolved.ok) return { ok: false, why: resolved.why };
  if (probe.sha === null) return { ok: false, why: 'not_a_repo' };
  if (probe.commitsAhead <= 0) return { ok: false, why: 'no_commit' };
  if (!probe.tests) return { ok: false, why: 'ci_missing' };
  if (probe.tests.failed > 0) return { ok: false, why: 'ci_not_green' };

  // two distinct sources, because the code rule asks for a commit and a green run: one artifact
  // is a claim that something changed, two are a claim that it works
  return {
    ok: true,
    proofs: [
      { kind: 'code', source: `git:${probe.sha.slice(0, 12)}`, value: probe.commitsAhead, runBy },
      { kind: 'code', source: `ci:vitest:${probe.tests.passed}`, value: probe.tests.passed, runBy },
    ],
  };
}
