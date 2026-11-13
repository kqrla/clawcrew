import { describe, expect, it } from 'vitest';
import { Proof, Rule, checkEvidence } from '../src/jobs/acceptance.js';

/** docs/55. a rule per kind, or no completion. */
const now = new Date('2026-11-13T12:00:00Z');
const rule: Rule = {
  kind: 'code', requires: 'a commit and a green ci run', sourcePattern: '^(git:|ci:)',
  minCount: 2, maxAgeHours: 72, needsSecondSeat: false,
};
const proof = (over: Partial<Proof> = {}): Proof => ({
  kind: 'code', source: 'git:abc123', runBy: 'seat.code', computedAt: new Date(now.getTime() - 3600_000), ...over,
});

describe('accepting evidence by kind', () => {
  it('refuses a kind with no rule, rather than defaulting to yes', () => {
    expect(checkEvidence(undefined, [proof()], now)).toEqual({ ok: false, why: 'no_rule' });
  });

  it('wants two artifacts for code, and says too_few for one commit', () => {
    expect(checkEvidence(rule, [proof()], now)).toEqual({ ok: false, why: 'too_few' });
    expect(checkEvidence(rule, [proof(), proof({ source: 'ci:run/9' })], now).ok).toBe(true);
  });

  it('rejects a source that does not match the rule', () => {
    expect(checkEvidence(rule, [proof({ source: 'vibes:good' }), proof({ source: 'vibes:better' })], now))
      .toEqual({ ok: false, why: 'source_mismatch' });
  });

  it('tells stale apart from absent', () => {
    const old = new Date(now.getTime() - 100 * 3600_000);
    expect(checkEvidence(rule, [proof({ source: 'git:a', computedAt: old }), proof({ source: 'ci:b', computedAt: old })], now))
      .toEqual({ ok: false, why: 'stale' });
  });

  it('wants a second seat where the rule says so', () => {
    const support: Rule = { kind: 'support', requires: 'signed', sourcePattern: '^run:', minCount: 1, maxAgeHours: 72, needsSecondSeat: true };
    const one = [proof({ kind: 'support', source: 'run:reply' })];
    expect(checkEvidence(support, one, now)).toEqual({ ok: false, why: 'unsigned' });
    expect(checkEvidence(support, [...one, proof({ kind: 'support', source: 'run:verify', runBy: 'seat.audit' })], now).ok).toBe(true);
  });

  it('ignores evidence of other kinds, which a shared table invites', () => {
    expect(checkEvidence(rule, [proof({ kind: 'doc' }), proof({ kind: 'doc' })], now))
      .toEqual({ ok: false, why: 'source_mismatch' });
  });
});
