import { Schedule, advance, lagMs, missedSlots, selectDue } from '../domain/scheduler.js';
import { RelayMessage, expireIfPast, isVisible, lease, nack, reclaim } from '../domain/relay-queue.js';

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
  heartbeat(h: { at: string; tickCount: number; lagMs: number }): Promise<void>;
}

export interface TickOptions {
  now: string;
  maxSchedules?: number;
  relayBatch?: number;
  leaseTtlMs?: number;
  tickCount?: number;
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
    lagMs: lagMs(schedules, now),
  };

  await ports.heartbeat({ at: now, tickCount: opts.tickCount ?? 0, lagMs: report.lagMs });
  return report;
}
