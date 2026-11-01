import { describe, expect, it } from 'vitest';
import {
  Convergence,
  Report,
  barrier,
  cancelledByFirstSuccess,
  conflicts,
  integrationGate,
  report,
  stall,
  validateConvergence,
} from '../src/domain/convergence.js';

const base: Convergence = {
  id: 'conv.launch',
  parentObjective: 'obj.activation',
  circles: ['eng.product', 'brand.social', 'finance-ops'],
  partitions: {
    'page-build': 'eng.product',
    'page-copy': 'brand.social',
    'pricing-line': 'finance-ops',
  },
  join: 'all',
  deadline: '2026-11-12T00:00:00Z',
  reports: [],
};

const ok = (circle: string, partition: string, extra: Partial<Report> = {}): Report => ({
  circle,
  partition,
  outcome: 'result',
  artifactRef: `artifact://sha256:${'a'.repeat(64)}`,
  touches: [],
  at: '2026-11-05T00:00:00Z',
  ...extra,
});

describe('convergence declaration', () => {
  it('requires an exhaustive partition map and a participant who owns something', () => {
    const bad = validateConvergence({
      ...base,
      circles: [...base.circles, 'seat.hanger-on'],
      partitions: { 'page-build': 'eng.product', orphan: 'ghost' },
    });
    expect(bad).toContain('owner_not_a_participant:orphan:ghost');
    expect(bad).toContain('participant_owns_nothing:brand.social');
    expect(bad).toContain('participant_owns_nothing:seat.hanger-on');
  });

  it('accepts a well-formed convergence', () => {
    expect(validateConvergence(base)).toEqual([]);
  });
});

describe('reports', () => {
  it('refuses a report for a partition you do not own', () => {
    expect(() => report(base, ok('eng.product', 'page-copy'))).toThrow(/does not own partition/);
  });

  it('refuses a result without an artifact', () => {
    expect(() => report(base, { ...ok('eng.product', 'page-build'), artifactRef: undefined })).toThrow(/artifact/);
  });

  it('refuses a skip without a reason, because silence is not a result', () => {
    expect(() =>
      report(base, { ...ok('brand.social', 'page-copy'), outcome: 'not_applicable', artifactRef: undefined }),
    ).toThrow(/requires a reason/);
  });

  it('refuses a second report for the same partition', () => {
    const once = report(base, ok('eng.product', 'page-build'));
    expect(() => report(once, ok('eng.product', 'page-build'))).toThrow(/already reported/);
  });
});

describe('the barrier', () => {
  it('is unsatisfied while any partition is silent', () => {
    const c = report(report(base, ok('eng.product', 'page-build')), ok('brand.social', 'page-copy'));
    const b = barrier(c);
    expect(b.satisfied).toBe(false);
    expect(b.missing).toEqual(['pricing-line']);
    expect(b.results).toBe(2);
  });

  it('is satisfied when every partition resolves under join=all', () => {
    let c = base;
    c = report(c, ok('eng.product', 'page-build'));
    c = report(c, ok('brand.social', 'page-copy'));
    c = report(c, ok('finance-ops', 'pricing-line', { outcome: 'not_applicable', artifactRef: undefined, reason: 'pricing unchanged this cycle' }));
    expect(barrier(c).satisfied).toBe(true);
  });

  it('does not let a blocked partition count as resolved', () => {
    let c = base;
    c = report(c, ok('eng.product', 'page-build'));
    c = report(c, ok('brand.social', 'page-copy'));
    c = report(c, { ...ok('finance-ops', 'pricing-line'), outcome: 'blocked', artifactRef: undefined, reason: 'cfo on leave' });
    const b = barrier(c);
    expect(b.satisfied).toBe(false);
    expect(b.blocked).toHaveLength(1);
  });

  it('honours quorum and first_success', () => {
    const quorum = { ...base, join: 'quorum' as const, quorum: 1 };
    expect(barrier(report(quorum, ok('eng.product', 'page-build'))).satisfied).toBe(true);

    const race = { ...base, join: 'first_success' as const };
    const won = report(race, ok('eng.product', 'page-build'));
    expect(barrier(won).satisfied).toBe(true);
    expect(cancelledByFirstSuccess(won, '2026-11-06T00:00:00Z').sort()).toEqual(['page-copy', 'pricing-line']);
  });
});

describe('integration gate', () => {
  it('refuses closure while the barrier is open', () => {
    const g = integrationGate(base, { parentMetricMeasured: true });
    expect(g.canClose).toBe(false);
    expect(g.reasons.some((r) => r.startsWith('unreported_partitions'))).toBe(true);
  });

  it('refuses closure even when every partition is in, if the parent metric has not moved', () => {
    let c = base;
    c = report(c, ok('eng.product', 'page-build'));
    c = report(c, ok('brand.social', 'page-copy'));
    c = report(c, ok('finance-ops', 'pricing-line'));
    expect(integrationGate(c, { parentMetricMeasured: false }).reasons).toContain('parent_metric_not_measured');
    expect(integrationGate(c, { parentMetricMeasured: true }).canClose).toBe(true);
  });
});

describe('divergence', () => {
  it('detects two teams writing the same surface', () => {
    let c = base;
    c = report(c, ok('eng.product', 'page-build', { touches: ['repo:site/pricing', 'repo:site/index'] }));
    c = report(c, ok('brand.social', 'page-copy', { touches: ['repo:site/pricing'] }));
    expect(conflicts(c)).toEqual([
      {
        surface: 'repo:site/pricing',
        circles: ['brand.social', 'eng.product'],
        artifacts: [`artifact://sha256:${'a'.repeat(64)}`],
      },
    ]);
  });

  it('reports no conflict when each surface has one owner', () => {
    const c = report(base, ok('eng.product', 'page-build', { touches: ['repo:site/index'] }));
    expect(conflicts(c)).toEqual([]);
  });

  it('flags a convergence that missed its deadline', () => {
    const s = stall(base, '2026-11-20T00:00:00Z');
    expect(s.overdue).toBe(true);
    expect(s.missing).toHaveLength(3);
    expect(stall(base, '2026-11-01T00:00:00Z').overdue).toBe(false);
  });
});
