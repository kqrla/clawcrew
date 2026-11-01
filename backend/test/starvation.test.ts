import { describe, expect, it } from 'vitest';
import { Action, WorkRow, applyAction, sweep } from '../src/domain/liveness.js';
import { TickerPorts, runTick } from '../src/jobs/ticker.js';
import { policiesFromSeed } from '../src/domain/budget.js';

/**
 * docs/25 #9. a per-tick deferred count cannot see starvation: the report says
 * "2 deferred" every tick for a month while the same two rows never move. the
 * counter lives on the row, and the alarm is what turns it into a finding.
 */
const NOW = '2026-11-01T12:00:00.000Z';
const past = (m: number) => new Date(Date.parse(NOW) - m * 60_000).toISOString();
const future = (m: number) => new Date(Date.parse(NOW) + m * 60_000).toISOString();

function ready(over: Partial<WorkRow> = {}): WorkRow {
  return {
    id: 'w1',
    state: 'ready',
    tier: 't.product.pod.a',
    objectiveRef: 'obj.retention.v2',
    surfaces: ['repo.orchart'],
    nextActionAt: future(10),
    claimDeadlineAt: future(10),
    progressVersion: 0,
    attempts: 0,
    maxAttempts: 3,
    deferredTicks: 0,
    ...over,
  };
}

describe('the sweep sees starvation', () => {
  it('says nothing about a row that has been skipped once or twice', () => {
    expect(sweep([ready({ deferredTicks: 2 })], { now: NOW })).toEqual([]);
  });

  it('alarms on the third consecutive skip', () => {
    const actions = sweep([ready({ deferredTicks: 3 })], { now: NOW });
    expect(actions).toEqual([
      { kind: 'alarm_starved', rowId: 'w1', tier: 't.product.pod.a', deferredTicks: 3 },
    ]);
  });

  it('honours a configured limit', () => {
    expect(sweep([ready({ deferredTicks: 2 })], { now: NOW, starveLimit: 2 })).toHaveLength(1);
    expect(sweep([ready({ deferredTicks: 4 })], { now: NOW, starveLimit: 5 })).toEqual([]);
  });

  it('stays quiet for a while after alarming, instead of shouting every tick', () => {
    const row = ready({ deferredTicks: 6, starvedAt: past(10) });
    expect(sweep([row], { now: NOW })).toEqual([]);
    expect(sweep([row], { now: NOW, starveRearmMs: 60_000 })).toHaveLength(1);
  });

  it('still reports the row own faults in the same pass', () => {
    const kinds = sweep([ready({ deferredTicks: 3, claimDeadlineAt: past(1) })], { now: NOW }).map(
      (a) => a.kind,
    );
    expect(kinds).toContain('alarm_starved');
    expect(kinds).toContain('alarm_unclaimable');
  });

  it('does not alarm about a finished row nobody needs to pick up', () => {
    const done = ready({ state: 'done', deferredTicks: 9, evidenceRef: 'artifact://sha256/abc' });
    expect(sweep([done], { now: NOW })).toEqual([]);
  });
});

describe('re-arming starvation', () => {
  it('resets the counter and stamps the alarm, and moves nothing else', () => {
    const row = ready({ deferredTicks: 5 });
    const action: Action = { kind: 'alarm_starved', rowId: 'w1', tier: row.tier, deferredTicks: 5 };
    const next = applyAction(row, action, NOW);
    expect(next?.deferredTicks).toBe(0);
    expect(next?.starvedAt).toBe(NOW);
    expect(next?.claimDeadlineAt).toBe(row.claimDeadlineAt);
    expect(next?.state).toBe('ready');
  });

  it('clears the counter when the row finally moves', () => {
    const leased = ready({
      state: 'leased',
      claimDeadlineAt: undefined,
      lease: { holder: 'seat.a', expiresAt: past(5), renewals: 0 },
      deferredTicks: 4,
    });
    const next = applyAction(
      leased,
      { kind: 'reclaim_expired', rowId: 'w1', holder: 'seat.a', nextAttempts: 1 },
      NOW,
    );
    expect(next?.state).toBe('ready');
    expect(next?.deferredTicks).toBe(0);
  });
});

describe('the tick counts skips on the row', () => {
  function harness(rows: WorkRow[]): TickerPorts & { saved: WorkRow[]; findings: Action[][] } {
    const saved: WorkRow[] = [];
    const findings: Action[][] = [];
    const state = new Map(rows.map((r) => [r.id, r]));
    return {
      saved,
      findings,
      async tryLock() {
        return true;
      },
      async loadSchedules() {
        return [];
      },
      async saveSchedule() {},
      async emitWake() {},
      async loadRelay() {
        return [];
      },
      async saveRelay() {},
      async deliver() {
        return 'ack' as const;
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
    } as unknown as TickerPorts & { saved: WorkRow[]; findings: Action[][] };
  }

  it('bumps the counter on rows the budget pushed out, and only those', async () => {
    const dead = (id: string) =>
      ready({
        id,
        state: 'leased',
        claimDeadlineAt: undefined,
        lease: { holder: 'seat.a', expiresAt: past(5), renewals: 0 },
      });
    const ports = harness([dead('a'), dead('b'), dead('c')]);
    const report = await runTick(ports, { now: NOW, workBudget: 1 });

    expect(report.workDeferred).toBe(2);
    const bumped = ports.saved.filter((r) => r.state !== 'ready');
    expect(bumped.map((r) => r.id)).toEqual(['b', 'c']);
    expect(bumped.every((r) => r.deferredTicks === 1)).toBe(true);
    expect(report.workStarved).toBe(0);
  });

  it('records the alarm once a row reaches the limit, and re-arms it', async () => {
    const row = ready({
      id: 'a',
      state: 'leased',
      claimDeadlineAt: undefined,
      lease: { holder: 'seat.a', expiresAt: future(30), renewals: 0 },
    });
    // starved, but not dead: the budget keeps skipping it because a dead row
    // with an earlier id always takes the transition first
    const starved = { ...row, id: 'b', deferredTicks: 3 };
    const ports = harness([row, starved]);
    const report = await runTick(ports, { now: NOW, workBudget: 5 });

    expect(report.workStarved).toBe(1);
    expect(ports.findings.flat().some((f) => f.kind === 'alarm_starved')).toBe(true);
    const rearmed = ports.saved.find((r) => r.id === 'b');
    expect(rearmed?.deferredTicks).toBe(0);
    expect(rearmed?.starvedAt).toBe(NOW);
  });
});

describe('a seed becomes an enforced policy', () => {
  it('turns dollars into cents and keeps the metric', () => {
    const { policies } = policiesFromSeed('t.root', { usd_per_day: 12.5 });
    expect(policies).toEqual([
      {
        id: 'bp.t.root.usd_cents.day',
        scope: 'tier',
        scopeId: 't.root',
        metric: 'usd_cents',
        window: 'day',
        amount: 1250,
        warnPercent: 0.8,
        hardStop: true,
      },
    ]);
  });

  it('prefers explicit cents when a seed carries both', () => {
    const { policies, ignored } = policiesFromSeed('t.root', { usd_cents_per_day: 900, usd_per_day: 99 });
    expect(policies.map((p) => p.amount)).toEqual([900]);
    expect(ignored).toContainEqual({ key: 'usd_per_day', reason: 'superseded_by_usd_cents_per_day' });
  });

  it('carries warn_percent and hard_stop through to every policy', () => {
    const { policies } = policiesFromSeed('t.root', {
      tokens_per_day: 2_000_000,
      tool_calls_per_day: 500,
      warn_percent: 0.5,
      hard_stop: false,
    });
    expect(policies.map((p) => p.metric)).toEqual(['tokens', 'tool_calls']);
    expect(policies.every((p) => p.warnPercent === 0.5 && p.hardStop === false)).toBe(true);
  });

  it('reports a key it did not understand instead of ignoring it', () => {
    const { policies, ignored } = policiesFromSeed('t.root', { usd_per_month: 500 });
    expect(policies).toEqual([]);
    expect(ignored).toEqual([{ key: 'usd_per_month', reason: 'unknown_key' }]);
  });

  it('refuses a negative or non-numeric limit', () => {
    const { policies, ignored } = policiesFromSeed('t.root', {
      usd_per_day: -5,
      tokens_per_day: 'lots',
    });
    expect(policies).toEqual([]);
    // both keys are reported: a limit the operator wrote and we could not use is
    // exactly the thing that must not disappear
    expect(ignored).toEqual([
      { key: 'usd_per_day', reason: 'amount_invalid' },
      { key: 'tokens_per_day', reason: 'amount_invalid' },
    ]);
  });

  it('survives a seed that is not an object at all', () => {
    expect(policiesFromSeed('t.root', null).ignored).toEqual([
      { key: '<seed>', reason: 'seed_is_not_an_object' },
    ]);
    expect(policiesFromSeed('t.root', [1, 2]).policies).toEqual([]);
  });

  it('an empty seed produces nothing, which the gap view reports', () => {
    expect(policiesFromSeed('t.root', {}).policies).toEqual([]);
  });
});
