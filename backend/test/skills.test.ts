import { describe, expect, it } from 'vitest';
import {
  Skill,
  canInvoke,
  markStale,
  register,
  select,
  verify,
} from '../src/domain/skills.js';

const skill: Skill = {
  id: 'skill.reconcile-invoices',
  version: 3,
  hash: 'sha256:aaa',
  ownerTier: 'fin.ops',
  intent: 'match stripe payouts to invoices',
  surface: 'db.billing.invoices',
  requires: { tools: ['db.read', 'db.write', 'stripe.read'], spendUsdPerDay: 0 },
  testRef: 'artifact://sha256:test',
  lastVerifiedAt: '2026-10-20T00:00:00Z',
  verifiedAgainst: 'fp:v7',
  status: 'active',
};

const ctx = {
  callerTier: 'fin.ops.backoffice',
  callerGrants: { tools: ['db.read', 'db.write', 'stripe.read', 'db.write'], spendUsdPerDay: 5 },
  now: '2026-11-01T00:00:00Z',
  surfaceFingerprint: 'fp:v7',
};

describe('skill invocation', () => {
  it('allows a caller that already holds every requirement', () => {
    const r = canInvoke(skill, ctx);
    expect(r.allowed).toBe(true);
    expect(r.denials).toEqual([]);
  });

  it('never lends authority the caller does not already hold', () => {
    const engineer = { ...ctx, callerGrants: { tools: ['git.read', 'db.read', 'stripe.read'] } };
    const r = canInvoke(skill, engineer);
    expect(r.allowed).toBe(false);
    expect(r.denials).toContain('missing_requirement');
    expect(r.detail).toContain('db.write');
    expect(r.effective?.tools).toEqual(['db.read', 'stripe.read']);
  });

  it('caps spend at the lower of caller and skill', () => {
    const r = canInvoke({ ...skill, requires: { ...skill.requires, spendUsdPerDay: 50 } }, ctx);
    expect(r.effective?.spendUsdPerDay).toBe(5);
  });

  it('refuses when the surface moved underneath the test', () => {
    const r = canInvoke(skill, { ...ctx, surfaceFingerprint: 'fp:v8' });
    expect(r.allowed).toBe(false);
    expect(r.denials).toContain('surface_changed');
  });

  it('refuses an unverified skill older than the window', () => {
    const r = canInvoke(skill, { ...ctx, now: '2026-12-15T00:00:00Z' });
    expect(r.denials).toContain('verification_expired');
  });

  it('refuses a retired or stale skill', () => {
    expect(canInvoke({ ...skill, status: 'retired' }, ctx).denials).toContain('retired');
    expect(canInvoke(markStale(skill, 'surface renamed'), ctx).denials).toContain('stale');
  });

  it('refuses a skill with no runnable test', () => {
    const r = canInvoke({ ...skill, testRef: 'we think it works' }, ctx);
    expect(r.denials).toContain('test_missing');
  });
});

describe('verification', () => {
  it('reactivates on a passing test and records the fingerprint it saw', () => {
    const v = verify({ ...skill, status: 'stale' }, {
      testPassed: true,
      surfaceFingerprint: 'fp:v8',
      now: '2026-11-01T00:00:00Z',
    });
    expect(v.status).toBe('active');
    expect(v.verifiedAgainst).toBe('fp:v8');
  });

  it('marks stale on a failing test', () => {
    const v = verify(skill, {
      testPassed: false,
      surfaceFingerprint: 'fp:v7',
      now: '2026-11-01T00:00:00Z',
    });
    expect(v.status).toBe('stale');
  });
});

describe('registration and retrieval', () => {
  const candidate = {
    id: 'skill.new',
    hash: 'sha256:bbb',
    ownerTier: 'fin.ops',
    intent: 'match stripe payouts to invoices',
    surface: 'db.billing.invoices',
    requires: { tools: ['db.read'] },
    testRef: 'artifact://sha256:test2',
  };

  it('refuses a duplicate of the same code on the same surface', () => {
    const r = register({ ...candidate, hash: 'sha256:aaa' }, [skill]);
    expect(r.problems).toContain('duplicate_hash');
  });

  it('refuses a second skill claiming the same intent on the same surface', () => {
    const r = register(candidate, [skill]);
    expect(r.problems).toContain('duplicate_intent');
  });

  it('refuses a skill with no test or no owner', () => {
    const r = register({ ...candidate, testRef: 'todo', ownerTier: '' }, []);
    expect(r.problems).toEqual(expect.arrayContaining(['no_test', 'no_owner']));
  });

  it('retrieves by surface first and excludes anything unverified', () => {
    const other = { ...skill, id: 'skill.other', surface: 'db.crm.contacts', intent: 'invoices' };
    const stale = { ...skill, id: 'skill.old', status: 'stale' as const };
    const hits = select([other, stale, skill], {
      surface: 'db.billing.invoices',
      intent: 'match invoices',
      now: '2026-11-01T00:00:00Z',
      surfaceFingerprint: 'fp:v7',
    });
    expect(hits[0]?.id).toBe('skill.reconcile-invoices');
    expect(hits.map((s) => s.id)).not.toContain('skill.old');
  });
});
