/**
 * the worker side of the runtime. docs/25 says a row in `ready` is claimable by
 * anybody whose slice covers it; this is the only legal way to leave that state.
 *
 * every function is pure and every refusal is named, so an agent that cannot
 * take work learns why in one word instead of acquiring the lease and failing
 * later. nothing here writes: the caller persists the returned row, and the
 * store makes the claim atomic.
 */
import { WorkRow, canClaim } from './liveness.js';
import { isReference } from './relay.js';

export const DEFAULT_LEASE_TTL_MS = 5 * 60_000;
export const DEFAULT_CLAIM_WINDOW_MS = 15 * 60_000;

export interface Seat {
  id: string;
  /** the surfaces this seat may write. authority comes from grants, not here. */
  slice: string[];
}

export type CustodyResult = { ok: true; row: WorkRow } | { ok: false; reason: string };

const at = (base: string, addMs: number): string =>
  new Date(Date.parse(base) + addMs).toISOString();

/** take custody. the row's own deadline and the seat's slice decide, not intent. */
export function claimWork(
  row: WorkRow,
  seat: Seat,
  now: string,
  opts: { ttlMs?: number } = {},
): CustodyResult {
  const shape = canClaim(row, seat, now);
  if (!shape.ok) return shape;

  const expiresAt = at(now, opts.ttlMs ?? DEFAULT_LEASE_TTL_MS);
  return {
    ok: true,
    row: {
      ...row,
      state: 'leased',
      // a leased row carries its own expiry as its next deadline, so a holder
      // that dies is visible without a separate liveness table
      claimDeadlineAt: undefined,
      nextActionAt: expiresAt,
      lease: { holder: seat.id, expiresAt, renewals: 0 },
    },
  };
}

function held(row: WorkRow, holder: string, now: string): CustodyResult | null {
  if (row.state !== 'leased' || !row.lease) {
    return { ok: false, reason: `not_leased:${row.state}` };
  }
  if (row.lease.holder !== holder) return { ok: false, reason: 'not_holder' };
  if (Date.parse(now) > Date.parse(row.lease.expiresAt)) return { ok: false, reason: 'lease_expired' };
  return null;
}

/** a heartbeat. it extends custody and buys no credit against the spin counter. */
export function renew(
  row: WorkRow,
  holder: string,
  now: string,
  opts: { ttlMs?: number } = {},
): CustodyResult {
  const refuse = held(row, holder, now);
  if (refuse) return refuse;

  const expiresAt = at(now, opts.ttlMs ?? DEFAULT_LEASE_TTL_MS);
  return {
    ok: true,
    row: {
      ...row,
      nextActionAt: expiresAt,
      lease: { ...row.lease!, expiresAt, renewals: row.lease!.renewals + 1 },
    },
  };
}

/**
 * the only thing that resets the spin counter. call it when an artifact was
 * written, a surface was touched, or a measurement was taken: something a third
 * party could look at. a seat that calls this without producing has defeated
 * the one control that catches it.
 */
export function progress(
  row: WorkRow,
  holder: string,
  now: string,
  opts: { ttlMs?: number } = {},
): CustodyResult {
  const refuse = held(row, holder, now);
  if (refuse) return refuse;

  const expiresAt = at(now, opts.ttlMs ?? DEFAULT_LEASE_TTL_MS);
  return {
    ok: true,
    row: {
      ...row,
      progressVersion: row.progressVersion + 1,
      progressAt: now,
      nextActionAt: expiresAt,
      lease: { ...row.lease!, expiresAt, renewals: 0 },
    },
  };
}

/** terminal, and only with evidence. a reference, never prose. */
export function complete(row: WorkRow, holder: string, evidenceRef: string, now: string): CustodyResult {
  const refuse = held(row, holder, now);
  if (refuse) return refuse;
  if (!isReference(evidenceRef)) return { ok: false, reason: 'evidence_must_be_a_reference' };

  return {
    ok: true,
    row: {
      ...row,
      state: 'done',
      lease: undefined,
      nextActionAt: undefined,
      claimDeadlineAt: undefined,
      evidenceRef,
    },
  };
}

/**
 * give the work back without claiming success. the attempt is spent either way,
 * because a voluntary release after two hours cost the same as a death.
 */
export function abandon(
  row: WorkRow,
  holder: string,
  reason: string,
  now: string,
  opts: { claimWindowMs?: number } = {},
): CustodyResult {
  const refuse = held(row, holder, now);
  if (refuse) return refuse;
  if (reason.trim().length === 0) return { ok: false, reason: 'reason_required' };

  const attempts = row.attempts + 1;
  const deadline = at(now, opts.claimWindowMs ?? DEFAULT_CLAIM_WINDOW_MS);
  const spent = attempts >= row.maxAttempts;

  return {
    ok: true,
    row: {
      ...row,
      state: spent ? 'blocked' : 'ready',
      lease: undefined,
      attempts,
      blockedReason: spent ? reason : row.blockedReason,
      claimDeadlineAt: spent ? undefined : deadline,
      nextActionAt: deadline,
    },
  };
}
