import { describe, expect, it } from 'vitest';
import {
  Evidence,
  Objective,
  canClose,
  childClaimsAreNotEvidence,
  retire,
  stalled,
  untraceable,
  unsupported,
  validateObjective,
} from '../src/domain/objectives.js';

const base: Objective = {
  id: 'obj.activation',
  parent: 'obj.revenue',
  ownerTier: 'product.onboarding',
  statement: 'new accounts reach first sync within 24h',
  metric: 'pct_first_sync_24h',
  source: 'sql:analytics.activation_daily',
  baseline: 0.31,
  target: 0.55,
  deadline: '2026-12-15',
  status: 'active',
  version: 1,
};

const ev = (value: number, computedAt = '2026-11-07T06:00:00Z', source = base.source): Evidence => ({
  objective: base.id,
  source,
  value,
  computedAt,
  runBy: 'auditor',
});

describe('objective validation', () => {
  it('requires an executable source', () => {
    expect(validateObjective({ ...base, source: 'a dashboard somewhere' })).toContain('source_must_be_executable');
    expect(validateObjective(base)).toEqual([]);
  });

  it('refuses a target equal to the baseline', () => {
    expect(validateObjective({ ...base, target: base.baseline })).toContain('target_equals_baseline');
  });

  it('refuses a self-reported objective with a parent', () => {
    expect(validateObjective({ ...base, selfReported: true })).toContain(
      'self_reported_cannot_satisfy_a_parent',
    );
  });
});

describe('closure', () => {
  it('never closes on claims alone', () => {
    const r = canClose(base, []);
    expect(r.ok).toBe(false);
    expect(r.reasons).toContain('no_evidence_from_declared_source');
  });

  it('closes on evidence from the declared source only', () => {
    expect(canClose(base, [ev(0.6, '2026-11-07T06:00:00Z', 'http:somewhere-else')]).ok).toBe(false);
    expect(canClose(base, [ev(0.6)]).ok).toBe(true);
  });

  it('refuses when the target is not met', () => {
    expect(canClose(base, [ev(0.47)]).reasons).toContain('target_not_met');
  });

  it('requires evidence newer than the last amendment', () => {
    const r = canClose(base, [ev(0.6, '2026-11-01T00:00:00Z')], { since: '2026-11-05T00:00:00Z' });
    expect(r.ok).toBe(false);
  });

  it('cannot substitute child completion for its own metric', () => {
    expect(childClaimsAreNotEvidence([{ ok: true, reasons: [] }])).toEqual([
      'child_completion_is_necessary_not_sufficient',
    ]);
  });

  it('lower-is-better objectives compare in the right direction', () => {
    const churn = { ...base, baseline: 0.08, target: 0.03 };
    expect(canClose(churn, [ev(0.02)]).ok).toBe(true);
    expect(canClose(churn, [ev(0.06)]).ok).toBe(false);
  });
});

describe('drift queries', () => {
  const tasks = [
    { id: 't1', objectiveId: null, state: 'in_progress' as const, costUsd: 0 },
    { id: 't2', objectiveId: 'obj.activation', state: 'done' as const, costUsd: 12, completedAt: '2026-11-06T00:00:00Z' },
    { id: 't3', objectiveId: 'obj.activation', state: 'done' as const, costUsd: 3, completedAt: '2026-11-08T00:00:00Z' },
  ];

  it('finds work with no objective', () => {
    expect(untraceable(tasks).map((t) => t.id)).toEqual(['t1']);
  });

  it('finds completed work with no later evidence', () => {
    expect(unsupported(tasks, [ev(0.6, '2026-11-07T06:00:00Z')]).map((t) => t.id)).toEqual(['t3']);
  });

  it('flags an objective that never moved', () => {
    const old = { ...base, deadline: '2026-10-01' };
    expect(stalled([old], [ev(0.312)], '2026-11-30T00:00:00Z').map((o) => o.id)).toEqual(['obj.activation']);
  });

  it('retirement requires a reason', () => {
    expect(() => retire(base, '   ')).toThrow();
    expect(retire(base, 'cac too high', 'obj.partner').status).toBe('superseded');
  });
});
