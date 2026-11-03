import { Schedule, advance, lagMs, missedSlots, selectDue } from '../domain/scheduler.js';
import { RelayMessage, expireIfPast, isVisible, lease, nack, reclaim } from '../domain/relay-queue.js';
import { Action, WorkRow, applyAction, sweep } from '../domain/liveness.js';

/**
 * one tick. it decides nothing: it reads due rows, emits wakes, advances the
 * clock, and sweeps delivery. every step is idempotent and the process holds no
 * state between iterations, so stopping it is safe at any point. see docs/21.
 */
export interface TickerPorts {
  /** advisory lock; false means another ticker is running and this one exits */
  tryLock(): Promise<boolean>;
  loadSchedules(): Promise<Schedule[]>;
  saveSchedule(s: Schedule): Promise<void>;
  emitWake(s: Schedule, firedAt: string[]): Promise<void>;
  loadRelay(): Promise<RelayMessage[]>;
  saveRelay(m: RelayMessage): Promise<void>;
  deliver(m: RelayMessage): Promise<'ack' | 'nack'>;
  /** live work rows: ready, leased and blocked. terminal rows are not swept. */
  loadWork?(limit?: number): Promise<WorkRow[]>;
  saveWork?(w: WorkRow): Promise<void>;
  /** open auditor alerts. a disagreement nobody reads is the same as no disagreement */
  countAuditAlerts?(): Promise<number>;
  /** alarms and violations, on the hash chain. transitions are not findings. */
  recordFindings?(findings: Action[], at: string): Promise<void>;
  heartbeat(h: { at: string; tickCount: number; lagMs: number }): Promise<void>;
}

export interface TickOptions {
  now: string;
  maxSchedules?: number;
  relayBatch?: number;
  leaseTtlMs?: number;
  tickCount?: number;
  /** renewals without progress before a holder counts as spinning */
  stuckRenewalLimit?: number;
  workBatch?: number;
  /** transitions applied per tick; the rest defer, visibly, to the next tick */
  workBudget?: number;
  claimWindowMs?: number;
}

export interface TickReport {
  locked: boolean;
  schedulesDue: number;
  fired: number;
  advanced: number;
  relayLeased: number;
  relayDelivered: number;
  relayRetried: number;
  relayDead: number;
  relayExpired: number;
  /** work rows that changed state this tick */
  workSwept: number;
  workReclaimed: number;
  workRevoked: number;
  workBlocked: number;
  /** alarms and violations: things a human or a tier must look at */
  workFindings: number;
  /** transitions the budget pushed to the next tick */
  workDeferred: number;
  /** rows that have now been skipped for long enough to alarm */
  workStarved: number;
  /** auditor alerts still open. a disagreement nobody reads is no disagreement */
  auditAlerts: number;
  lagMs: number;
}

export async function runTick(ports: TickerPorts, opts: TickOptions): Promise<TickReport> {
  const now = opts.now;
  const empty: TickReport = {
    locked: false,
    schedulesDue: 0,
    fired: 0,
    advanced: 0,
    relayLeased: 0,
    relayDelivered: 0,
    relayRetried: 0,
    relayDead: 0,
    relayExpired: 0,
    workSwept: 0,
    workReclaimed: 0,
    workRevoked: 0,
    workBlocked: 0,
    workFindings: 0,
    workDeferred: 0,
    workStarved: 0,
    auditAlerts: 0,
    lagMs: 0,
  };

  if (!(await ports.tryLock())) return empty;

  // 1. schedules
  const schedules = await ports.loadSchedules();
  const due = selectDue(schedules, now, opts.maxSchedules ?? 50);
  let fired = 0;
  let advanced = 0;

  for (const s of due) {
    const firedAt = missedSlots(s, now);
    const next = advance(s, now, firedAt);
    if (firedAt.length > 0) {
      await ports.emitWake(s, firedAt);
      fired += firedAt.length;
    }
    if (next !== s) {
      await ports.saveSchedule(next);
      advanced += 1;
    }
  }

  // 2. relay sweep
  const relay = await ports.loadRelay();
  let relayExpired = 0;
  const live: RelayMessage[] = [];

  for (const m of relay) {
    const reclaimed = reclaim(expireIfPast(m, now), now);
    if (reclaimed.state === 'expired' && m.state !== 'expired') relayExpired += 1;
    if (reclaimed !== m) await ports.saveRelay(reclaimed);
    live.push(reclaimed);
  }

  const batch = live.filter((m) => isVisible(m, now)).slice(0, opts.relayBatch ?? 20);
  let delivered = 0;
  let retried = 0;
  let dead = 0;

  for (const m of batch) {
    const leased = lease(m, 'ticker', now, opts.leaseTtlMs ?? 60_000);
    await ports.saveRelay(leased);
    const outcome = await ports.deliver(leased);
    const settled =
      outcome === 'ack'
        ? { ...leased, state: 'delivered' as const, ackedAt: now }
        : nack(leased, now);
    await ports.saveRelay(settled);
    if (settled.state === 'delivered') delivered += 1;
    else if (settled.state === 'dead') dead += 1;
    else retried += 1;
  }

  // 3. work sweep: no orphaned custody, no unclaimable work, no spinning,
  // no silent terminal state. see docs/25.
  const work = ports.loadWork ? await ports.loadWork(opts.workBatch ?? 200) : [];
  const actions = sweep(work, {
    now,
    ...(opts.stuckRenewalLimit !== undefined ? { stuckRenewalLimit: opts.stuckRenewalLimit } : {}),
  });

  let workSwept = 0;
  let workReclaimed = 0;
  let workRevoked = 0;
  let workBlocked = 0;

  // a tick is bounded in work, not just in reads: whatever the budget pushes
  // out is reported as deferred rather than dropped.
  const budget = opts.workBudget ?? 50;
  const stateChanges = actions.filter(
    (a) => a.kind === 'reclaim_expired' || a.kind === 'revoke_spinning' || a.kind === 'exhausted',
  );
  const transitions = stateChanges.slice(0, budget);
  const skipped = stateChanges.slice(budget);
  const workDeferred = skipped.length;
  // re-arming an unclaimable row is bookkeeping, not a transition, so it is not
  // subject to the budget: dropping it would strand the row instead of delaying it
  const rearms = actions.filter(
    (a) => a.kind === 'alarm_unclaimable' || a.kind === 'alarm_starved',
  );

  if (ports.saveWork) {
    const byId = new Map(work.map((w) => [w.id, w]));
    for (const a of [...transitions, ...rearms]) {
      const row = byId.get(a.rowId);
      if (!row) continue;
      const next = applyAction(row, a, now, {
        ...(opts.claimWindowMs !== undefined ? { claimWindowMs: opts.claimWindowMs } : {}),
      });
      if (!next) continue;
      await ports.saveWork(next);
      byId.set(next.id, next);
      // a window or a counter, not a state change: neither is subject to the
      // work budget, because dropping one strands or hides a row
      if (a.kind === 'alarm_unclaimable' || a.kind === 'alarm_starved') continue;
      workSwept += 1;
      // buckets are by resulting state, not by the action that caused it: a
      // reclaim that spends the last attempt ends blocked, and the report has
      // to say so rather than counting it as a retry.
      if (next.state === 'blocked') workBlocked += 1;
      else if (a.kind === 'reclaim_expired') workReclaimed += 1;
      else if (a.kind === 'revoke_spinning') workRevoked += 1;
    }

    // the budget pushed these out, so say so on the row itself. a per-tick
    // count of deferred work is indistinguishable from a busy tick; the same
    // row deferred three times is starvation, and only the row can tell.
    for (const a of skipped) {
      const row = byId.get(a.rowId);
      if (!row) continue;
      const bumped = { ...row, deferredTicks: (row.deferredTicks ?? 0) + 1 };
      await ports.saveWork(bumped);
      byId.set(bumped.id, bumped);
    }
  }

  // a revoked spinner is both a transition and a finding: the row moves, and
  // the tier is told that a seat held work without producing. see docs/25 §5.
  const findings = actions.filter(
    (a) =>
      a.kind === 'alarm_unclaimable' ||
      a.kind === 'alarm_stall' ||
      a.kind === 'alarm_starved' ||
      a.kind === 'violation' ||
      a.kind === 'revoke_spinning',
  );
  if (findings.length > 0 && ports.recordFindings) {
    await ports.recordFindings(findings, now);
  }

  const report: TickReport = {
    locked: true,
    schedulesDue: due.length,
    fired,
    advanced,
    relayLeased: batch.length,
    relayDelivered: delivered,
    relayRetried: retried,
    relayDead: dead,
    relayExpired,
    workSwept,
    workReclaimed,
    workRevoked,
    workBlocked,
    workFindings: findings.length,
    workDeferred,
    auditAlerts: ports.countAuditAlerts ? await ports.countAuditAlerts() : 0,
    workStarved: findings.filter((f) => f.kind === 'alarm_starved').length,
    lagMs: lagMs(schedules, now),
  };

  await ports.heartbeat({ at: now, tickCount: opts.tickCount ?? 0, lagMs: report.lagMs });
  return report;
}
