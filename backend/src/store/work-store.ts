/**
 * the worker side of the store. docs/25 §1: work is addressed to a tier, so the
 * claim is an atomic conditional update rather than a grant handed to a name.
 *
 * two processes can race for the same row and exactly one wins, because the
 * winner is decided by the database in a single statement, not by a check
 * followed by a write.
 */
import { WorkRow } from '../domain/liveness.js';
import {
  CustodyResult,
  MetricObservation,
  Seat,
  abandon,
  claimWork,
  complete,
  progress,
  renew,
  replan,
} from '../domain/custody.js';
import { Queryable, TaskRow, toWork, writeWork } from './tick-store.js';

const COLUMNS = `id, state, owner_tier, objective_id, surfaces, next_action_at,
                 claim_deadline_at, progress_version, progress_at, attempts,
                 max_attempts, blocking_reason, evidence_ref, cancelled_reason,
                 cancelled_by, custody_holder, custody_expires_at, custody_renewals,
                 brief, objective_version, metric_value_at, metric_observed_at,
                 claim_key, input_fingerprint, last_claim_at,
                 replanned_by, replanned_at, deferred_ticks, starved_at, kind`;

export interface WorkStore {
  load(id: string): Promise<WorkRow | null>;
  /** null when the row does not exist; a refusal when somebody else has it */
  claim(
    id: string,
    seat: Seat,
    now: string,
    opts?: { ttlMs?: number; idempotencyKey?: string; inputFingerprint?: string },
  ): Promise<CustodyResult | null>;
  renew(id: string, holder: string, now: string, ttlMs?: number): Promise<CustodyResult>;
  progress(
    id: string,
    holder: string,
    now: string,
    opts?: { ttlMs?: number; observation?: MetricObservation; allowSelfMeasured?: boolean },
  ): Promise<CustodyResult>;
  replan(
    id: string,
    byTier: string,
    brief: string,
    now: string,
    opts?: { objectiveVersion?: number },
  ): Promise<CustodyResult>;
  complete(id: string, holder: string, evidenceRef: string, now: string): Promise<CustodyResult>;
  abandon(id: string, holder: string, reason: string, now: string): Promise<CustodyResult>;
  save(w: WorkRow): Promise<void>;
}

export function createWorkStore(db: Queryable): WorkStore {
  async function load(id: string): Promise<WorkRow | null> {
    const r = await db.query<TaskRow>(`select ${COLUMNS} from task where id = $1`, [id]);
    return r.rows[0] ? toWork(r.rows[0]) : null;
  }

  /** apply a pure transition, persist it, return it. shared by every verb. */
  async function transition(
    id: string,
    apply: (row: WorkRow) => CustodyResult,
  ): Promise<CustodyResult> {
    const row = await load(id);
    if (!row) return { ok: false, reason: 'no_such_row' };
    const result = apply(row);
    if (result.ok) await writeWork(db, result.row);
    return result;
  }

  return {
    load,

    async claim(id, seat, now, opts = {}) {
      const row = await load(id);
      if (!row) return null;

      // the pure function decides eligibility: slice, deadline, attempts, replay.
      const allowed = claimWork(row, seat, now, opts);
      if (!allowed.ok) return allowed;
      // a replay resolves to the row that already exists, and writes nothing
      if (row.claimKey && row.claimKey === opts.idempotencyKey && row.state === 'leased') {
        return allowed;
      }

      // the database decides the race. one statement, no read-then-write gap.
      const expiresAt = allowed.row.lease!.expiresAt;
      const updated = await db.query<TaskRow>(
        `update task
            set state = 'leased', custody_holder = $2, custody_expires_at = $3,
                custody_renewals = 0, claim_deadline_at = null, next_action_at = $3,
                last_claim_at = $5, claim_key = $6, input_fingerprint = $7
          where id = $1
            and state = 'ready'
            and custody_holder is null
            and claim_deadline_at > $4
          returning ${COLUMNS}`,
        [id, seat.id, expiresAt, now, now, opts.idempotencyKey ?? null, opts.inputFingerprint ?? null],
      );

      if (!updated.rows[0]) return { ok: false, reason: 'raced' };
      return { ok: true, row: toWork(updated.rows[0]) };
    },

    renew: (id, holder, now, ttlMs) =>
      transition(id, (row) => renew(row, holder, now, { ...(ttlMs !== undefined ? { ttlMs } : {}) })),

    progress: (id, holder, now, opts = {}) =>
      transition(id, (row) => progress(row, holder, now, opts)),

    replan: (id, byTier, brief, now, opts = {}) =>
      transition(id, (row) => replan(row, byTier, brief, now, opts)),

    complete: (id, holder, evidenceRef, now) =>
      transition(id, (row) => complete(row, holder, evidenceRef, now)),

    abandon: (id, holder, reason, now) =>
      transition(id, (row) => abandon(row, holder, reason, now)),

    save: async (w) => writeWork(db, w),
  };
}
