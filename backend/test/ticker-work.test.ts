import { describe, expect, it } from 'vitest';
import { Schedule } from '../src/domain/scheduler.js';
import { RelayMessage } from '../src/domain/relay-queue.js';
import { Action, WorkRow } from '../src/domain/liveness.js';
import { TickerPorts, runTick } from '../src/jobs/ticker.js';

const NOW = '2026-11-01T12:00:00.000Z';
const past = (m: number) => new Date(Date.parse(NOW) - m * 60_000).toISOString();
const future = (m: number) => new Date(Date.parse(NOW) + m * 60_000).toISOString();

function work(over: Partial<WorkRow> = {}): WorkRow {
  return {
    id: 'w1',
    state: 'leased',
    tier: 't.product.pod.a',
    objectiveRef: 'obj.retention.v2',
    surfaces: ['repo.orchart'],
    nextActionAt: future(30),
    lease: { holder: 'seat.a', expiresAt: future(5), renewals: 0 },
    progressVersion: 1,
    attempts: 0,
    maxAttempts: 3,
    ...over,
  };
}

interface Harness extends TickerPorts {
  saved: WorkRow[];
  findings: Action[][];
}

function harness(rows: WorkRow[], opts: { claimWindowMs?: number } = {}): Harness {
  const saved: WorkRow[] = [];
  const findings: Action[][] = [];
  const state = new Map(rows.map((r) => [r.id, r]));

  return {
    saved,
    findings,
    claimWindowMs: opts.claimWindowMs,
    async tryLock() {
      return true;
    },
    async loadSchedules(): Promise<Schedule[]> {
      return [];
    },
    async saveSchedule() {},
    async emitWake() {},
    async loadRelay(): Promise<RelayMessage[]> {
      return [];
    },
    async saveRelay() {},
    async deliver() {
      return 'ack';
    },
    async loadWork() {
      return [...state.values()];
    },
    async saveWork(w: WorkRow) {
      saved.push(w);
      state.set(w.id, w);
    },
    async recordFindings(f: Action[]) {
      findings.push(f);
    },
    async heartbeat() {},
  } as unknown as Harness;
}

describe('the tick runs the sweep', () => {
  it('reclaims dead custody and re-arms the row', async () => {
    const h = harness([work({ lease: { holder: 'seat.a', expiresAt: past(1), renewals: 0 } })]);
    const report = await runTick(h, { now: NOW, claimWindowMs: 600_000 });

    expect(report.workSwept).toBe(1);
    expect(report.workReclaimed).toBe(1);
    expect(report.workFindings).toBe(0);

    const [row] = h.saved;
    expect(row!.state).toBe('ready');
    expect(row!.attempts).toBe(1);
    expect(row!.lease).toBeUndefined();
    // a reclaimed row is claimable and carries its own alarm deadline
    expect(row!.claimDeadlineAt).toBe('2026-11-01T12:10:00.000Z');
    expect(row!.nextActionAt).toBe('2026-11-01T12:10:00.000Z');
  });

  it('blocks in the same tick when the reclaim exhausts attempts', async () => {
    const h = harness([
      work({ attempts: 2, maxAttempts: 3, lease: { holder: 'seat.a', expiresAt: past(1), renewals: 0 } }),
    ]);
    const report = await runTick(h, { now: NOW });

    expect(report.workBlocked).toBe(1);
    expect(h.saved[0]!.state).toBe('blocked');
    expect(h.saved[0]!.blockedReason).toBe('attempts_exhausted');
    expect(h.saved[0]!.attempts).toBe(3);
  });

  it('revokes a holder that renews without producing', async () => {
    const h = harness([work({ lease: { holder: 'seat.a', expiresAt: future(5), renewals: 3 } })]);
    const report = await runTick(h, { now: NOW });

    expect(report.workRevoked).toBe(1);
    expect(h.saved[0]!.state).toBe('ready');
    expect(h.saved[0]!.attempts).toBe(1);
  });

  it('honours a per-objective renewal limit', async () => {
    const h = harness([work({ lease: { holder: 'seat.a', expiresAt: future(5), renewals: 3 } })]);
    const report = await runTick(h, { now: NOW, stuckRenewalLimit: 5 });
    expect(report.workRevoked).toBe(0);
    expect(h.saved).toEqual([]);
  });

  it('records an unclaimable row as a finding instead of mutating it', async () => {
    const unclaimable = work({
      state: 'ready',
      lease: undefined,
      claimDeadlineAt: past(3),
      nextActionAt: future(30),
    });
    const h = harness([unclaimable]);
    const report = await runTick(h, { now: NOW });

    expect(report.workFindings).toBe(1);
    expect(report.workSwept).toBe(0);
    expect(h.saved).toEqual([]);
    expect(h.findings[0]![0]).toMatchObject({ kind: 'alarm_unclaimable', rowId: 'w1' });
  });

  it('does not repair a structurally invalid row, it reports it', async () => {
    const broken = work({ nextActionAt: undefined });
    const h = harness([broken]);
    const report = await runTick(h, { now: NOW });

    expect(report.workFindings).toBe(1);
    expect(h.findings[0]![0]).toEqual({
      kind: 'violation',
      rowId: 'w1',
      rule: 'missing_next_action',
    });
    expect(h.saved).toEqual([]);
  });

  it('leaves a healthy org untouched', async () => {
    const h = harness([work(), work({ id: 'w2', state: 'blocked', lease: undefined, nextActionAt: future(60) })]);
    const report = await runTick(h, { now: NOW });

    expect(report.workSwept).toBe(0);
    expect(report.workFindings).toBe(0);
    expect(h.saved).toEqual([]);
  });

  it('still ticks when no work ports are wired', async () => {
    const h = harness([]);
    delete (h as Partial<TickerPorts>).loadWork;
    const report = await runTick(h, { now: NOW });
    expect(report.locked).toBe(true);
    expect(report.workSwept).toBe(0);
  });

  it('does nothing when the lock is held elsewhere', async () => {
    const h = harness([work({ lease: { holder: 'seat.a', expiresAt: past(1), renewals: 0 } })]);
    h.tryLock = async () => false;
    const report = await runTick(h, { now: NOW });
    expect(report.locked).toBe(false);
    expect(h.saved).toEqual([]);
  });
});
