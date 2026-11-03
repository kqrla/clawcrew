/**
 * docs/34. four verbs, and the refusals that make them worth having.
 *
 * a seat is duplicable, freezable, thawable, burned. "stop" is not one of the verbs
 * because it conflates three situations that need different audits: paused, done,
 * and dead. an org that cannot tell those apart cannot say what is running.
 *
 * a refusal is a return value, not an exception: the tick has to handle "no" the
 * same way it handles "yes", and a thrown refusal becomes a crash somebody silences.
 */

export type SeatState = 'live' | 'frozen' | 'burned';

/** the capability a seat may exercise: a deployed function, and what it is bound to */
export interface Grant {
  function: string;
  scope: Record<string, string>;
}

export interface Seat {
  id: string;
  tier: string;
  /** the root of the lineage: the seat's reason for existing, shared by every copy */
  lineage: string;
  parentId: string | null;
  /** how many duplications from the root. a guard against runaway spawning */
  depth: number;
  state: SeatState;
  skills: string[];
  grants: Grant[];
  frozenAt?: string | null;
  frozenUntil?: string | null;
  burnedAt?: string | null;
  burnedReason?: string | null;
  orphaned?: boolean;
}

export const MAX_DEPTH = 3;
export const FROZEN_TTL_MS = 14 * 86_400_000;

export type Refusal =
  | 'seat_is_burned'
  | 'seat_is_frozen'
  | 'already_frozen'
  | 'not_frozen'
  | 'skill_not_granted'
  | 'grant_not_granted'
  | 'lineage_too_deep'
  | 'burn_needs_a_reason'
  | 'frozen_window_expired'
  | 'orphaned_seat_may_not_spawn';

export type Outcome<T> = { ok: true; seat: T } | { ok: false; reason: Refusal; detail?: unknown };

const at = (now: string): string => now;

/** a froze seat is not a live seat, and a burner seat is not a seat at all */
export const canWork = (seat: Seat): boolean => seat.state === 'live';

/**
 * duplicate: a child, not a copy.
 *
 * same lineage, strictly narrower grant. a child that could do something its parent
 * cannot is an escalation, and escalation is a human act delivered out of band, never
 * a spawn parameter.
 */
export function duplicate(
  parent: Seat,
  child: { id: string; skills?: string[]; grants?: Grant[]; now: string },
): Outcome<Seat> {
  if (parent.state === 'burned') return { ok: false, reason: 'seat_is_burned' };
  if (parent.state === 'frozen') return { ok: false, reason: 'seat_is_frozen' };
  if (parent.orphaned === true) return { ok: false, reason: 'orphaned_seat_may_not_spawn' };
  if (parent.depth + 1 > MAX_DEPTH) return { ok: false, reason: 'lineage_too_deep' };

  const skills = child.skills ?? parent.skills;
  const outside = skills.filter((s) => !parent.skills.includes(s));
  if (outside.length > 0) return { ok: false, reason: 'skill_not_granted', detail: { outside } };

  const grants = child.grants ?? parent.grants;
  const widened = grants.filter(
    (g) => !parent.grants.some((p) => p.function === g.function && covers(p.scope, g.scope)),
  );
  if (widened.length > 0) return { ok: false, reason: 'grant_not_granted', detail: { widened } };

  return {
    ok: true,
    seat: {
      id: child.id,
      tier: parent.tier,
      lineage: parent.lineage,
      parentId: parent.id,
      depth: parent.depth + 1,
      state: 'live',
      skills: [...skills],
      grants: grants.map((g) => ({ function: g.function, scope: { ...g.scope } })),
      frozenAt: null,
      frozenUntil: null,
      burnedAt: null,
      burnedReason: null,
      orphaned: false,
    },
  };
}

/** every key in the child's scope must exist in the parent's with the same value */
const covers = (parentScope: Record<string, string>, childScope: Record<string, string>): boolean =>
  Object.entries(childScope).every(([k, v]) => parentScope[k] === v);

/**
 * freeze: stop working, keep everything worth keeping, release the responsibility.
 *
 * the release matters. a frozen seat holding an on-call lease is an outage that
 * nobody has been told about yet.
 */
export function freeze(seat: Seat, opts: { now: string; ttlMs?: number }): Outcome<Seat> {
  if (seat.state === 'burned') return { ok: false, reason: 'seat_is_burned' };
  if (seat.state === 'frozen') return { ok: false, reason: 'already_frozen' };
  const ttl = opts.ttlMs ?? FROZEN_TTL_MS;
  return {
    ok: true,
    seat: {
      ...seat,
      state: 'frozen',
      frozenAt: at(opts.now),
      frozenUntil: new Date(Date.parse(opts.now) + ttl).toISOString(),
    },
  };
}

/**
 * thaw: resume with the same grant, if the freeze is still a freeze.
 *
 * state older than the window is archaeology: the tools moved, the objective may have
 * been superseded, the lease is somebody else's now. the honest move is a re-spawn
 * against the current ledger, so the refusal says that instead of quietly resuming.
 */
export function thaw(seat: Seat, opts: { now: string }): Outcome<Seat> {
  if (seat.state === 'burned') return { ok: false, reason: 'seat_is_burned' };
  if (seat.state !== 'frozen') return { ok: false, reason: 'not_frozen' };
  if (seat.frozenUntil && Date.parse(opts.now) > Date.parse(seat.frozenUntil)) {
    return { ok: false, reason: 'frozen_window_expired', detail: { frozenUntil: seat.frozenUntil } };
  }
  return {
    ok: true,
    seat: { ...seat, state: 'live', frozenAt: null, frozenUntil: null },
  };
}

/**
 * burn: terminal, and the only verb that cannot be undone.
 *
 * it needs a reason because "we tried that and it failed" is the single most useful
 * thing in the history, and an unexplained burn is indistinguishable from a bug.
 * capabilities may be re-granted to a fresh seat; this seat does not come back.
 */
export function burn(seat: Seat, opts: { now: string; reason: string }): Outcome<Seat> {
  if (seat.state === 'burned') return { ok: false, reason: 'seat_is_burned' };
  const reason = opts.reason.trim();
  if (reason.length < 3) return { ok: false, reason: 'burn_needs_a_reason' };
  return {
    ok: true,
    seat: { ...seat, state: 'burned', burnedAt: at(opts.now), burnedReason: reason, frozenAt: null, frozenUntil: null },
  };
}

/** burning a parent orphans its live children: they finish, they do not multiply */
export function orphan(seat: Seat): Seat {
  return seat.state === 'live' ? { ...seat, orphaned: true } : seat;
}
