/**
 * the delivery state machine. at-least-once with an idempotent receiver, never
 * exactly-once. see docs/22.
 */
export type RelayState = 'queued' | 'leased' | 'delivered' | 'dead' | 'expired';

export interface RelayMessage {
  id: string;
  from: string;
  to: string;
  crossing: string;
  kind: string;
  dedupeKey: string;
  payloadRef: string;
  /** monotonic per (from,to,crossing); the only ordering guarantee */
  seq: number;
  priority: 'critical' | 'normal' | 'background';
  state: RelayState;
  attempts: number;
  maxAttempts: number;
  createdAt: string;
  expiresAt: string;
  nextAttemptAt: string;
  lockedUntil?: string;
  holder?: string;
  /** tiers already visited, for loop detection */
  path: string[];
  ackedAt?: string;
  deadReason?: string;
}

export interface BackoffConfig {
  baseMs: number;
  capMs: number;
  maxAttempts: number;
}

export const DEFAULT_BACKOFF: BackoffConfig = {
  baseMs: 2000,
  capMs: 15 * 60 * 1000,
  maxAttempts: 8,
};

function hash32(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** deterministic jitter in [0.5, 1.5) so retries spread without breaking tests */
export function jitterFactor(id: string, attempt: number): number {
  return 0.5 + (hash32(`${id}:${attempt}`) % 1000) / 1000;
}

export function backoffMs(id: string, attempt: number, cfg: BackoffConfig = DEFAULT_BACKOFF): number {
  const raw = cfg.baseMs * Math.pow(2, Math.max(0, attempt));
  return Math.round(Math.min(cfg.capMs, raw) * jitterFactor(id, attempt));
}

export function isVisible(m: RelayMessage, now: string): boolean {
  if (m.state !== 'queued') return false;
  return Date.parse(m.nextAttemptAt) <= Date.parse(now);
}

export function lease(m: RelayMessage, holder: string, now: string, ttlMs = 60_000): RelayMessage {
  if (m.state !== 'queued') throw new Error(`cannot_lease_from:${m.state}`);
  return {
    ...m,
    state: 'leased',
    holder,
    lockedUntil: new Date(Date.parse(now) + ttlMs).toISOString(),
  };
}

/** ack is written after the receiver persists, never after it reads */
export function ack(m: RelayMessage, now: string): RelayMessage {
  return { ...m, state: 'delivered', ackedAt: now, lockedUntil: undefined, holder: undefined };
}

export function dead(m: RelayMessage, reason: string): RelayMessage {
  return { ...m, state: 'dead', deadReason: reason, lockedUntil: undefined, holder: undefined };
}

/**
 * retries stop before the ttl. retrying into an expired envelope spends budget
 * to deliver something the receiver must reject on arrival.
 */
export function nack(
  m: RelayMessage,
  now: string,
  cfg: BackoffConfig = DEFAULT_BACKOFF,
): RelayMessage {
  const attempts = m.attempts + 1;
  if (attempts >= Math.min(m.maxAttempts, cfg.maxAttempts)) {
    return dead(m, 'attempts_exhausted');
  }
  const delay = backoffMs(m.id, attempts, cfg);
  const nextAttemptAt = new Date(Date.parse(now) + delay).toISOString();
  if (Date.parse(nextAttemptAt) >= Date.parse(m.expiresAt)) {
    return dead(m, 'ttl_would_expire_before_retry');
  }
  return {
    ...m,
    state: 'queued',
    attempts,
    nextAttemptAt,
    lockedUntil: undefined,
    holder: undefined,
  };
}

/** a worker died mid-delivery. the lease expires and the message returns by itself. */
export function reclaim(m: RelayMessage, now: string, cfg: BackoffConfig = DEFAULT_BACKOFF): RelayMessage {
  if (m.state !== 'leased') return m;
  if (!m.lockedUntil || Date.parse(m.lockedUntil) > Date.parse(now)) return m;
  const attempts = m.attempts + 1;
  if (attempts >= Math.min(m.maxAttempts, cfg.maxAttempts)) {
    return dead(m, 'lease_expired_repeatedly');
  }
  return {
    ...m,
    state: 'queued',
    attempts,
    nextAttemptAt: now,
    lockedUntil: undefined,
    holder: undefined,
  };
}

export function expireIfPast(m: RelayMessage, now: string): RelayMessage {
  if (m.state === 'delivered' || m.state === 'dead' || m.state === 'expired') return m;
  if (Date.parse(now) < Date.parse(m.expiresAt)) return m;
  return { ...m, state: 'expired', deadReason: 'ttl_expired', lockedUntil: undefined, holder: undefined };
}

export interface RouteCheck {
  ok: boolean;
  reason?: 'loop_detected' | 'hops_exceeded';
}

/** three hops reaches a sibling team through one coordinator and back */
export function checkRoute(
  m: Pick<RelayMessage, 'from' | 'to' | 'path'>,
  maxHops = 3,
): RouteCheck {
  if (m.path.includes(m.to)) return { ok: false, reason: 'loop_detected' };
  if (m.path.length >= maxHops) return { ok: false, reason: 'hops_exceeded' };
  return { ok: true };
}

export function forward(m: RelayMessage, to: string, now: string): RelayMessage {
  const check = checkRoute({ from: m.from, to, path: m.path });
  if (!check.ok) throw new Error(check.reason);
  return {
    ...m,
    to,
    path: [...m.path, m.from],
    state: 'queued',
    nextAttemptAt: now,
    lockedUntil: undefined,
    holder: undefined,
  };
}

export function receiptFor(m: RelayMessage, now: string): RelayMessage {
  if (m.kind === 'receipt') throw new Error('receipts_do_not_receipt');
  return {
    id: `${m.id}:receipt`,
    from: m.to,
    to: m.from,
    crossing: `reverse_of:${m.crossing}`,
    kind: 'receipt',
    dedupeKey: `receipt:${m.dedupeKey}`,
    payloadRef: `state://relay/${m.id}`,
    seq: 0,
    priority: 'background',
    state: 'queued',
    attempts: 0,
    maxAttempts: m.maxAttempts,
    createdAt: now,
    expiresAt: m.expiresAt,
    nextAttemptAt: now,
    path: [],
  };
}
