/**
 * the scheduler decides *when*, never *what*. a tick emits wake events and
 * advances a row; policy lives in the domain modules. see docs/21.
 */
export type CatchUp = 'skip' | 'coalesce' | 'burst';
export type Priority = 'critical' | 'normal' | 'background';

export interface Schedule {
  id: string;
  kind: string;
  ref: string;
  tier: string;
  everySeconds: number;
  priority: Priority;
  catchUp: CatchUp;
  enabled: boolean;
  /** the scheduled instant, without jitter */
  nextDueAt: string;
  lastFiredAt?: string;
  lastFireKey?: string;
}

export const PRIORITY_ORDER: Record<Priority, number> = {
  critical: 0,
  normal: 1,
  background: 2,
};

const PRIORITIES: Priority[] = ['critical', 'normal', 'background'];

function hash32(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** deterministic, so it survives restarts and is reproducible in tests */
export function jitterSeconds(s: { kind: string; ref: string; everySeconds: number }): number {
  const window = Math.max(1, Math.min(300, Math.floor(s.everySeconds * 0.1)));
  return hash32(`${s.kind}:${s.ref}`) % window;
}

/** the instant a worker should actually wake. the stored instant stays clean. */
export function effectiveDueAt(s: Schedule): number {
  return Date.parse(s.nextDueAt) + jitterSeconds(s) * 1000;
}

export function isDue(s: Schedule, now: string): boolean {
  return s.enabled && Date.parse(now) >= effectiveDueAt(s);
}

export function fireKey(s: Schedule, scheduledAt: string): string {
  return `${s.kind}:${s.ref}:${scheduledAt}`;
}

/**
 * which missed runs, if any, should fire.
 * skip:    fire nothing, the gap is absorbed (shifts are covered by lease escalation)
 * coalesce: fire once for the whole gap
 * burst:   fire every missed slot in order, only for cheap idempotent kinds
 */
export function missedSlots(s: Schedule, now: string, limit = 1000): string[] {
  const period = s.everySeconds * 1000;
  const n = Date.parse(now);
  const slots: string[] = [];
  let t = Date.parse(s.nextDueAt);
  while (t <= n && slots.length < limit) {
    slots.push(new Date(t).toISOString());
    t += period;
  }
  if (slots.length === 0) return [];
  switch (s.catchUp) {
    case 'burst':
      return slots;
    case 'coalesce':
      return [slots[0]!];
    case 'skip':
      return [];
  }
}

/**
 * advance past now, firing from the scheduled instant rather than the execution
 * instant. advancing from `now` drifts the schedule forward on every slow tick.
 */
export function advance(s: Schedule, now: string, fired: string[]): Schedule {
  const period = s.everySeconds * 1000;
  const n = Date.parse(now);
  let t = Date.parse(s.nextDueAt);
  if (t > n) return s;
  const missed = Math.floor((n - t) / period) + 1;
  t += missed * period;
  const next = new Date(t).toISOString();
  if (fired.length === 0) return { ...s, nextDueAt: next };
  const last = fired[fired.length - 1]!;
  return {
    ...s,
    nextDueAt: next,
    lastFiredAt: new Date(n).toISOString(),
    lastFireKey: fireKey(s, last),
  };
}

/** aging: an item waiting more than three periods is promoted one class */
export function effectivePriority(s: Schedule, now: string): Priority {
  const waited = Date.parse(now) - effectiveDueAt(s);
  const stale = waited > s.everySeconds * 3000;
  if (!stale) return s.priority;
  const i = PRIORITIES.indexOf(s.priority);
  return PRIORITIES[Math.max(0, i - 1)]!;
}

/** the tick's selection: bounded, priority ordered, aged */
export function selectDue(list: Schedule[], now: string, maxPerTick: number): Schedule[] {
  const due = list.filter((s) => isDue(s, now));
  due.sort((a, b) => {
    const pa = PRIORITY_ORDER[effectivePriority(a, now)];
    const pb = PRIORITY_ORDER[effectivePriority(b, now)];
    if (pa !== pb) return pa - pb;
    return effectiveDueAt(a) - effectiveDueAt(b);
  });
  return due.slice(0, maxPerTick);
}

/** health is measured by lag, not by the process being alive */
export function lagMs(list: Schedule[], now: string): number {
  const due = list.filter((s) => isDue(s, now));
  if (due.length === 0) return 0;
  const oldest = Math.min(...due.map(effectiveDueAt));
  return Math.max(0, Date.parse(now) - oldest);
}

export function plan(s: Schedule, now: string): { fire: string[]; next: Schedule } {
  const fire = missedSlots(s, now);
  return { fire, next: advance(s, now, fire) };
}
