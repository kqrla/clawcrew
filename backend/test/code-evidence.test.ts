import { describe, expect, it } from 'vitest';
import { CodeTask, Probe, buildEvidence, resolveRepo } from '../src/jobs/code-evidence.js';

/** docs/56. one repo, a commit after the lease, and a green run. */
const task = (over: Partial<CodeTask> = {}): CodeTask => ({ id: 't.1', kind: 'code', repo: '/srv/clawcrew', children: 0, ...over });
const probe = (over: Partial<Probe> = {}): Probe => ({ sha: 'abc123def456789', commitsAhead: 2, tests: { passed: 593, failed: 0 }, ...over });

describe('a code task and its repo', () => {
  it('uses the repo it names', () => {
    expect(resolveRepo(task())).toEqual({ ok: true, repo: '/srv/clawcrew' });
  });

  it('tells a breakdown apart from an unassigned task', () => {
    expect(resolveRepo(task({ repo: null, children: 3 }))).toEqual({ ok: false, why: 'needs_breakdown' });
    expect(resolveRepo(task({ repo: null, children: 0 }))).toEqual({ ok: false, why: 'repo_unknown' });
    expect(resolveRepo(task({ repo: '   ' }))).toEqual({ ok: false, why: 'repo_unknown' });
  });

  it('produces a commit and a green run as two distinct sources', () => {
    const r = buildEvidence(task(), probe(), 'seat.code');
    expect(r.ok).toBe(true);
    expect(r.ok && r.proofs.map((p) => p.source)).toEqual(['git:abc123def456', 'ci:vitest:593']);
    expect(r.ok && new Set(r.proofs.map((p) => p.source)).size).toBe(2);
  });

  it('refuses a directory that is not a repository', () => {
    expect(buildEvidence(task(), probe({ sha: null }), 'seat.code')).toEqual({ ok: false, why: 'not_a_repo' });
  });

  it('refuses when nothing was committed, which is the common way to fake progress', () => {
    expect(buildEvidence(task(), probe({ commitsAhead: 0 }), 'seat.code')).toEqual({ ok: false, why: 'no_commit' });
  });

  it('refuses a red or missing test run', () => {
    expect(buildEvidence(task(), probe({ tests: { passed: 590, failed: 3 } }), 'seat.code')).toEqual({ ok: false, why: 'ci_not_green' });
    expect(buildEvidence(task(), probe({ tests: null }), 'seat.code')).toEqual({ ok: false, why: 'ci_missing' });
  });

  it('never produces evidence for a task too high to name a repo', () => {
    expect(buildEvidence(task({ repo: null, children: 2 }), probe(), 'seat.code')).toEqual({ ok: false, why: 'needs_breakdown' });
  });
});
