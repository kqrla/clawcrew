import { describe, expect, it } from 'vitest';
import { GENESIS, append, canonical, fromJsonl, toJsonl, verifyChain } from '../src/domain/events.js';

describe('event log', () => {
  it('canonicalises regardless of key order', () => {
    expect(canonical({ b: 1, a: { d: 2, c: 3 } })).toBe(canonical({ a: { c: 3, d: 2 }, b: 1 }));
  });

  it('chains events with a stable hash', () => {
    const e1 = append(null, { type: 'tier.created', id: 'eng' }, '2026-11-01T00:00:00Z');
    const e2 = append(e1, { type: 'seat.hired', id: 'seat.ci' }, '2026-11-01T00:01:00Z');
    expect(e1.prevHash).toBe(GENESIS);
    expect(e2.prevHash).toBe(e1.hash);
    expect(verifyChain([e1, e2])).toEqual({ ok: true });
  });

  it('detects a rewritten payload', () => {
    const e1 = append(null, { type: 'a', amount: 10 }, '2026-11-01T00:00:00Z');
    const e2 = append(e1, { type: 'b' }, '2026-11-01T00:01:00Z');
    const tampered = { ...e1, payload: { type: 'a', amount: 100 } };
    const r = verifyChain([tampered, e2]);
    expect(r.ok).toBe(false);
    expect(r.brokenAt).toBe(1);
    expect(r.reason).toBe('hash_mismatch');
  });

  it('detects a dropped event', () => {
    const e1 = append(null, { type: 'a' }, '2026-11-01T00:00:00Z');
    const e2 = append(e1, { type: 'b' }, '2026-11-01T00:01:00Z');
    const e3 = append(e2, { type: 'c' }, '2026-11-01T00:02:00Z');
    expect(verifyChain([e1, e3])).toMatchObject({ ok: false, brokenAt: 3, reason: 'sequence_gap' });
  });

  it('round-trips through jsonl, the export format', () => {
    const e1 = append(null, { type: 'a' }, '2026-11-01T00:00:00Z');
    const e2 = append(e1, { type: 'b' }, '2026-11-01T00:01:00Z');
    expect(verifyChain(fromJsonl(toJsonl([e1, e2]))).ok).toBe(true);
  });
});
