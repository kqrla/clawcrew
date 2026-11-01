import { describe, expect, it } from 'vitest';
import {
  RelayMessage,
  ack,
  backoffMs,
  checkRoute,
  dead,
  expireIfPast,
  forward,
  isVisible,
  jitterFactor,
  lease,
  nack,
  receiptFor,
  reclaim,
} from '../src/domain/relay-queue.js';

const NOW = '2026-11-01T00:00:00.000Z';

function msg(over: Partial<RelayMessage> = {}): RelayMessage {
  return {
    id: 'm1',
    from: 'brand.social',
    to: 'eng.product',
    crossing: 'brand-to-eng',
    kind: 'proposal',
    dedupeKey: 'd1',
    payloadRef: 'artifact://sha256:abc',
    seq: 1,
    priority: 'normal',
    state: 'queued',
    attempts: 0,
    maxAttempts: 8,
    createdAt: NOW,
    expiresAt: '2026-11-02T00:00:00.000Z',
    nextAttemptAt: NOW,
    path: [],
    ...over,
  };
}

describe('relay delivery', () => {
  it('leases then acks', () => {
    const leased = lease(msg(), 'worker-1', NOW, 60_000);
    expect(leased.state).toBe('leased');
    expect(leased.holder).toBe('worker-1');
    expect(leased.lockedUntil).toBe('2026-11-01T00:01:00.000Z');

    const done = ack(leased, NOW);
    expect(done.state).toBe('delivered');
    expect(done.ackedAt).toBe(NOW);
    expect(done.holder).toBeUndefined();
  });

  it('refuses to lease something that is not queued', () => {
    expect(() => lease(ack(msg(), NOW), 'w', NOW)).toThrow('cannot_lease_from:delivered');
  });

  it('nack returns it to the queue with backoff', () => {
    const nacked = nack(lease(msg(), 'w', NOW), NOW);
    expect(nacked.state).toBe('queued');
    expect(nacked.attempts).toBe(1);
    expect(Date.parse(nacked.nextAttemptAt)).toBeGreaterThan(Date.parse(NOW));
    expect(nacked.holder).toBeUndefined();
  });

  it('dies when attempts are exhausted', () => {
    const nacked = nack(msg({ attempts: 7 }), NOW);
    expect(nacked.state).toBe('dead');
    expect(nacked.deadReason).toBe('attempts_exhausted');
  });

  it('dies rather than retrying past its ttl', () => {
    const nacked = nack(msg({ expiresAt: '2026-11-01T00:00:02.000Z' }), NOW);
    expect(nacked.state).toBe('dead');
    expect(nacked.deadReason).toBe('ttl_would_expire_before_retry');
  });

  it('reclaims a lease whose holder died', () => {
    const leased = lease(msg(), 'w', NOW, 1000);
    expect(reclaim(leased, NOW)).toBe(leased);

    const reclaimed = reclaim(leased, '2026-11-01T00:00:02.000Z');
    expect(reclaimed.state).toBe('queued');
    expect(reclaimed.attempts).toBe(1);
    expect(reclaimed.holder).toBeUndefined();
  });

  it('expires past its ttl', () => {
    const e = expireIfPast(msg(), '2026-11-03T00:00:00.000Z');
    expect(e.state).toBe('expired');
    expect(expireIfPast(ack(msg(), NOW), '2026-11-03T00:00:00.000Z').state).toBe('delivered');
  });

  it('visibility is queue state plus due time', () => {
    expect(isVisible(msg(), NOW)).toBe(true);
    expect(isVisible(msg({ nextAttemptAt: '2026-11-01T01:00:00.000Z' }), NOW)).toBe(false);
    expect(isVisible(msg({ state: 'leased' }), NOW)).toBe(false);
  });

  it('bounds hops and detects loops', () => {
    expect(checkRoute({ from: 'a', to: 'b', path: [] })).toEqual({ ok: true });
    expect(checkRoute({ from: 'a', to: 'b', path: ['a', 'b'] })).toEqual({
      ok: false,
      reason: 'loop_detected',
    });
    expect(checkRoute({ from: 'a', to: 'd', path: ['a', 'b', 'c'] })).toEqual({
      ok: false,
      reason: 'hops_exceeded',
    });
  });

  it('forwarding records the path', () => {
    const m = forward(msg(), 'eng', NOW);
    expect(m.to).toBe('eng');
    expect(m.path).toEqual(['brand.social']);
    expect(m.state).toBe('queued');
  });

  it('a receipt is an envelope, and receipts do not receipt', () => {
    const r = receiptFor(msg(), NOW);
    expect(r.from).toBe('eng.product');
    expect(r.to).toBe('brand.social');
    expect(r.kind).toBe('receipt');
    expect(r.priority).toBe('background');
    expect(() => receiptFor(r, NOW)).toThrow('receipts_do_not_receipt');
  });

  it('backoff is bounded and deterministic', () => {
    const a = backoffMs('m1', 3);
    expect(a).toBe(backoffMs('m1', 3));
    expect(a).toBeLessThanOrEqual(15 * 60 * 1000 * 1.5);
    expect(jitterFactor('m1', 1)).toBeGreaterThanOrEqual(0.5);
    expect(jitterFactor('m1', 1)).toBeLessThan(1.5);
  });

  it('dead carries a reason', () => {
    expect(dead(msg(), 'manual').deadReason).toBe('manual');
  });
});
