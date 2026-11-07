/**
 * docs/52. the other half of a lease: a task has to be able to end.
 *
 * without this a dispatcher is a loop that hands out the same task to the same seat forever,
 * because expiry is the only thing that ever happens to a lease. completion is decided by
 * evidence that is *newer than the lease*, not by the seat saying it is done: a claim of work
 * is not work.
 */
export interface Lease {
  taskId: string;
  seat: string;
  kind: string;
  objectiveId: string;
  acquiredAt: Date;
  expiresAt: Date;
  attempts: number;
  maxAttempts: number;
}
export interface Evidence {
  objectiveId: string;
  kind: string;
  computedAt: Date;
  runBy: string;
}
export type Outcome =
  | { action: 'complete'; evidence: Evidence }
  | { action: 'requeue'; why: 'no_evidence' | 'stale_evidence' | 'wrong_kind'; backoffMs: number }
  | { action: 'escalate'; why: 'attempts_exhausted' }
  | { action: 'hold'; why: 'lease_running' };

export const BACKOFF_MS = 5 * 60 * 1000;

export function judge(lease: Lease, evidence: Evidence[], now: Date): Outcome {
  const fresh = evidence.filter((e) => e.computedAt.getTime() >= lease.acquiredAt.getTime());
  const rightKind = fresh.filter((e) => e.kind === lease.kind && e.objectiveId === lease.objectiveId);

  if (rightKind.length > 0) {
    // newest wins, because evidence is append-only and an older run does not explain a newer one
    const best = rightKind.sort((a, b) => b.computedAt.getTime() - a.computedAt.getTime())[0]!;
    return { action: 'complete', evidence: best };
  }
  if (now.getTime() < lease.expiresAt.getTime()) return { action: 'hold', why: 'lease_running' };

  if (lease.attempts >= lease.maxAttempts) return { action: 'escalate', why: 'attempts_exhausted' };
  if (fresh.length > 0) return { action: 'requeue', why: 'wrong_kind', backoffMs: BACKOFF_MS };
  if (evidence.length > 0) return { action: 'requeue', why: 'stale_evidence', backoffMs: BACKOFF_MS };
  return { action: 'requeue', why: 'no_evidence', backoffMs: BACKOFF_MS };
}
