import { describe, expect, it } from 'vitest';
import {
  ESCALATION_LADDER,
  Lease,
  escalationFor,
  heartbeatStatus,
  isExpired,
  renew,
  shouldSuspend,
} from '../src/domain/leases.js';

const lease: Lease = {
  id: 'lease.1',
  tier: 'eng.platform.infra',
  responsibility: 'oncall',
  holder: 'seat.infra',
  acquiredAt: '2026-11-01T08:00:00Z',
  expiresAt: '2026-11-01T16:00:00Z',
  heartbeatMs: 15 * 60_000,
  maxRenewals: 2,
  renewals: 0,
  state: 'held',
  lastHeartbeat: '2026-11-01T15:45:00Z',
};

describe('leases', () => {
  it('expires on time and not before', () => {
    expect(isExpired(lease, '2026-11-01T15:59:00Z')).toBe(false);
    expect(isExpired(lease, '2026-11-01T16:01:00Z')).toBe(true);
  });

  it('separates a stale heartbeat from a valid lease', () => {
    expect(heartbeatStatus(lease, '2026-11-01T15:50:00Z')).toBe('ok');
    expect(heartbeatStatus(lease, '2026-11-01T16:05:00Z')).toBe('stale');
    expect(heartbeatStatus(lease, '2026-11-01T16:20:00Z')).toBe('dead');
  });

  it('walks the escalation ladder as time passes', () => {
    const at = (iso: string) => escalationFor(lease, iso)?.kind;
    expect(at('2026-11-01T16:00:30Z')).toBe('page_next_holder');
    expect(at('2026-11-01T16:11:00Z')).toBe('page_manager');
    expect(at('2026-11-01T16:31:00Z')).toBe('page_parent_manager');
    expect(at('2026-11-01T17:01:00Z')).toBe('human_approval_card');
    expect(at('2026-11-01T20:01:00Z')).toBe('suspend_responsibility');
  });

  it('does not escalate a live lease', () => {
    expect(escalationFor(lease, '2026-11-01T15:00:00Z')).toBeNull();
  });

  it('bounds renewal so a seat has to rotate', () => {
    const once = renew(lease, '2026-11-01T15:50:00Z', 3600_000);
    const twice = renew(once, '2026-11-01T16:30:00Z', 3600_000);
    expect(() => renew(twice, '2026-11-01T17:30:00Z', 3600_000)).toThrow(/rotation/);
  });

  it('suspends a responsibility with no live holder', () => {
    expect(shouldSuspend([], '2026-11-01T12:00:00Z')).toBe(true);
    expect(shouldSuspend([lease], '2026-11-01T12:00:00Z')).toBe(false);
  });

  it('keeps the ladder ordered', () => {
    const delays = ESCALATION_LADDER.map((s) => s.afterMs);
    expect([...delays].sort((a, b) => a - b)).toEqual(delays);
  });
});
