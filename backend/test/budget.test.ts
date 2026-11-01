import { describe, expect, it } from 'vitest';
import {
  BudgetPolicy,
  Reservation,
  expired,
  position,
  release,
  reserve,
  settle,
} from '../src/domain/budget.js';

/**
 * docs/27 §9a. we stored a budget and never read it. these tests are the
 * reason the reservation exists: the hold is what stops two runs spending the
 * same dollar, and settling is what keeps the ledger true after an overrun.
 */
const NOW = '2026-11-01T12:00:00.000Z';

const policy = (over: Partial<BudgetPolicy> = {}): BudgetPolicy => ({
  id: 'bp.tier.root.usd.day',
  scope: 'tier',
  scopeId: 't.root',
  metric: 'usd_cents',
  window: 'day',
  amount: 10_000, // $100/day
  warnPercent: 0.8,
  hardStop: true,
  ...over,
});

const held = (amount: number, id = 'r1'): Reservation => ({
  id,
  policyId: 'bp.tier.root.usd.day',
  agentId: 'seat.a',
  runRef: 'run.1',
  amount,
  state: 'held',
  startedAt: NOW,
});

describe('position', () => {
  it('counts holds as spent, because an unspent hold is not available again', () => {
    const p = position(policy(), [held(3000), held(2000, 'r2')]);
    expect(p.held).toBe(5000);
    expect(p.settled).toBe(0);
    expect(p.committed).toBe(5000);
    expect(p.remaining).toBe(5000);
    expect(p.state).toBe('ok');
  });

  it('warns before it stops', () => {
    const p = position(policy(), [held(8500)]);
    expect(p.state).toBe('warn');
    expect(p.warnAt).toBe(8000);
  });

  it('settles to the amount that actually left, not the estimate', () => {
    const settled: Reservation = { ...held(3000), state: 'settled', settledAmount: 1200, settledAt: NOW };
    expect(position(policy(), [settled]).settled).toBe(1200);
    expect(position(policy(), [settled]).held).toBe(0);
  });

  it('ignores released holds and other policies', () => {
    const released: Reservation = { ...held(4000), state: 'released' };
    const foreign: Reservation = { ...held(9000, 'r9'), policyId: 'bp.other' };
    const p = position(policy(), [released, foreign]);
    expect(p.committed).toBe(0);
  });
});

describe('reserve', () => {
  it('holds before the spend and reports what is left', () => {
    const out = reserve(policy(), [], { id: 'r1', agentId: 'seat.a', runRef: 'run.1', amount: 2500, now: NOW });
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.reservation.state).toBe('held');
      expect(out.position.remaining).toBe(7500);
      expect(out.warning).toBe(false);
    }
  });

  it('refuses a hold that would cross a hard ceiling', () => {
    const out = reserve(policy(), [held(9000)], {
      id: 'r2',
      agentId: 'seat.a',
      runRef: 'run.2',
      amount: 2000,
      now: NOW,
    });
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.reason).toBe('budget_would_be_exceeded');
  });

  it('refuses anything once the ceiling is already committed', () => {
    const out = reserve(policy(), [held(10_000)], {
      id: 'r2',
      agentId: 'seat.a',
      runRef: 'run.2',
      amount: 1,
      now: NOW,
    });
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.reason).toBe('budget_exhausted');
  });

  it('lets a soft policy overspend, and says so', () => {
    const out = reserve(policy({ hardStop: false }), [held(9500)], {
      id: 'r2',
      agentId: 'seat.a',
      runRef: 'run.2',
      amount: 2000,
      now: NOW,
    });
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.warning).toBe(true);
  });

  it('refuses a hold with nobody to attribute it to', () => {
    const out = reserve(policy(), [], { id: 'r1', agentId: '', runRef: 'run.1', amount: 100, now: NOW });
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.reason).toBe('reservation_needs_an_owner');
  });

  it('refuses a zero or negative hold', () => {
    for (const amount of [0, -5, Number.NaN]) {
      const out = reserve(policy(), [], { id: 'r1', agentId: 'seat.a', runRef: 'run.1', amount, now: NOW });
      expect(out.ok).toBe(false);
    }
  });
});

describe('settle and release', () => {
  it('records an overrun instead of refusing it', () => {
    const out = settle(policy(), [held(1000)], held(1000), 1800, NOW);
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.overrun).toBe(true);
      expect(out.reservation.settledAmount).toBe(1800);
      expect(out.position.settled).toBe(1800);
    }
  });

  it('settles a hold once', () => {
    const settledReservation = { ...held(1000), state: 'settled' as const, settledAmount: 1000 };
    const out = settle(policy(), [settledReservation], settledReservation, 1000, NOW);
    expect(out).toEqual({ ok: false, reason: 'reservation_not_held:settled' });
  });

  it('releases a hold and refuses to release a settled spend', () => {
    const r = held(1000);
    expect(release(r)).toMatchObject({ state: 'released' });
    const settledReservation = { ...r, state: 'settled' as const, settledAmount: 900 };
    expect(release(settledReservation)).toEqual({ reason: 'reservation_not_held:settled' });
  });

  it('finds holds whose run never came back', () => {
    const old = { ...held(1000, 'r1'), startedAt: '2026-11-01T09:00:00.000Z' };
    const fresh = { ...held(1000, 'r2'), startedAt: NOW };
    expect(expired([old, fresh], NOW, 2 * 60 * 60_000).map((r) => r.id)).toEqual(['r1']);
  });
});
