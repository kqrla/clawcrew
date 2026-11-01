import { describe, expect, it } from 'vitest';
import { WorkRow, sweep } from '../src/domain/liveness.js';
import { MetricObservation, Seat, abandon, claimWork, complete, progress, renew } from '../src/domain/custody.js';

const NOW = '2026-11-01T12:00:00.000Z';
const past = (m: number) => new Date(Date.parse(NOW) - m * 60_000).toISOString();
const future = (m: number) => new Date(Date.parse(NOW) + m * 60_000).toISOString();

const SEAT: Seat = { id: 'seat.a', slice: ['repo.orchart'] };

function ready(over: Partial<WorkRow> = {}): WorkRow {
  return {
    id: 'w1',
    state: 'ready',
    tier: 't.root',
    objectiveRef: 'obj.retention.v2',
    surfaces: ['repo.orchart'],
    nextActionAt: future(10),
    claimDeadlineAt: future(10),
    progressVersion: 0,
    attempts: 0,
    maxAttempts: 3,
    ...over,
  };
}

/** a reading from the objective's own source, taken by somebody who is not the seat */
const reading = (value: number, at = NOW, runBy = 'auditor.weekly'): MetricObservation => ({
  objective: 'obj.retention.v2',
  source: 'sql:select retention from metrics',
  value,
  computedAt: at,
  runBy,
});

const ok = (r: ReturnType<typeof claimWork>): WorkRow => {
  if (!r.ok) throw new Error(`expected success, got ${r.reason}`);
  return r.row;
};

describe('claiming work', () => {
  it('gives one holder a lease that carries its own expiry', () => {
    const row = ok(claimWork(ready(), SEAT, NOW, { ttlMs: 600_000 }));
    expect(row.state).toBe('leased');
    expect(row.lease).toEqual({ holder: 'seat.a', expiresAt: future(10), renewals: 0 });
    expect(row.claimDeadlineAt).toBeUndefined();
    // the expiry is the row's own deadline, so a dead holder needs no reaper
    expect(row.nextActionAt).toBe(future(10));
  });

  it('refuses when the slice does not cover the surfaces', () => {
    const r = claimWork(ready({ surfaces: ['repo.orchart', 'vendor.billing'] }), SEAT, NOW);
    expect(r).toEqual({ ok: false, reason: 'slice_missing:vendor.billing' });
  });

  it('refuses a late claim and a row that is already leased', () => {
    expect(claimWork(ready({ claimDeadlineAt: past(1) }), SEAT, NOW)).toEqual({
      ok: false,
      reason: 'claim_deadline_passed',
    });
    const leased = ok(claimWork(ready(), SEAT, NOW));
    expect(claimWork(leased, SEAT, NOW)).toEqual({ ok: false, reason: 'not_ready:leased' });
  });
});

describe('holding work', () => {
  it('extends custody without credit against the spin counter', () => {
    const leased = ok(claimWork(ready(), SEAT, NOW, { ttlMs: 600_000 }));
    const renewed = ok(renew(leased, 'seat.a', future(1), { ttlMs: 600_000 }));
    expect(renewed.lease!.renewals).toBe(1);
    expect(renewed.lease!.expiresAt).toBe(future(11));
  });

  it('resets the counter when something was actually produced', () => {
    const leased = ok(claimWork(ready(), SEAT, NOW, { ttlMs: 600_000 }));
    const spun = ok(renew(ok(renew(leased, 'seat.a', NOW)), 'seat.a', NOW));
    expect(spun.lease!.renewals).toBe(2);

    const worked = ok(progress(spun, 'seat.a', NOW, { observation: reading(41) }));
    expect(worked.progressVersion).toBe(1);
    expect(worked.progressAt).toBe(NOW);
    expect(worked.lease!.renewals).toBe(0);
  });

  it('keeps a producing holder out of the spinning detector', () => {
    let row = ok(claimWork(ready(), SEAT, NOW, { ttlMs: 60_000 }));
    // renew twice, then produce, three times over: alive and working
    for (let i = 0; i < 3; i++) {
      row = ok(renew(row, 'seat.a', NOW));
      row = ok(renew(row, 'seat.a', NOW));
      row = ok(progress(row, 'seat.a', NOW, { observation: reading(42 + i) }));
    }
    expect(sweep([row], { now: NOW })).toEqual([]);
  });

  it('refuses the wrong holder and a lease that already expired', () => {
    const leased = ok(claimWork(ready(), SEAT, NOW, { ttlMs: 60_000 }));
    expect(renew(leased, 'seat.b', NOW)).toEqual({ ok: false, reason: 'not_holder' });
    expect(progress(leased, 'seat.a', future(5))).toEqual({ ok: false, reason: 'lease_expired' });
  });
});

describe('finishing work', () => {
  it('accepts a reference and refuses prose', () => {
    const leased = ok(claimWork(ready(), SEAT, NOW));
    expect(complete(leased, 'seat.a', 'shipped it', NOW)).toEqual({
      ok: false,
      reason: 'evidence_must_be_a_reference',
    });

    const done = ok(complete(leased, 'seat.a', 'artifact://sha256:ab', NOW));
    expect(done.state).toBe('done');
    expect(done.evidenceRef).toBe('artifact://sha256:ab');
    expect(done.lease).toBeUndefined();
    expect(done.nextActionAt).toBeUndefined();
    // a closed row is clean: no violations, nothing for the sweep to do
    expect(sweep([done], { now: NOW })).toEqual([]);
  });

  it('gives work back as an attempt spent, not as a break', () => {
    const leased = ok(claimWork(ready(), SEAT, NOW));
    const back = ok(abandon(leased, 'seat.a', 'blocked_on:vendor', NOW));

    expect(back.state).toBe('ready');
    expect(back.attempts).toBe(1);
    expect(back.claimDeadlineAt).toBe(future(15));
    expect(abandon(leased, 'seat.a', '  ', NOW)).toEqual({ ok: false, reason: 'reason_required' });
  });

  it('blocks instead of re-arming when the last attempt is handed back', () => {
    const leased = ok(claimWork(ready({ attempts: 2, maxAttempts: 3 }), SEAT, NOW));
    const back = ok(abandon(leased, 'seat.a', 'blocked_on:vendor', NOW));

    expect(back.state).toBe('blocked');
    expect(back.blockedReason).toBe('blocked_on:vendor');
    expect(back.claimDeadlineAt).toBeUndefined();
    expect(sweep([back], { now: NOW })).toEqual([]);
  });
});
