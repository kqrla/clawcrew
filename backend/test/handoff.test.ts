import { describe, expect, it } from 'vitest';
import {
  Handoff,
  expire,
  isOverdue,
  openHandoffs,
  orphanPartitions,
  transition,
  validateHandoff,
} from '../src/domain/handoff.js';

const h: Handoff = {
  id: 'hof.1',
  from: 'seat.ci',
  to: 'seat.qa',
  precondition: 'deploy.staging.status == green',
  payloadRef: 'artifact://builds/1f2a',
  acceptanceRequired: true,
  timeoutMs: 30 * 60_000,
  offeredAt: '2026-11-01T12:00:00Z',
  state: 'offered',
};

describe('handoffs', () => {
  it('refuses prose as a payload', () => {
    expect(validateHandoff({ ...h, payloadRef: 'the build looks fine' })).toContain(
      'payload_ref_must_be_a_reference',
    );
    expect(validateHandoff(h)).toEqual([]);
  });

  it('accepts only when the precondition holds', () => {
    expect(() => transition(h, { type: 'accept', actor: 'seat.qa', preconditionHeld: false }, '2026-11-01T12:05:00Z')).toThrow(
      /precondition/,
    );
    expect(transition(h, { type: 'accept', actor: 'seat.qa', preconditionHeld: true }, '2026-11-01T12:05:00Z').state).toBe(
      'accepted',
    );
  });

  it('only the addressee may accept', () => {
    expect(() => transition(h, { type: 'accept', actor: 'seat.ci', preconditionHeld: true }, '2026-11-01T12:05:00Z')).toThrow(
      /addressee/,
    );
  });

  it('rejection carries a reason back to the sender', () => {
    const r = transition(h, { type: 'reject', actor: 'seat.qa', reason: 'smoke test failing' }, '2026-11-01T12:05:00Z');
    expect(r.state).toBe('rejected');
    expect(r.rejectionReason).toBe('smoke test failing');
  });

  it('turns a failed transport into a visible row, not an absence', () => {
    expect(transition(h, { type: 'transport_failed', reason: 'seat retired' }, '2026-11-01T12:05:00Z').state).toBe(
      'undelivered',
    );
  });

  it('expires and cannot be accepted afterwards', () => {
    expect(isOverdue(h, '2026-11-01T12:31:00Z')).toBe(true);
    expect(expire(h, '2026-11-01T12:31:00Z').state).toBe('expired');
    expect(() => transition(h, { type: 'accept', actor: 'seat.qa', preconditionHeld: true }, '2026-11-01T12:31:00Z')).toThrow(
      /timed out/,
    );
  });

  it('surfaces overdue offers', () => {
    expect(openHandoffs([h], '2026-11-01T13:00:00Z')).toHaveLength(1);
  });

  it('flags partitions nobody owns', () => {
    expect(orphanPartitions(['eu', 'us', 'apac'], { eu: 'seat.a', us: 'seat.b', apac: null })).toEqual(['apac']);
  });
});
