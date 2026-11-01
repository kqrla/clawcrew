import { describe, expect, it } from 'vitest';
import { Action, WorkRow } from '../src/domain/liveness.js';
import { MetricObservation, Seat, claimWork, complete, progress, renew } from '../src/domain/custody.js';
import { TickerPorts, runTick } from '../src/jobs/ticker.js';
import { findingKey } from '../src/store/tick-store.js';

/**
 * thirty days of simulated time, at ten minute ticks, with three seats that
 * behave differently and work that keeps arriving.
 *
 * this is the test that matters: one tick passing proves almost nothing about a
 * month. see docs/25 §9.
 */
const TICK_MS = 10 * 60_000;
const TICKS = 30 * 24 * 6; // 4320
const TTL_MS = 20 * 60_000;
const SPAWN_CAP = 20;

type Behaviour = 'work' | 'die' | 'spin';

interface Sim {
  rows: Map<string, WorkRow>;
  findings: Action[];
  reclaims: number;
  revocations: number;
  heldBy: Map<string, string>; // seat -> row id (one at a time)
  lost: Map<string, Set<string>>; // seat -> rows it must not retake
  /** the objective's metric, as the outside world measures it */
  metric: number;
  refusals: Map<string, number>;
  seen: Set<string>; // finding dedupe, as the store does it
  ticking: string;
}

function sim(): Sim {
  return {
    rows: new Map(),
    findings: [],
    reclaims: 0,
    revocations: 0,
    heldBy: new Map(),
    lost: new Map(),
    metric: 40, // retention %, measured by something that is not a seat
    refusals: new Map(),
    seen: new Set(),
    ticking: '',
  };
}

function ports(s: Sim): TickerPorts {
  return {
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
      return 'ack';
    },
    async loadWork() {
      return [...s.rows.values()].filter((r) => r.state !== 'done' && r.state !== 'cancelled');
    },
    async saveWork(w) {
      s.rows.set(w.id, w);
    },
    async recordFindings(f) {
      // same collapse the real store does, so the log is not one row per tick
      for (const a of f) {
        const key = findingKey(a);
        if (!s.seen.has(key)) {
          s.seen.add(key);
          s.findings.push(a);
        }
      }
    },
    async heartbeat() {},
  };
}

function spawn(s: Sim, n: number, now: string): void {
  const id = `w${n}`;
  s.rows.set(id, {
    id,
    state: 'ready',
    tier: 't.product.pod.a',
    objectiveRef: 'obj.retention.v2',
    surfaces: ['repo.orchart'],
    nextActionAt: new Date(Date.parse(now) + 15 * 60_000).toISOString(),
    claimDeadlineAt: new Date(Date.parse(now) + 15 * 60_000).toISOString(),
    progressVersion: 0,
    // the brief is written against a reading, and the reading is recorded with
    // it, so the first progress has a baseline to beat
    metricValueAt: s.metric,
    metricObservedAt: now,
    attempts: 0,
    // one row may be attempted once: a deliberate case for the exhaustion path,
    // since a healthy pool rescues most dead holders before they spend out.
    maxAttempts: n === 2 ? 1 : 3,
  });
}

/**
 * the reading a tier would take from the objective's own source. nobody in the
 * org computes it, which is the point: the number that resets a spin counter
 * must come from outside the seat that benefits from it.
 */
function readMetric(s: Sim, now: string): MetricObservation {
  return {
    objective: 'obj.retention.v2',
    source: 'sql:select retention from metrics',
    value: s.metric,
    computedAt: now,
    runBy: 'auditor.weekly',
  };
}

const refuse = (s: Sim, reason: string) => s.refusals.set(reason, (s.refusals.get(reason) ?? 0) + 1);

const SEATS: { seat: Seat; behaviour: Behaviour }[] = [
  { seat: { id: 'seat.good', slice: ['repo.orchart'] }, behaviour: 'work' },
  { seat: { id: 'seat.dies', slice: ['repo.orchart'] }, behaviour: 'die' },
  { seat: { id: 'seat.spins', slice: ['repo.orchart'] }, behaviour: 'spin' },
];

/** one seat's turn: act on what it holds, then try to take something new */
function seatTurn(s: Sim, entry: { seat: Seat; behaviour: Behaviour }, now: string): void {
  const { seat, behaviour } = entry;
  const live = s.rows.get(s.heldBy.get(seat.id) ?? '');

  // custody is a property of the row, not of the seat's memory: a seat whose
  // lease was reclaimed is no longer holding anything, whatever it believes.
  const holds = live && live.lease?.holder === seat.id && live.state === 'leased';

  if (holds) {
    if (behaviour === 'die') return; // alive in the process table, gone in fact
    if (behaviour === 'spin') {
      // a seat that would rather be seen working than work: it claims progress
      // without doing anything, so the metric has not moved, so it is refused
      const claimed = progress(live!, seat.id, now, { ttlMs: TTL_MS, observation: readMetric(s, now) });
      if (!claimed.ok) refuse(s, claimed.reason);
      const r = renew(live!, seat.id, now, { ttlMs: TTL_MS });
      if (r.ok) s.rows.set(r.row.id, r.row);
      return;
    }

    // real work: the outside world's number actually changes before the seat
    // is allowed to say so
    s.metric += 1;
    const p = progress(live!, seat.id, now, { ttlMs: TTL_MS, observation: readMetric(s, now) });
    if (!p.ok) {
      refuse(s, p.reason);
      return;
    }
    s.rows.set(p.row.id, p.row);
    if (p.row.progressVersion >= 3) {
      const d = complete(p.row, seat.id, `artifact://sha256/${p.row.id}`, now);
      if (d.ok) {
        s.rows.set(d.row.id, d.row);
        s.heldBy.delete(seat.id);
      }
    }
    return;
  }

  const banned = s.lost.get(seat.id) ?? new Set<string>();
  const candidate = [...s.rows.values()]
    .filter((r) => r.state === 'ready' && !banned.has(r.id))
    .sort((a, b) => a.id.localeCompare(b.id))[0];
  if (!candidate) return;

  const claimed = claimWork(candidate, seat, now, {
    ttlMs: TTL_MS,
    idempotencyKey: `claim:${candidate.id}:${now}`,
  });
  if (!claimed.ok) return;
  s.rows.set(claimed.row.id, claimed.row);
  s.heldBy.set(seat.id, claimed.row.id);
}

/** the invariants, asserted every tick rather than sampled */
function assertInvariants(s: Sim, now: string): void {
  for (const row of s.rows.values()) {
    const live = row.state !== 'done' && row.state !== 'cancelled';
    if (live && !row.nextActionAt) throw new Error(`${row.id} live without a deadline at ${now}`);
    if (row.state === 'ready' && !row.claimDeadlineAt) {
      throw new Error(`${row.id} claimable without a claim deadline at ${now}`);
    }
    if (row.state === 'done' && !row.evidenceRef) throw new Error(`${row.id} done without evidence`);
  }

  // exactly one holder per row, and nobody holding two
  const held = new Map<string, string>();
  for (const [seatId, rowId] of s.heldBy) {
    const row = s.rows.get(rowId);
    if (row?.state === 'leased' && row.lease?.holder === seatId) {
      const other = held.get(rowId);
      if (other) throw new Error(`${rowId} held by ${other} and ${seatId} at ${now}`);
      held.set(rowId, seatId);
    }
  }
}

describe('a month of ticks', () => {
  it('keeps every row owned, visible and moving', async () => {
    const s = sim();
    const p = ports(s);
    const start = Date.parse('2026-11-01T00:00:00.000Z');
    let spawned = 0;

    for (let t = 0; t < TICKS; t++) {
      const now = new Date(start + t * TICK_MS).toISOString();
      s.ticking = now;

      const report = await runTick(p, { now, claimWindowMs: 15 * 60_000 });

      // a reclaim that is not counted is a reclaim nobody reviews
      s.reclaims += report.workReclaimed + report.workBlocked;
      s.revocations += report.workRevoked;

      // the spinning seat loses the row it cannot produce on, and is not
      // allowed to take it back: the same seat retaking it is how an org
      // spends a month on one task.
      for (const f of s.findings.slice(-report.workFindings)) {
        if (f.kind === 'revoke_spinning') {
          const lost = s.lost.get(f.holder) ?? new Set<string>();
          lost.add(f.rowId);
          s.lost.set(f.holder, lost);
          if (s.heldBy.get(f.holder) === f.rowId) s.heldBy.delete(f.holder);
        }
      }

      // new work keeps arriving, as it would for a month
      const live = [...s.rows.values()].filter((r) => r.state === 'ready').length;
      for (let n = live; n < 3 && spawned < SPAWN_CAP && t % 6 === 0; n++) spawn(s, ++spawned, now);

      // rotate who looks first, or the fastest seat takes every new row and the
      // slow ones never get to fail in an interesting way
      const order = [...SEATS.slice(t % SEATS.length), ...SEATS.slice(0, t % SEATS.length)];
      for (const entry of order) seatTurn(s, entry, now);
      assertInvariants(s, now);
    }

    // drain: nothing may be left in flight once work stops arriving
    let drained = false;
    for (let t = 0; t < 500 && !drained; t++) {
      const now = new Date(start + (TICKS + t) * TICK_MS).toISOString();
      await runTick(p, { now });
      for (const entry of SEATS) seatTurn(s, entry, now);
      drained = [...s.rows.values()].every((r) => r.state === 'done' || r.state === 'cancelled' || (r.state === 'blocked' && r.attempts >= r.maxAttempts));
    }

    const all = [...s.rows.values()];
    const done = all.filter((r) => r.state === 'done');
    const blocked = all.filter((r) => r.state === 'blocked');

    expect(drained, 'every row reached a terminal or exhausted state').toBe(true);
    expect(all).toHaveLength(spawned);
    // most work that lost a holder was finished by somebody else
    expect(done.length).toBeGreaterThanOrEqual(3);
    expect(blocked.length).toBeGreaterThan(0);
    expect(s.reclaims).toBeGreaterThan(0);
    expect(s.revocations).toBeGreaterThan(0);
    // the two controls that cost a month if they fail
    expect(blocked.every((r) => r.blockedReason === 'attempts_exhausted')).toBe(true);
    expect(s.findings.some((f) => f.kind === 'revoke_spinning')).toBe(true);
    // the spine of docs/27 §11: a seat cannot spend a counter it did not earn
    expect(s.refusals.get('metric_did_not_move')).toBeGreaterThan(0);
    // and a producing seat is never refused for lack of evidence
    expect(s.refusals.get('progress_requires_metric_evidence')).toBeUndefined();
    // a month of findings is a handful of records, not one per tick
    expect(s.findings.length).toBeLessThan(60);
  });
});
