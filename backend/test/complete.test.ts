import { describe, expect, it } from 'vitest';
import { BACKOFF_MS, Evidence, Lease, judge } from '../src/jobs/complete.js';

/** docs/52. evidence newer than the lease, or the task goes back. */
const T0 = new Date('2026-11-07T10:00:00Z');
const lease: Lease = {
  taskId: 't.1', seat: 'seat.support', kind: 'support', objectiveId: 'obj.mein',
  acquiredAt: T0, expiresAt: new Date(T0.getTime() + 15 * 60_000), attempts: 0, maxAttempts: 3,
};
const ev = (over: Partial<Evidence> = {}): Evidence => ({
  objectiveId: 'obj.mein', kind: 'support', computedAt: new Date(T0.getTime() + 60_000), runBy: 'seat.support', ...over,
});

describe('completing a lease', () => {
  it('completes on evidence computed after the lease was taken', () => {
    expect(judge(lease, [ev()], new Date(T0.getTime() + 120_000))).toEqual({ action: 'complete', evidence: ev() });
  });

  it('holds while the lease is still running and nothing has landed yet', () => {
    expect(judge(lease, [], new Date(T0.getTime() + 60_000))).toEqual({ action: 'hold', why: 'lease_running' });
  });

  it('will not accept evidence that predates the lease as proof of this attempt', () => {
    const old = ev({ computedAt: new Date(T0.getTime() - 60_000) });
    expect(judge(lease, [old], new Date(T0.getTime() + 20 * 60_000)))
      .toEqual({ action: 'requeue', why: 'stale_evidence', backoffMs: BACKOFF_MS });
  });

  it('rejects evidence of the wrong kind, which is the mistake a shared table invites', () => {
    const wrong = ev({ kind: 'commit' });
    expect(judge(lease, [wrong], new Date(T0.getTime() + 20 * 60_000)))
      .toEqual({ action: 'requeue', why: 'wrong_kind', backoffMs: BACKOFF_MS });
  });

  it('requeues with nothing at all once the lease has expired', () => {
    expect(judge(lease, [], new Date(T0.getTime() + 20 * 60_000)))
      .toEqual({ action: 'requeue', why: 'no_evidence', backoffMs: BACKOFF_MS });
  });

  it('escalates instead of looping forever', () => {
    const tired: Lease = { ...lease, attempts: 3, maxAttempts: 3 };
    expect(judge(tired, [], new Date(T0.getTime() + 20 * 60_000)))
      .toEqual({ action: 'escalate', why: 'attempts_exhausted' });
  });
});
