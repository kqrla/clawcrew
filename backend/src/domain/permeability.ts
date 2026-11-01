/**
 * permeability: what may cross a wall, in which direction, how often.
 * declared in committed config, compiled to something enforceable, never
 * inherited. see docs/23.
 */
export type RevokeMode = 'drain' | 'cut';

export type EnvelopeKindName = 'finding' | 'proposal' | 'request' | 'signal' | 'artifact_ref' | 'receipt';

export interface CrossingDecl {
  id: string;
  from: string;
  to: string;
  kinds: EnvelopeKindName[];
  maxPerHour: number;
  maxBytes?: number;
  expiresAt: string;
  authorizedBy: string;
  reason: string;
  revokeMode?: RevokeMode;
  enabled?: boolean;
}

export interface Crossing extends Required<Omit<CrossingDecl, 'maxBytes'>> {
  maxBytes?: number;
  configHash: string;
}

export interface CompileProblem {
  id: string;
  problem: string;
}

export interface CompileOptions {
  tiers: string[];
  now: string;
  configHash: string;
}

export function compileCrossings(
  decls: CrossingDecl[],
  opts: CompileOptions,
): { crossings: Crossing[]; problems: CompileProblem[] } {
  const problems: CompileProblem[] = [];
  const seen = new Set<string>();
  const crossings: Crossing[] = [];

  for (const d of decls) {
    const bad: string[] = [];
    if (seen.has(d.id)) bad.push('duplicate_id');
    seen.add(d.id);
    if (!opts.tiers.includes(d.from)) bad.push(`unknown_from:${d.from}`);
    if (!opts.tiers.includes(d.to)) bad.push(`unknown_to:${d.to}`);
    if (d.from === d.to) bad.push('self_crossing');
    if (d.kinds.length === 0) bad.push('no_kinds');
    if (!(d.maxPerHour > 0)) bad.push('no_rate');
    if (!d.expiresAt || Number.isNaN(Date.parse(d.expiresAt))) bad.push('no_expiry');
    if (d.reason.trim().length === 0) bad.push('no_reason');
    if (bad.length > 0) {
      problems.push({ id: d.id, problem: bad.join(',') });
      continue;
    }
    if (Date.parse(d.expiresAt) <= Date.parse(opts.now)) {
      problems.push({ id: d.id, problem: 'already_expired' });
      continue;
    }
    crossings.push({
      ...d,
      revokeMode: d.revokeMode ?? 'drain',
      enabled: d.enabled ?? true,
      configHash: opts.configHash,
    });
  }
  return { crossings, problems };
}

export type ResolveReason =
  | 'no_crossing'
  | 'crossing_disabled'
  | 'kind_not_allowed'
  | 'crossing_expired';

export interface ResolveQuery {
  from: string;
  to: string;
  kind: EnvelopeKindName;
  now: string;
}

export type Resolved =
  | { ok: true; crossing: Crossing }
  | { ok: false; reason: ResolveReason };

/**
 * default deny. when several doors match, the narrower kind set governs.
 * two crossings are never unioned: union is how permission systems rot.
 */
export function resolveCrossing(crossings: Crossing[], q: ResolveQuery): Resolved {
  const pair = crossings.filter((c) => c.from === q.from && c.to === q.to);
  if (pair.length === 0) return { ok: false, reason: 'no_crossing' };

  const enabled = pair.filter((c) => c.enabled);
  if (enabled.length === 0) return { ok: false, reason: 'crossing_disabled' };

  const byKind = enabled.filter((c) => c.kinds.includes(q.kind));
  if (byKind.length === 0) return { ok: false, reason: 'kind_not_allowed' };

  const live = byKind.filter((c) => Date.parse(c.expiresAt) > Date.parse(q.now));
  if (live.length === 0) return { ok: false, reason: 'crossing_expired' };

  live.sort((a, b) => a.kinds.length - b.kinds.length);
  return { ok: true, crossing: live[0]! };
}

export interface BucketState {
  tokens: number;
  lastRefillAt: string;
}

/** burst = a sixth of the hourly allowance, so a bucket is not a fixed window */
export function burstFor(maxPerHour: number): number {
  return Math.max(1, Math.ceil(maxPerHour / 6));
}

export function refillPerSecond(maxPerHour: number): number {
  return maxPerHour / 3600;
}

export function newBucket(crossing: Crossing, now: string): BucketState {
  return { tokens: burstFor(crossing.maxPerHour), lastRefillAt: now };
}

export interface Consumed {
  allowed: boolean;
  state: BucketState;
  retryAfterMs: number;
}

/** continuous refill, not a fixed window: a window leaks twice the limit at its edge */
export function consume(
  crossing: Crossing,
  state: BucketState | null,
  now: string,
  cost = 1,
): Consumed {
  const burst = burstFor(crossing.maxPerHour);
  const refill = refillPerSecond(crossing.maxPerHour);
  const base = state ?? { tokens: burst, lastRefillAt: now };
  const elapsed = Math.max(0, (Date.parse(now) - Date.parse(base.lastRefillAt)) / 1000);
  const tokens = Math.min(burst, base.tokens + elapsed * refill);

  if (tokens >= cost) {
    return { allowed: true, state: { tokens: tokens - cost, lastRefillAt: now }, retryAfterMs: 0 };
  }
  const deficit = cost - tokens;
  return {
    allowed: false,
    state: { tokens, lastRefillAt: now },
    retryAfterMs: Math.ceil((deficit / refill) * 1000),
  };
}

export interface AuthorizeRequest extends ResolveQuery {
  bytes?: number;
}

export type Authorized =
  | { ok: true; crossing: Crossing; state: BucketState }
  | { ok: false; reason: ResolveReason | 'too_large' | 'rate_limited'; retryAfterMs?: number };

/** the single entry point the relay calls before anything crosses */
export function authorize(
  crossings: Crossing[],
  req: AuthorizeRequest,
  state: BucketState | null,
): Authorized {
  const resolved = resolveCrossing(crossings, req);
  if (!resolved.ok) return { ok: false, reason: resolved.reason };

  const c = resolved.crossing;
  if (c.maxBytes !== undefined && (req.bytes ?? 0) > c.maxBytes) {
    return { ok: false, reason: 'too_large' };
  }
  const spent = consume(c, state, req.now);
  if (!spent.allowed) {
    return { ok: false, reason: 'rate_limited', retryAfterMs: spent.retryAfterMs };
  }
  return { ok: true, crossing: c, state: spent.state };
}
