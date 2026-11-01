/**
 * spending is a lease with a price. docs/27 §9a: paperclip splits a budget into
 * a policy per scope plus a reservation that is taken before the spend and
 * settled after, and that split is the right one.
 *
 * this replaces `tier.budget`, a jsonb we stored and never read. a limit that
 * nothing enforces is not a limit, it is a hope, and in a dark factory hope is
 * the most expensive line item.
 *
 * every function is pure. the caller loads the policy and this window's
 * reservations, and persists what comes back.
 */

export type BudgetMetric = 'usd_cents' | 'tokens' | 'tool_calls';
export type BudgetWindow = 'day' | 'month' | 'once';
export type BudgetScope = 'tier' | 'objective' | 'seat';

export interface BudgetPolicy {
  id: string;
  scope: BudgetScope;
  scopeId: string;
  metric: BudgetMetric;
  window: BudgetWindow;
  /** ceiling for the window, in metric units */
  amount: number;
  /** committed fraction that raises a warning, 0..1 */
  warnPercent: number;
  /** false means the policy advises and never refuses */
  hardStop: boolean;
}

export type ReservationState = 'held' | 'settled' | 'released';

export interface Reservation {
  id: string;
  policyId: string;
  /** who the spend is attributed to. a reservation without a name is a leak. */
  agentId: string;
  /** the run or task this hold belongs to */
  runRef: string;
  /** the held amount; on settle this stays as the reservation, settledAmount moves */
  amount: number;
  settledAmount?: number;
  state: ReservationState;
  startedAt: string;
  settledAt?: string;
}

export interface BudgetPosition {
  limit: number;
  /** holds not yet settled */
  held: number;
  settled: number;
  /** held + settled: what cannot be spent twice */
  committed: number;
  remaining: number;
  warnAt: number;
  state: 'ok' | 'warn' | 'exhausted';
}

/**
 * reservations must already be scoped to the policy's current window by the
 * caller. window arithmetic needs a clock and a timezone, and a partial day in
 * the wrong one is how a daily budget silently becomes a monthly overspend.
 */
export function position(policy: BudgetPolicy, reservations: Reservation[]): BudgetPosition {
  let held = 0;
  let settled = 0;
  for (const r of reservations) {
    if (r.policyId !== policy.id) continue;
    if (r.state === 'held') held += r.amount;
    if (r.state === 'settled') settled += r.settledAmount ?? r.amount;
  }

  const committed = held + settled;
  const remaining = Math.max(0, policy.amount - committed);
  const warnAt = policy.amount * policy.warnPercent;

  return {
    limit: policy.amount,
    held,
    settled,
    committed,
    remaining,
    warnAt,
    state: committed >= policy.amount ? 'exhausted' : committed >= warnAt ? 'warn' : 'ok',
  };
}

export interface ReserveRequest {
  id: string;
  agentId: string;
  runRef: string;
  /** what the caller expects to spend. an estimate, settled against the truth */
  amount: number;
  now: string;
}

export type ReserveOutcome =
  | { ok: true; reservation: Reservation; position: BudgetPosition; warning: boolean }
  | { ok: false; reason: string; position: BudgetPosition };

/**
 * take the hold before the spend. the ordering is the whole point: checking a
 * budget after the money has gone is accounting, not control.
 */
export function reserve(
  policy: BudgetPolicy,
  reservations: Reservation[],
  request: ReserveRequest,
): ReserveOutcome {
  const before = position(policy, reservations);

  if (!Number.isFinite(request.amount) || request.amount <= 0) {
    return { ok: false, reason: 'reservation_amount_invalid', position: before };
  }
  if (request.agentId.trim().length === 0 || request.runRef.trim().length === 0) {
    return { ok: false, reason: 'reservation_needs_an_owner', position: before };
  }
  if (before.state === 'exhausted' && policy.hardStop) {
    return { ok: false, reason: 'budget_exhausted', position: before };
  }
  // a soft policy over its ceiling still refuses work that cannot fit in nothing
  if (policy.hardStop && before.committed + request.amount > policy.amount) {
    return { ok: false, reason: 'budget_would_be_exceeded', position: before };
  }

  const reservation: Reservation = {
    id: request.id,
    policyId: policy.id,
    agentId: request.agentId,
    runRef: request.runRef,
    amount: request.amount,
    state: 'held',
    startedAt: request.now,
  };

  const after = position(policy, [...reservations, reservation]);
  return {
    ok: true,
    reservation,
    position: after,
    warning: after.state !== 'ok' || !policy.hardStop && after.committed > policy.amount,
  };
}

export type SettleOutcome =
  | { ok: true; reservation: Reservation; overrun: boolean; position: BudgetPosition }
  | { ok: false; reason: string };

/**
 * settle the hold against what was actually spent. an overrun is recorded, not
 * refused: the money is gone, and pretending otherwise is how a ledger stops
 * being a ledger.
 */
export function settle(
  policy: BudgetPolicy,
  reservations: Reservation[],
  reservation: Reservation,
  actual: number,
  now: string,
): SettleOutcome {
  if (reservation.state !== 'held') return { ok: false, reason: `reservation_not_held:${reservation.state}` };
  if (!Number.isFinite(actual) || actual < 0) return { ok: false, reason: 'settled_amount_invalid' };

  const settledReservation: Reservation = {
    ...reservation,
    state: 'settled',
    settledAmount: actual,
    settledAt: now,
  };
  const others = reservations.filter((r) => r.id !== reservation.id);
  return {
    ok: true,
    reservation: settledReservation,
    overrun: actual > reservation.amount,
    position: position(policy, [...others, settledReservation]),
  };
}

/** give the hold back. only a hold can be released, or a settled spend un-happens. */
export function release(reservation: Reservation): Reservation | { reason: string } {
  if (reservation.state !== 'held') return { reason: `reservation_not_held:${reservation.state}` };
  return { ...reservation, state: 'released' };
}

/**
 * a hold whose run never came back. this is the budget's version of custody
 * expiry: without it, a crashed run holds its estimate for ever and the budget
 * slowly fills with ghosts.
 */
export function expired(reservations: Reservation[], now: string, ttlMs: number): Reservation[] {
  const cutoff = Date.parse(now) - ttlMs;
  return reservations.filter((r) => r.state === 'held' && Date.parse(r.startedAt) < cutoff);
}

/**
 * `tier.budget` was a blob an operator wrote and the engine never read. this
 * turns it into policies, and refuses to guess: a key it does not understand is
 * reported back rather than dropped, because a limit that silently did nothing
 * is the failure this whole module exists to end.
 *
 * the ids it mints match the ones `migrations/20261101000001` backfills, so a
 * tier seeded before this code shipped and a tier seeded after it are the same
 * policy, not two.
 */
export interface BudgetSeed {
  usd_cents_per_day?: number;
  usd_per_day?: number;
  tokens_per_day?: number;
  tool_calls_per_day?: number;
  warn_percent?: number;
  hard_stop?: boolean;
}

const SEED_KEYS = new Set([
  'usd_cents_per_day',
  'usd_per_day',
  'tokens_per_day',
  'tool_calls_per_day',
  'warn_percent',
  'hard_stop',
]);

export interface SeedResult {
  policies: BudgetPolicy[];
  /** keys present in the seed that produced no policy, and why */
  ignored: { key: string; reason: string }[];
}

export function policiesFromSeed(
  scopeId: string,
  seed: unknown,
  opts: { scope?: BudgetScope } = {},
): SeedResult {
  const scope = opts.scope ?? 'tier';
  const policies: BudgetPolicy[] = [];
  const ignored: { key: string; reason: string }[] = [];

  if (typeof seed !== 'object' || seed === null || Array.isArray(seed)) {
    return { policies, ignored: [{ key: '<seed>', reason: 'seed_is_not_an_object' }] };
  }
  const raw = seed as Record<string, unknown>;

  const warnPercent =
    typeof raw.warn_percent === 'number' && raw.warn_percent >= 0 && raw.warn_percent <= 1
      ? raw.warn_percent
      : 0.8;
  const hardStop = typeof raw.hard_stop === 'boolean' ? raw.hard_stop : true;

  const add = (metric: BudgetMetric, amount: unknown, idMetric: string) => {
    if (amount === undefined) return;
    if (typeof amount !== 'number' || !Number.isFinite(amount) || amount < 0) {
      ignored.push({ key: idMetric, reason: 'amount_invalid' });
      return;
    }
    policies.push({
      id: `bp.${scopeId}.${metric}.day`,
      scope,
      scopeId,
      metric,
      window: 'day',
      amount,
      warnPercent,
      hardStop,
    });
  };

  // cents first, then dollars: if a seed carries both, the explicit one wins,
  // which is the same precedence the backfill's conflict clause has.
  add('usd_cents', raw.usd_cents_per_day, 'usd_cents_per_day');
  if (raw.usd_cents_per_day === undefined && typeof raw.usd_per_day === 'number') {
    add('usd_cents', Math.round(raw.usd_per_day * 100), 'usd_per_day');
  } else if (raw.usd_per_day !== undefined && raw.usd_cents_per_day !== undefined) {
    ignored.push({ key: 'usd_per_day', reason: 'superseded_by_usd_cents_per_day' });
  }
  add('tokens', raw.tokens_per_day, 'tokens_per_day');
  add('tool_calls', raw.tool_calls_per_day, 'tool_calls_per_day');

  for (const key of Object.keys(raw)) {
    if (!SEED_KEYS.has(key)) ignored.push({ key, reason: 'unknown_key' });
  }

  return { policies, ignored };
}
