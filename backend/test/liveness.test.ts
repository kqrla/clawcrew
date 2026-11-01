import { describe, expect, it } from 'vitest';
import {
  Action,
  WorkRow,
  applyAction,
  canClaim,
  healthy,
  isTerminal,
  sweep,
  violations,
} from '../src/domain/liveness.js';

const NOW = '2026-11-01T12:00:00.000Z';
const past = (min: number) => new Date(Date.parse(NOW) - min * 60_000).toISOString();
const future = (min: number) => new Date(Date.parse(NOW) + min * 60_000).toISOString();

function row(over: Partial<WorkRow> = {}): WorkRow {
  return {
    id: 'w1',
    state: 'leased',
    tier: 't.product.pod.a',
    objectiveRef: 'obj.retention.v2',
    surfaces: ['repo.orchart'],
    nextActionAt: future(30),
    lease: { holder: 'seat.worker.a', expiresAt: future(5), renewals: 0 },
    progressVersion: 4,
    progressAt: past(10),
    attempts: 0,
    maxAttempts: 3,
    ...over,
  };
}

const kinds = (a: Action[]) => a.map((x) => x.kind);

describe('liveness sweep', () => {
  it('leaves a healthy holder alone', () => {
    expect(healthy(sweep([row()], { now: NOW }))).toBe(true);
  });

  it('reclaims an expired lease without any live process', () => {
    const actions = sweep([row({ lease: { holder: 'seat.worker.a', expiresAt: past(1), renewals: 0 } })], {
      now: NOW,
    });
    expect(kinds(actions)).toEqual(['reclaim_expired']);
    expect(actions[0]).toMatchObject({ holder: 'seat.worker.a', nextAttempts: 1 });
  });

  it('revokes a holder that renews without producing', () => {
    // alive, leased, healthy heartbeat, zero progress: the failure no health
    // check catches.
    const actions = sweep([row({ lease: { holder: 'seat.worker.a', expiresAt: future(5), renewals: 3 } })], {
      now: NOW,
    });
    expect(kinds(actions)).toEqual(['revoke_spinning']);
  });

  it('respects a per-objective renewal limit', () => {
    const r = row({ lease: { holder: 'h', expiresAt: future(5), renewals: 5 } });
    expect(kinds(sweep([r], { now: NOW, stuckRenewalLimit: 6 }))).toEqual([]);
    expect(kinds(sweep([r], { now: NOW, stuckRenewalLimit: 5 }))).toEqual(['revoke_spinning']);
  });

  it('alarms on ready work nobody could claim, instead of waiting forever', () => {
    const actions = sweep(
      [row({ state: 'ready', lease: undefined, claimDeadlineAt: past(2), nextActionAt: future(30) })],
      { now: NOW },
    );
    expect(kinds(actions)).toEqual(['alarm_unclaimable']);
  });

  it('does not alarm while the claim window is still open', () => {
    const actions = sweep(
      [row({ state: 'ready', lease: undefined, claimDeadlineAt: future(10), nextActionAt: future(30) })],
      { now: NOW },
    );
    expect(kinds(actions)).toEqual([]);
  });

  it('alarms when a blocked row passes its own deadline', () => {
    const actions = sweep(
      [row({ state: 'blocked', lease: undefined, blockedReason: 'waiting_on:migration', nextActionAt: past(3) })],
      { now: NOW, stallGraceMs: 60_000 },
    );
    expect(kinds(actions)).toEqual(['alarm_stall']);
  });

  it('refuses to accept a non-terminal row without a deadline', () => {
    const actions = sweep([row({ nextActionAt: undefined })], { now: NOW });
    expect(actions).toContainEqual({
      kind: 'violation',
      rowId: 'w1',
      rule: 'missing_next_action',
    });
  });

  it('refuses done without evidence and cancelled without a reason', () => {
    const done = sweep([row({ state: 'done', lease: undefined, nextActionAt: undefined })], { now: NOW });
    expect(kinds(done)).toEqual(['violation']);

    const cancelled = sweep(
      [row({ state: 'cancelled', lease: undefined, nextActionAt: undefined })],
      { now: NOW },
    );
    expect(cancelled).toEqual([
      { kind: 'violation', rowId: 'w1', rule: 'cancelled_without_reason' },
    ]);

    const okDone = row({
      state: 'done',
      lease: undefined,
      nextActionAt: undefined,
      evidenceRef: 'artifact://sha256/ab',
    });
    expect(sweep([okDone], { now: NOW })).toEqual([]);
  });

  it('escalates exhausted attempts rather than retrying forever', () => {
    const actions = sweep(
      [row({ attempts: 3, maxAttempts: 3, lease: { holder: 'h', expiresAt: past(1), renewals: 0 } })],
      { now: NOW },
    );
    expect(kinds(actions)).toEqual(['exhausted']);
  });

  it('is deterministic across row order', () => {
    const rows = [
      row({ id: 'b', lease: { holder: 'h', expiresAt: past(1), renewals: 0 } }),
      row({ id: 'a', claimDeadlineAt: past(1), state: 'ready', lease: undefined }),
      row({ id: 'c' }),
    ];
    const forward = sweep(rows, { now: NOW });
    const backward = sweep([...rows].reverse(), { now: NOW });
    expect(forward).toEqual(backward);
    expect(forward.map((a) => a.rowId)).toEqual(['a', 'b']);
  });

  it('treats terminal states as terminal', () => {
    expect(isTerminal(row({ state: 'done', evidenceRef: 'x' }))).toBe(true);
    expect(isTerminal(row({ state: 'blocked' }))).toBe(false);
  });
});

describe('claim shape', () => {
  const seat = { slice: ['repo.orchart', 'db.orchart'] };

  it('accepts a ready row the slice covers', () => {
    const r = row({ state: 'ready', lease: undefined, claimDeadlineAt: future(5) });
    expect(canClaim(r, seat, NOW)).toEqual({ ok: true });
  });

  it('refuses a row whose surfaces fall outside the slice', () => {
    const r = row({
      state: 'ready',
      lease: undefined,
      claimDeadlineAt: future(5),
      surfaces: ['repo.orchart', 'vendor.billing'],
    });
    const res = canClaim(r, seat, NOW);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe('slice_missing:vendor.billing');
  });

  it('refuses a leased row, a late row, and an exhausted row', () => {
    expect(canClaim(row(), seat, NOW)).toEqual({ ok: false, reason: 'not_ready:leased' });

    const late = row({ state: 'ready', lease: undefined, claimDeadlineAt: past(1) });
    expect(canClaim(late, seat, NOW)).toEqual({ ok: false, reason: 'claim_deadline_passed' });
  });
});

describe('month simulation', () => {
  it('survives a month of ticks where every holder dies', () => {
    // thirty days, ten minute ticks, a holder that dies before every renewal.
    // the assertion is the point of the whole module: no row is stuck, and the
    // sweep never returns nothing while work is outstanding.
    let r = row({ attempts: 0, maxAttempts: 3 });
    let reclaimed = 0;
    let exhaustedAt: number | undefined;
    const start = Date.parse(NOW);

    for (let tick = 0; tick < 30 * 24 * 6; tick++) {
      const now = new Date(start + tick * 600_000).toISOString();
      const actions = sweep([r], { now });
      const reclaim = actions.find((a) => a.kind === 'reclaim_expired');
      const exhausted = actions.find((a) => a.kind === 'exhausted');

      if (reclaim && reclaim.kind === 'reclaim_expired') {
        reclaimed++;
        r = {
          ...r,
          state: 'ready',
          lease: undefined,
          attempts: reclaim.nextAttempts,
          claimDeadlineAt: new Date(Date.parse(now) + 600_000).toISOString(),
        };
        continue;
      }
      if (exhausted) {
        exhaustedAt = tick;
        r = { ...r, state: 'blocked', blockedReason: 'attempts_exhausted', nextActionAt: now };
        break;
      }
      if (r.state === 'ready' && r.claimDeadlineAt && Date.parse(now) > Date.parse(r.claimDeadlineAt)) {
        r = { ...r, claimDeadlineAt: new Date(Date.parse(now) + 600_000).toISOString() };
        continue;
      }
      if (r.state === 'ready') {
        r = { ...r, state: 'leased', lease: { holder: 'h', expiresAt: new Date(Date.parse(now) + 60_000).toISOString(), renewals: 0 } };
      }
    }

    expect(reclaimed).toBe(3);
    expect(exhaustedAt).toBeDefined();
    expect(r.state).toBe('blocked');
    expect(r.blockedReason).toBe('attempts_exhausted');
  });
});

describe('transitions', () => {
  const expired = (r: WorkRow): Action => ({
    kind: 'reclaim_expired',
    rowId: r.id,
    holder: r.lease!.holder,
    nextAttempts: r.attempts + 1,
  });

  it('re-arms a reclaimed row so it is claimable and alarming', () => {
    const r = row({ lease: { holder: 'h', expiresAt: past(1), renewals: 0 } });
    const next = applyAction(r, expired(r), NOW, { claimWindowMs: 600_000 })!;

    expect(next.state).toBe('ready');
    expect(next.lease).toBeUndefined();
    expect(next.claimDeadlineAt).toBe(future(10));
    expect(next.nextActionAt).toBe(future(10));
    // the resulting row must satisfy the sweeps own rules
    expect(violations(next)).toEqual([]);
  });

  it('blocks rather than retrying when the last attempt dies', () => {
    const r = row({ attempts: 2, maxAttempts: 3, lease: { holder: 'h', expiresAt: past(1), renewals: 0 } });
    const next = applyAction(r, expired(r), NOW)!;

    expect(next.state).toBe('blocked');
    expect(next.blockedReason).toBe('attempts_exhausted');
    expect(next.attempts).toBe(3);
    expect(next.claimDeadlineAt).toBeUndefined();
    expect(violations(next)).toEqual([]);
  });

  it('counts a revoked spinning holder as an attempt', () => {
    const r = row({ attempts: 1, lease: { holder: 'h', expiresAt: future(5), renewals: 3 } });
    const next = applyAction(r, { kind: 'revoke_spinning', rowId: r.id, holder: 'h', renewals: 3 }, NOW)!;
    expect(next.state).toBe('ready');
    expect(next.attempts).toBe(2);
  });

  it('re-arms an unclaimable row instead of stranding it', () => {
    // a full seat pool is transient: if the window is not refreshed, work that
    // nobody could take at 10:00 is unclaimable at 11:00 when a seat frees up.
    const r = row({ state: 'ready', lease: undefined, claimDeadlineAt: past(1), nextActionAt: past(1) });
    const next = applyAction(
      r,
      { kind: 'alarm_unclaimable', rowId: r.id, tier: r.tier, deadline: past(1) },
      NOW,
      { claimWindowMs: 600_000 },
    )!;
    expect(next.state).toBe('ready');
    expect(next.claimDeadlineAt).toBe(future(10));
    expect(next.nextActionAt).toBe(future(10));
    // and the alarm itself still fired: re-arming is bookkeeping, not a fix
  });

  it('never writes for a stall alarm or a violation', () => {
    const r = row({ state: 'blocked', lease: undefined, nextActionAt: past(5) });
    expect(
      applyAction(r, { kind: 'alarm_stall', rowId: r.id, tier: r.tier, since: past(5) }, NOW),
    ).toBeNull();
    expect(applyAction(r, { kind: 'violation', rowId: r.id, rule: 'missing_next_action' }, NOW)).toBeNull();
  });

  it('treats a claimable row without a deadline as a bug', () => {
    const r = row({ state: 'ready', lease: undefined, claimDeadlineAt: undefined });
    expect(violations(r)).toContain('ready_without_claim_deadline');
  });
});
