import { describe, expect, it } from 'vitest';
import { Schedule } from '../src/domain/scheduler.js';
import { RelayMessage } from '../src/domain/relay-queue.js';
import { TickReport, TickerPorts, runTick } from '../src/jobs/ticker.js';

const NOW = '2026-11-01T00:02:30.000Z';
const T0 = '2026-11-01T00:00:00.000Z';

function schedule(over: Partial<Schedule> = {}): Schedule {
  return {
    id: 's1',
    kind: 'shift',
    ref: 'eng.product',
    tier: 'eng.product',
    everySeconds: 60,
    priority: 'normal',
    catchUp: 'coalesce',
    enabled: true,
    nextDueAt: T0,
    ...over,
  };
}

function message(over: Partial<RelayMessage> = {}): RelayMessage {
  return {
    id: 'm1',
    from: 'brand.social',
    to: 'eng.product',
    crossing: 'brand-to-eng',
    kind: 'proposal',
    dedupeKey: 'd1',
    payloadRef: 'artifact://sha256:abc',
    seq: 1,
    priority: 'normal',
    state: 'queued',
    attempts: 0,
    maxAttempts: 8,
    createdAt: T0,
    expiresAt: '2026-11-02T00:00:00.000Z',
    nextAttemptAt: T0,
    path: [],
    ...over,
  };
}

interface Harness extends TickerPorts {
  saves: Schedule[];
  relaySaves: RelayMessage[];
  wakes: string[][];
  heartbeats: { at: string; tickCount: number; lagMs: number }[];
}

function harness(opts: {
  schedules?: Schedule[];
  relay?: RelayMessage[];
  locked?: boolean;
  outcome?: 'ack' | 'nack';
}): Harness {
  const saves: Schedule[] = [];
  const relaySaves: RelayMessage[] = [];
  const wakes: string[][] = [];
  const heartbeats: { at: string; tickCount: number; lagMs: number }[] = [];
  return {
    saves,
    relaySaves,
    wakes,
    heartbeats,
    tryLock: async () => opts.locked ?? true,
    loadSchedules: async () => opts.schedules ?? [],
    saveSchedule: async (s) => void saves.push(s),
    emitWake: async (_s, fired) => void wakes.push(fired),
    loadRelay: async () => opts.relay ?? [],
    saveRelay: async (m) => void relaySaves.push(m),
    deliver: async () => opts.outcome ?? 'ack',
    heartbeat: async (h) => void heartbeats.push(h),
  };
}

describe('the tick', () => {
  it('exits quietly when another ticker holds the lock', async () => {
    const h = harness({ locked: false, schedules: [schedule()] });
    const report = await runTick(h, { now: NOW });
    expect(report.locked).toBe(false);
    expect(h.saves).toHaveLength(0);
    expect(h.heartbeats).toHaveLength(0);
  });

  it('fires a due schedule once and advances it past now', async () => {
    const h = harness({ schedules: [schedule()] });
    const report = await runTick(h, { now: NOW });
    expect(report.fired).toBe(1);
    expect(h.wakes).toEqual([[T0]]);
    expect(h.saves[0]!.nextDueAt).toBe('2026-11-01T00:03:00.000Z');
  });

  it('advances a skip schedule without firing it', async () => {
    const h = harness({ schedules: [schedule({ catchUp: 'skip' })] });
    const report = await runTick(h, { now: NOW });
    expect(report.fired).toBe(0);
    expect(h.wakes).toHaveLength(0);
    expect(h.saves[0]!.nextDueAt).toBe('2026-11-01T00:03:00.000Z');
  });

  it('leaves a schedule alone when it is not due', async () => {
    const h = harness({ schedules: [schedule({ nextDueAt: '2026-11-05T00:00:00.000Z' })] });
    const report = await runTick(h, { now: NOW });
    expect(report.schedulesDue).toBe(0);
    expect(h.saves).toHaveLength(0);
  });

  it('delivers a queued message and settles it', async () => {
    const h = harness({ relay: [message()] });
    const report = await runTick(h, { now: NOW });
    expect(report.relayLeased).toBe(1);
    expect(report.relayDelivered).toBe(1);
    const states = h.relaySaves.map((m) => m.state);
    expect(states).toContain('leased');
    expect(states.at(-1)).toBe('delivered');
  });

  it('retries a failed delivery instead of dropping it', async () => {
    const h = harness({ relay: [message()], outcome: 'nack' });
    const report = await runTick(h, { now: NOW });
    expect(report.relayRetried).toBe(1);
    expect(h.relaySaves.at(-1)!.state).toBe('queued');
  });

  it('expires a message past its ttl without delivering it', async () => {
    const h = harness({ relay: [message({ expiresAt: '2026-11-01T00:00:01.000Z' })] });
    const report = await runTick(h, { now: NOW });
    expect(report.relayExpired).toBe(1);
    expect(report.relayLeased).toBe(0);
  });

  it('writes a heartbeat with the lag it measured', async () => {
    const h = harness({ schedules: [schedule()] });
    const report: TickReport = await runTick(h, { now: NOW, tickCount: 7 });
    expect(h.heartbeats).toHaveLength(1);
    expect(h.heartbeats[0]!.tickCount).toBe(7);
    expect(h.heartbeats[0]!.lagMs).toBe(report.lagMs);
  });
});
