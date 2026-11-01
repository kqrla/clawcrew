import { describe, expect, it } from 'vitest';
import { WorkRow } from '../src/domain/liveness.js';
import { MetricObservation, Seat, claimWork, progress, replan } from '../src/domain/custody.js';

/**
 * docs/27 §11. progress used to be the one control a seat could spend for
 * itself. these are the tests that say it no longer can.
 */
const NOW = '2026-11-01T12:00:00.000Z';
const future = (m: number) => new Date(Date.parse(NOW) + m * 60_000).toISOString();
const past = (m: number) => new Date(Date.parse(NOW) - m * 60_000).toISOString();

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
    brief: 'raise weekly retention to 42% by editing the onboarding flow',
    ...over,
  };
}

const ok = (r: ReturnType<typeof claimWork>): WorkRow => {
  if (!r.ok) throw new Error(`expected success, got ${r.reason}`);
  return r.row;
};

const reading = (over: Partial<MetricObservation> = {}): MetricObservation => ({
  objective: 'obj.retention.v2',
  source: 'sql:select retention from metrics',
  value: 41,
  computedAt: future(1),
  runBy: 'auditor.weekly',
  ...over,
});

const leased = () => ok(claimWork(ready(), SEAT, NOW, { ttlMs: 600_000 }));

describe('progress needs a measurement', () => {
  it('refuses a progress claim with no evidence at all', () => {
    expect(progress(leased(), 'seat.a', NOW)).toEqual({
      ok: false,
      reason: 'progress_requires_metric_evidence',
    });
  });

  it('refuses evidence measured against a different objective', () => {
    const r = progress(leased(), 'seat.a', NOW, {
      observation: reading({ objective: 'obj.other.v1' }),
    });
    expect(r).toEqual({ ok: false, reason: 'evidence_for_another_objective' });
  });

  it('refuses a reading older than the last progress', () => {
    const held = leased();
    const first = ok(progress(held, 'seat.a', NOW, { observation: reading({ value: 41 }) }));
    const second = progress(first, 'seat.a', NOW, {
      observation: reading({ value: 42, computedAt: past(1) }),
    });
    expect(second).toEqual({ ok: false, reason: 'evidence_predates_last_progress' });
  });

  it('refuses a resubmitted number, however new the timestamp', () => {
    const first = ok(progress(leased(), 'seat.a', NOW, { observation: reading({ value: 41 }) }));
    const again = progress(first, 'seat.a', NOW, {
      observation: reading({ value: 41, computedAt: future(5) }),
    });
    expect(again).toEqual({ ok: false, reason: 'metric_did_not_move' });
  });

  it('refuses a seat measuring its own work', () => {
    const r = progress(leased(), 'seat.a', NOW, {
      observation: reading({ runBy: 'seat.a' }),
    });
    expect(r).toEqual({ ok: false, reason: 'self_measured_progress' });
  });

  it('allows a self-measured reading only where the objective says so', () => {
    const r = progress(leased(), 'seat.a', NOW, {
      observation: reading({ runBy: 'seat.a' }),
      allowSelfMeasured: true,
    });
    expect(r.ok).toBe(true);
  });

  it('records the reading it accepted, so the next one has to beat it', () => {
    const worked = ok(progress(leased(), 'seat.a', NOW, { observation: reading({ value: 41 }) }));
    expect(worked.metricValueAt).toBe(41);
    expect(worked.metricObservedAt).toBe(future(1));
    expect(worked.progressVersion).toBe(1);
  });

  it('refuses a non-finite value from a broken query', () => {
    const r = progress(leased(), 'seat.a', NOW, {
      observation: reading({ value: Number.NaN }),
    });
    expect(r).toEqual({ ok: false, reason: 'evidence_value_invalid' });
  });
});

describe('replan', () => {
  const blocked = (): WorkRow =>
    ready({ state: 'blocked', attempts: 3, blockedReason: 'attempts_exhausted', claimDeadlineAt: undefined });

  it('only the tier that owns the row may rewrite its brief', () => {
    expect(replan(blocked(), 't.product.pod.a', 'a new brief', NOW)).toEqual({
      ok: false,
      reason: 'replan_by_non_owner',
    });
  });

  it('cannot rewrite a brief under a holder that is working', () => {
    expect(replan(leased(), 't.root', 'a new brief', NOW)).toEqual({
      ok: false,
      reason: 'cannot_replan_a_held_row',
    });
  });

  it('refuses an empty or identical brief', () => {
    expect(replan(blocked(), 't.root', '   ', NOW)).toEqual({ ok: false, reason: 'brief_required' });
    expect(replan(blocked(), 't.root', blocked().brief!, NOW)).toEqual({
      ok: false,
      reason: 'brief_unchanged',
    });
  });

  it('spends the attempts, because the next runner is answering a new question', () => {
    const r = ok(replan(blocked(), 't.root', 'a narrower brief', NOW, { objectiveVersion: 3 }));
    expect(r.state).toBe('ready');
    expect(r.attempts).toBe(0);
    expect(r.blockedReason).toBeUndefined();
    expect(r.objectiveVersion).toBe(3);
    expect(r.replannedBy).toBe('t.root');
    expect(r.replannedAt).toBe(NOW);
    expect(r.claimDeadlineAt).toBe(future(15));
  });

  it('leaves the metric where it was, so a rewrite cannot launder a stale number', () => {
    const withMetric = { ...blocked(), metricValueAt: 41, metricObservedAt: future(1) };
    const r = ok(replan(withMetric, 't.root', 'a narrower brief', NOW));
    expect(r.metricValueAt).toBe(41);
  });

  it('does not resurrect a finished row', () => {
    const done = ready({ state: 'done', evidenceRef: 'artifact://sha256/abc' });
    expect(replan(done, 't.root', 'a new brief', NOW)).toEqual({
      ok: false,
      reason: 'row_terminal:done',
    });
  });
});

describe('claim replay', () => {
  it('answers a repeated claim with the row it already produced', () => {
    const first = ok(claimWork(ready(), SEAT, NOW, { ttlMs: 600_000, idempotencyKey: 'k1' }));
    const again = claimWork(first, SEAT, NOW, {
      ttlMs: 600_000,
      idempotencyKey: 'k1',
      inputFingerprint: 'brief:v1',
    });
    // the first claim recorded no fingerprint, so the replay is the same request
    expect(again.ok).toBe(true);
    if (again.ok) expect(again.row.lease!.holder).toBe('seat.a');
  });

  it('refuses a replay that carries different input under the same key', () => {
    const first = ok(
      claimWork(ready(), SEAT, NOW, {
        ttlMs: 600_000,
        idempotencyKey: 'k1',
        inputFingerprint: 'brief:v1',
      }),
    );
    expect(
      claimWork(first, SEAT, NOW, {
        ttlMs: 600_000,
        idempotencyKey: 'k1',
        inputFingerprint: 'brief:v2',
      }),
    ).toEqual({ ok: false, reason: 'replay_with_changed_input' });
  });

  it('does not mistake a fresh key for a replay', () => {
    const first = ok(claimWork(ready(), SEAT, NOW, { ttlMs: 600_000, idempotencyKey: 'k1' }));
    expect(claimWork(first, SEAT, NOW, { ttlMs: 600_000, idempotencyKey: 'k2' })).toEqual({
      ok: false,
      reason: 'not_ready:leased',
    });
  });
});
