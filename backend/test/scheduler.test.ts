import { describe, expect, it } from 'vitest';
import {
  Schedule,
  advance,
  effectiveDueAt,
  effectivePriority,
  isDue,
  jitterSeconds,
  lagMs,
  missedSlots,
  plan,
  selectDue,
} from '../src/domain/scheduler.js';

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

describe('scheduler', () => {
  it('jitters deterministically and inside the window', () => {
    const j = jitterSeconds({ kind: 'shift', ref: 'eng.product', everySeconds: 600 });
    expect(j).toBe(jitterSeconds({ kind: 'shift', ref: 'eng.product', everySeconds: 600 }));
    expect(j).toBeGreaterThanOrEqual(0);
    expect(j).toBeLessThan(60);
  });

  it('is due at the scheduled instant plus jitter', () => {
    const s = schedule();
    const j = jitterSeconds(s);
    expect(isDue(s, new Date(Date.parse(T0) + j * 1000 - 1).toISOString())).toBe(false);
    expect(isDue(s, new Date(Date.parse(T0) + j * 1000).toISOString())).toBe(true);
  });

  it('a disabled schedule never fires', () => {
    expect(isDue(schedule({ enabled: false }), '2027-01-01T00:00:00.000Z')).toBe(false);
  });

  it('skip absorbs a missed gap without firing', () => {
    const s = schedule({ catchUp: 'skip' });
    expect(missedSlots(s, '2026-11-01T05:00:00.000Z')).toEqual([]);
  });

  it('coalesce fires once for the whole gap', () => {
    const s = schedule({ catchUp: 'coalesce' });
    const fired = missedSlots(s, '2026-11-01T05:00:00.000Z');
    expect(fired).toEqual([T0]);
  });

  it('burst replays every missed slot in order', () => {
    const s = schedule({ catchUp: 'burst' });
    const fired = missedSlots(s, '2026-11-01T00:03:30.000Z');
    expect(fired).toHaveLength(4);
    expect(fired[0]).toBe(T0);
    expect(fired[3]).toBe('2026-11-01T00:03:00.000Z');
  });

  it('advances from the scheduled instant, not from now', () => {
    const s = schedule();
    const next = advance(s, '2026-11-01T00:02:30.000Z', [T0]);
    expect(next.nextDueAt).toBe('2026-11-01T00:03:00.000Z');
    expect(next.lastFireKey).toBe('shift:eng.product:2026-11-01T00:00:00.000Z');
  });

  it('a tick that fired nothing does not claim a fire', () => {
    const s = schedule({ catchUp: 'skip' });
    const next = advance(s, '2026-11-01T00:02:30.000Z', []);
    expect(next.nextDueAt).toBe('2026-11-01T00:03:00.000Z');
    expect(next.lastFireKey).toBeUndefined();
    expect(next.lastFiredAt).toBeUndefined();
  });

  it('advance is a no-op when nothing is due', () => {
    const s = schedule();
    expect(advance(s, '2026-10-31T23:59:00.000Z', [])).toBe(s);
  });

  it('orders by priority then due time', () => {
    const bg = schedule({ id: 'bg', priority: 'background', nextDueAt: T0 });
    const crit = schedule({ id: 'crit', priority: 'critical', nextDueAt: T0 });
    const picked = selectDue([bg, crit], '2026-11-01T00:02:00.000Z', 2);
    expect(picked.map((s) => s.id)).toEqual(['crit', 'bg']);
  });

  it('ages a starved item up one class', () => {
    const old = schedule({ priority: 'background', nextDueAt: T0 });
    expect(effectivePriority(old, '2026-11-01T00:10:00.000Z')).toBe('normal');
  });

  it('bounds the tick', () => {
    const many = Array.from({ length: 10 }, (_, i) => schedule({ id: `s${i}` }));
    expect(selectDue(many, '2026-11-01T00:02:00.000Z', 3)).toHaveLength(3);
  });

  it('reports lag against the oldest due instant', () => {
    const s = schedule();
    const now = '2026-11-01T00:05:00.000Z';
    expect(lagMs([s], now)).toBe(Date.parse(now) - effectiveDueAt(s));
    expect(lagMs([], now)).toBe(0);
  });

  it('plans fire and advance together', () => {
    const { fire, next } = plan(schedule(), '2026-11-01T00:02:30.000Z');
    expect(fire).toEqual([T0]);
    expect(next.nextDueAt).toBe('2026-11-01T00:03:00.000Z');
  });
});
