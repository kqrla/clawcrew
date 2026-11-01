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
import { evidenceFits } from './ontology.js';

export const DEFAULT_LEASE_TTL_MS = 5 * 60_000;
export const DEFAULT_CLAIM_WINDOW_MS = 15 * 60_000;

export interface Seat {
  id: string;
  /** the surfaces this seat may write. authority comes from grants, not here. */
  slice: string[];
}

export type CustodyResult = { ok: true; row: WorkRow } | { ok: false; reason: string };

/**
 * what an external measurement looks like. `runBy` is who executed the source,
 * not who benefits from the number, and `computedAt` is when the source was
 * read. both are checked, because a stale number that agrees with you is the
 * cheapest forgery in the system.
 */
export interface MetricObservation {
  objective: string;
  source: string;
  value: number;
  computedAt: string;
  runBy: string;
}

const at = (base: string, addMs: number): string =>
  new Date(Date.parse(base) + addMs).toISOString();

/** take custody. the row's own deadline and the seat's slice decide, not intent. */
export function claimWork(
  row: WorkRow,
  seat: Seat,
  now: string,
  opts: { ttlMs?: number; idempotencyKey?: string; inputFingerprint?: string } = {},
): CustodyResult {
  // a replayed claim must not read as a race. same key, same input, same answer:
  // the row it already produced. same key over a changed brief is a different
  // request wearing the first one's name, and refusing is the only safe answer.
  if (opts.idempotencyKey && row.claimKey === opts.idempotencyKey) {
    if (row.inputFingerprint && opts.inputFingerprint && row.inputFingerprint !== opts.inputFingerprint) {
      return { ok: false, reason: 'replay_with_changed_input' };
    }
    return { ok: true, row };
  }

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
      lastClaimAt: now,
      claimKey: opts.idempotencyKey,
      inputFingerprint: opts.inputFingerprint,
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
 * the only thing that resets the spin counter, and it now costs evidence.
 *
 * docs/27 §11: progress used to be self-reported, which made the one control
 * that catches a spinning seat deletable by the seat itself. a progress claim
 * must now carry an observation of the objective's own metric, read from the
 * objective's own source, newer than the last progress, showing a different
 * number. the counter resets when a number we compute elsewhere moves, and not
 * when somebody says the work is going well.
 */
export function progress(
  row: WorkRow,
  holder: string,
  now: string,
  opts: { ttlMs?: number; observation?: MetricObservation; allowSelfMeasured?: boolean } = {},
): CustodyResult {
  const refuse = held(row, holder, now);
  if (refuse) return refuse;

  const obs = opts.observation;
  if (!obs) return { ok: false, reason: 'progress_requires_metric_evidence' };
  if (obs.objective !== row.objectiveRef) return { ok: false, reason: 'evidence_for_another_objective' };
  if (Number.isNaN(Date.parse(obs.computedAt))) return { ok: false, reason: 'evidence_timestamp_invalid' };
  if (!Number.isFinite(obs.value)) return { ok: false, reason: 'evidence_value_invalid' };

  // the observation must post-date the last progress, or it is the same reading
  // resubmitted under a new timestamp
  const floor = row.progressAt ?? row.lastClaimAt;
  // strictly before, not "before or at": a reading taken in the same instant as
  // the claim is ordering-ambiguous, and the value check still has to pass.
  if (floor && Date.parse(obs.computedAt) < Date.parse(floor)) {
    return { ok: false, reason: 'evidence_predates_last_progress' };
  }
  if (row.metricValueAt !== undefined && obs.value === row.metricValueAt) {
    return { ok: false, reason: 'metric_did_not_move' };
  }
  // a seat may not be the source of the number that certifies its own progress
  if (!opts.allowSelfMeasured && obs.runBy === holder) {
    return { ok: false, reason: 'self_measured_progress' };
  }

  const expiresAt = at(now, opts.ttlMs ?? DEFAULT_LEASE_TTL_MS);
  return {
    ok: true,
    row: {
      ...row,
      progressVersion: row.progressVersion + 1,
      progressAt: now,
      metricValueAt: obs.value,
      metricObservedAt: obs.computedAt,
      nextActionAt: expiresAt,
      lease: { ...row.lease!, expiresAt, renewals: 0 },
    },
  };
}

/** terminal, and only with evidence. a reference, never prose. */
export function complete(row: WorkRow, holder: string, evidenceRef: string, now: string): CustodyResult {
  const refuse = held(row, holder, now);
  if (refuse) return refuse;
  // docs/29: the kind of work decides what can prove it. without this a deal is
  // closed with a commit hash and nobody notices, because the field is populated.
  if (row.kind) {
    const fits = evidenceFits(row.kind, evidenceRef);
    if (!fits.ok) return { ok: false, reason: fits.reason };
  } else if (!isReference(evidenceRef)) {
    // unkinded work predates the ontology and keeps the payload rule it had
    return { ok: false, reason: 'evidence_must_be_a_reference' };
  }

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

/**
 * the brief was wrong, not the runner. docs/27 §9c: CAMEL distinguishes a failed
 * holder from a failed instruction and we did not, so a mis-specified objective
 * burned three good holders and then spent a human contact.
 *
 * only the owning tier may replan, because it wrote the brief. a replan resets
 * the attempt count, since the previous attempts were spent on a different
 * question, and it leaves the metric value alone: a stale number must never be
 * resettable by rewriting the brief around it.
 */
export function replan(
  row: WorkRow,
  byTier: string,
  brief: string,
  now: string,
  opts: { objectiveVersion?: number; claimWindowMs?: number } = {},
): CustodyResult {
  if (byTier !== row.tier) return { ok: false, reason: 'replan_by_non_owner' };
  if (row.state === 'leased') return { ok: false, reason: 'cannot_replan_a_held_row' };
  if (row.state === 'done' || row.state === 'cancelled') {
    return { ok: false, reason: `row_terminal:${row.state}` };
  }
  if (brief.trim().length === 0) return { ok: false, reason: 'brief_required' };
  if (brief === row.brief) return { ok: false, reason: 'brief_unchanged' };

  const deadline = at(now, opts.claimWindowMs ?? DEFAULT_CLAIM_WINDOW_MS);
  return {
    ok: true,
    row: {
      ...row,
      state: 'ready',
      brief,
      objectiveVersion: opts.objectiveVersion ?? row.objectiveVersion,
      attempts: 0,
      blockedReason: undefined,
      lease: undefined,
      claimDeadlineAt: deadline,
      nextActionAt: deadline,
      replannedBy: byTier,
      replannedAt: now,
      claimKey: undefined,
      inputFingerprint: undefined,
    },
  };
}
