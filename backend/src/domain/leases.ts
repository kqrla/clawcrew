// a calendar records an intention. a lease records a claim, and a claim can expire.
// liveness therefore never depends on anyone noticing that an agent died.
export type Responsibility = 'oncall' | 'batch' | 'release' | 'review' | 'intake' | 'audit';
export type LeaseState = 'held' | 'released' | 'expired' | 'revoked';

export interface Lease {
  id: string;
  tier: string;
  responsibility: Responsibility;
  holder: string;
  acquiredAt: string;
  expiresAt: string;
  heartbeatMs: number;
  maxRenewals: number;
  renewals: number;
  state: LeaseState;
  lastHeartbeat: string;
}

const ms = (iso: string) => Date.parse(iso);

export function isExpired(lease: Lease, now: string): boolean {
  if (lease.state !== 'held') return false;
  return ms(now) > ms(lease.expiresAt);
}

/**
 * heartbeat staleness is separate from expiry on purpose. a seat can hold a
 * valid lease and already be dead; that is the case that produces a silent gap.
 */
export function heartbeatStatus(lease: Lease, now: string): 'ok' | 'stale' | 'dead' {
  const age = ms(now) - ms(lease.lastHeartbeat);
  if (age > lease.heartbeatMs * 2) return 'dead';
  if (age > lease.heartbeatMs) return 'stale';
  return 'ok';
}

export function renew(lease: Lease, now: string, ttlMs: number): Lease {
  if (lease.state !== 'held') throw new Error(`cannot renew a ${lease.state} lease`);
  if (lease.renewals >= lease.maxRenewals) throw new Error('renewal limit reached: rotation required');
  return {
    ...lease,
    renewals: lease.renewals + 1,
    lastHeartbeat: now,
    expiresAt: new Date(ms(now) + ttlMs).toISOString(),
  };
}

export type EscalationKind =
  | 'page_next_holder'
  | 'page_manager'
  | 'page_parent_manager'
  | 'human_approval_card'
  | 'suspend_responsibility';

export interface EscalationStep {
  kind: EscalationKind;
  afterMs: number;
  note: string;
}

/** the ladder from the spec, as data so it can be tested and tuned in one place. */
export const ESCALATION_LADDER: EscalationStep[] = [
  { kind: 'page_next_holder', afterMs: 0, note: 'immediate' },
  { kind: 'page_manager', afterMs: 10 * 60_000, note: 'tier manager' },
  { kind: 'page_parent_manager', afterMs: 30 * 60_000, note: 'parent manager' },
  { kind: 'human_approval_card', afterMs: 60 * 60_000, note: 'a2 card to a human' },
  { kind: 'suspend_responsibility', afterMs: 4 * 60 * 60_000, note: 'surfaces go read-only' },
];

export function escalationFor(lease: Lease, now: string): EscalationStep | null {
  if (!isExpired(lease, now)) return null;
  const elapsed = ms(now) - ms(lease.expiresAt);
  let current: EscalationStep | null = null;
  for (const step of ESCALATION_LADDER) {
    if (elapsed >= step.afterMs) current = step;
  }
  return current;
}

/**
 * a responsibility with no live holder must not keep accepting work.
 * suspending is the safe default and it is loud, which is the point.
 */
export function shouldSuspend(activeLeases: Lease[], now: string): boolean {
  const live = activeLeases.filter((l) => l.state === 'held' && !isExpired(l, now));
  return live.length === 0;
}
