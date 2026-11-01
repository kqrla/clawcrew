/**
 * the sweep that keeps a month alive. see docs/25.
 *
 * everything here is a pure function of rows and a timestamp: no reaper, no
 * timers, no memory between calls. a row that is not moving is discovered by
 * comparing it to `now`, never by a process remembering it.
 *
 * the four invariants:
 *   i.   no orphaned custody      -> reclaim_expired
 *   ii.  no unclaimable work      -> alarm_unclaimable
 *   iii. no spinning              -> revoke_spinning
 *   iv.  no silent terminal state -> violation
 */
export type WorkState = 'ready' | 'leased' | 'blocked' | 'done' | 'cancelled';

export interface WorkRow {
  id: string;
  state: WorkState;
  tier: string;
  objectiveRef: string;
  /** surfaces this row may write to; contention is a separate check. see docs/26 */
  surfaces: string[];
  /** required for every non-terminal state. a row without one is a stall. */
  nextActionAt?: string;
  /** when a `ready` row must have been claimed by, or it is unclaimable */
  claimDeadlineAt?: string;
  lease?: {
    holder: string;
    expiresAt: string;
    /** renewed without progress since the last progress bump -> spinning */
    renewals: number;
  };
  /** bumped only when the work itself changed, never by a heartbeat */
  progressVersion: number;
  progressAt?: string;
  attempts: number;
  maxAttempts: number;
  blockedReason?: string;
  evidenceRef?: string;
  cancelledReason?: string;
  cancelledBy?: string;
}

export interface SweepOptions {
  now: string;
  /** renewals without progress before a holder is treated as spinning */
  stuckRenewalLimit?: number;
  /** slack before a passed deadline counts as a stall */
  stallGraceMs?: number;
}

export type Action =
  | { kind: 'reclaim_expired'; rowId: string; holder: string; nextAttempts: number }
  | { kind: 'revoke_spinning'; rowId: string; holder: string; renewals: number }
  | { kind: 'alarm_unclaimable'; rowId: string; tier: string; deadline: string }
  | { kind: 'alarm_stall'; rowId: string; tier: string; since: string }
  | { kind: 'exhausted'; rowId: string; tier: string; attempts: number }
  | { kind: 'violation'; rowId: string; rule: ViolationRule };

export type ViolationRule =
  | 'missing_next_action'
  | 'ready_without_claim_deadline'
  | 'leased_without_lease'
  | 'done_without_evidence'
  | 'cancelled_without_reason';

const TERMINAL: WorkState[] = ['done', 'cancelled'];

export function isTerminal(row: WorkRow): boolean {
  return TERMINAL.includes(row.state);
}

/**
 * structural checks that need no clock. a row that fails these is a bug in
 * whatever wrote it, so they are reported as violations rather than repaired
 * silently: a repaired row hides the writer that is wrong.
 */
export function violations(row: WorkRow): ViolationRule[] {
  const out: ViolationRule[] = [];
  if (row.state === 'leased' && !row.lease?.expiresAt) out.push('leased_without_lease');
  if (row.state === 'done' && !row.evidenceRef) out.push('done_without_evidence');
  if (row.state === 'cancelled' && (!row.cancelledReason || !row.cancelledBy)) {
    out.push('cancelled_without_reason');
  }
  if (!isTerminal(row) && !row.nextActionAt) out.push('missing_next_action');
  // a ready row with no claim deadline can never be reported unclaimable, which
  // makes it silently immortal. see docs/25 §3 ii.
  if (row.state === 'ready' && !row.claimDeadlineAt) out.push('ready_without_claim_deadline');
  return out;
}

function ms(iso: string): number {
  return Date.parse(iso);
}

/** deterministic order, so the same rows always produce the same report */
export function sweep(rows: WorkRow[], opts: SweepOptions): Action[] {
  const now = ms(opts.now);
  const renewalLimit = opts.stuckRenewalLimit ?? 3;
  const grace = opts.stallGraceMs ?? 0;
  const actions: Action[] = [];

  for (const row of [...rows].sort((a, b) => a.id.localeCompare(b.id))) {
    const found = violations(row);
    for (const rule of found) actions.push({ kind: 'violation', rowId: row.id, rule });

    if (isTerminal(row)) continue;

    // exhausted attempts are terminal-ish: the row must be blocked, by a tier,
    // with its history, rather than retried forever.
    if (row.attempts >= row.maxAttempts) {
      actions.push({ kind: 'exhausted', rowId: row.id, tier: row.tier, attempts: row.attempts });
      continue;
    }

    if (row.state === 'leased' && row.lease) {
      if (now > ms(row.lease.expiresAt)) {
        actions.push({
          kind: 'reclaim_expired',
          rowId: row.id,
          holder: row.lease.holder,
          nextAttempts: row.attempts + 1,
        });
        continue;
      }
      // alive and holding, but not producing. the commonest real failure and
      // the one no health check catches.
      if (row.lease.renewals >= renewalLimit) {
        actions.push({
          kind: 'revoke_spinning',
          rowId: row.id,
          holder: row.lease.holder,
          renewals: row.lease.renewals,
        });
        continue;
      }
      continue;
    }

    if (row.state === 'ready' && row.claimDeadlineAt && now > ms(row.claimDeadlineAt) + grace) {
      // nobody could take it: no seat holds the credential, the slice excludes
      // the objective, or every eligible seat is busy. all three are bugs.
      actions.push({
        kind: 'alarm_unclaimable',
        rowId: row.id,
        tier: row.tier,
        deadline: row.claimDeadlineAt,
      });
      continue;
    }

    if (row.state === 'blocked' && row.nextActionAt && now > ms(row.nextActionAt) + grace) {
      actions.push({ kind: 'alarm_stall', rowId: row.id, tier: row.tier, since: row.nextActionAt });
      continue;
    }
  }

  return actions;
}

/** true when nothing needs doing, which is the only definition of healthy */
export function healthy(actions: Action[]): boolean {
  return actions.length === 0;
}

/**
 * a claim is legal only if the row is claimable and the seat's slice covers
 * every surface the row may write. authority comes from grants, not from here:
 * this checks shape and slice, never permission.
 */
export function canClaim(
  row: WorkRow,
  seat: { slice: string[] },
  now: string,
): { ok: true } | { ok: false; reason: string } {
  if (row.state !== 'ready') return { ok: false, reason: `not_ready:${row.state}` };
  if (violations(row).includes('missing_next_action')) {
    return { ok: false, reason: 'no_next_action' };
  }
  if (row.claimDeadlineAt && ms(now) > ms(row.claimDeadlineAt)) {
    return { ok: false, reason: 'claim_deadline_passed' };
  }
  const uncovered = row.surfaces.filter((s) => !seat.slice.includes(s));
  if (uncovered.length > 0) return { ok: false, reason: `slice_missing:${uncovered.join(',')}` };
  if (row.attempts >= row.maxAttempts) return { ok: false, reason: 'attempts_exhausted' };
  return { ok: true };
}

/** how long a reclaimed row waits to be picked up before it alarms */
export const DEFAULT_CLAIM_WINDOW_MS = 15 * 60_000;

/**
 * the only three sweep actions that change state. alarms and violations are
 * findings, not transitions: an alarm that mutated a row would hide the bug
 * that caused it.
 *
 * reclaiming past max attempts blocks the row in the same step, so a dead
 * holder cannot spend a tick in a state that is neither retryable nor visible.
 */
export function applyAction(
  row: WorkRow,
  action: Action,
  now: string,
  opts: { claimWindowMs?: number } = {},
): WorkRow | null {
  const windowMs = opts.claimWindowMs ?? DEFAULT_CLAIM_WINDOW_MS;
  const deadline = new Date(ms(now) + windowMs).toISOString();

  const rearmed = (attempts: number): WorkRow => {
    if (attempts >= row.maxAttempts) {
      return {
        ...row,
        state: 'blocked',
        lease: undefined,
        attempts,
        blockedReason: 'attempts_exhausted',
        nextActionAt: deadline,
        claimDeadlineAt: undefined,
      };
    }
    return {
      ...row,
      state: 'ready',
      lease: undefined,
      attempts,
      claimDeadlineAt: deadline,
      nextActionAt: deadline,
    };
  };

  switch (action.kind) {
    case 'reclaim_expired':
      return rearmed(action.nextAttempts);
    case 'revoke_spinning':
      return rearmed(row.attempts + 1);
    case 'exhausted':
      return {
        ...row,
        state: 'blocked',
        lease: undefined,
        blockedReason: 'attempts_exhausted',
        nextActionAt: deadline,
        claimDeadlineAt: undefined,
      };
    default:
      return null;
  }
}
