/**
 * the temporal axis of the hmas taxonomy (moore, arxiv:2508.12683) separates
 * long-horizon decision layers from short-horizon execution layers.
 *
 * orchart had cadence but not horizon. a weekly review is not a planning window:
 * every circle in v0.2 reviewed on some cadence while committing to objectives of
 * any length, so a team on a one-day shift could promise a 30-day outcome it had
 * no authority to see through. that is a drift mechanism, not a scheduling detail.
 *
 * the rule below is the whole fix: commitment length must not exceed the horizon
 * of the circle that commits, and a circle must not plan longer than its parent.
 */
export type Horizon = 'shift' | 'week' | 'month' | 'quarter';

export const HORIZON_DAYS: Record<Horizon, number> = {
  shift: 1,
  week: 7,
  month: 31,
  quarter: 92,
};

export interface HorizonedCircle {
  id: string;
  parent: string | null;
  horizon: Horizon;
}

export interface HorizonedObjective {
  id: string;
  ownerCircle: string;
  horizon: Horizon;
}

export function compareHorizon(a: Horizon, b: Horizon): number {
  return HORIZON_DAYS[a] - HORIZON_DAYS[b];
}

/** the shorter of two horizons. used when the effective window must be the intersection. */
export function narrowest(...hs: Horizon[]): Horizon {
  return hs.reduce((acc, h) => (HORIZON_DAYS[h] < HORIZON_DAYS[acc] ? h : acc));
}

export type CommitVerdict = { ok: true } | { ok: false; reason: 'objective_outlives_circle' };

/**
 * a circle may commit to an objective no longer than its own horizon.
 * shorter is always allowed: a quarter-level department can take on a week of work.
 */
export function canCommit(circle: HorizonedCircle, objective: HorizonedObjective): CommitVerdict {
  if (HORIZON_DAYS[objective.horizon] > HORIZON_DAYS[circle.horizon]) {
    return { ok: false, reason: 'objective_outlives_circle' };
  }
  return { ok: true };
}

/**
 * a child cannot plan longer than its parent. the reverse is fine.
 * violations are configuration defects, reported at load, never at runtime.
 */
export function validateHorizonChain(circles: HorizonedCircle[]): string[] {
  const byId = new Map(circles.map((c) => [c.id, c]));
  const problems: string[] = [];
  for (const c of circles) {
    if (c.parent === null) continue;
    const parent = byId.get(c.parent);
    if (!parent) {
      problems.push(`unknown_parent:${c.id}->${c.parent}`);
      continue;
    }
    if (HORIZON_DAYS[c.horizon] > HORIZON_DAYS[parent.horizon]) {
      problems.push(`horizon_exceeds_parent:${c.id}`);
    }
  }
  return problems;
}

/**
 * the window a commitment actually gets, in days, bounded by the circle, the
 * objective and every ancestor. this is what a lease or shift should be sized to.
 */
export function effectiveWindowDays(
  circleId: string,
  circles: HorizonedCircle[],
  objective: HorizonedObjective,
): number {
  const byId = new Map(circles.map((c) => [c.id, c]));
  let h: Horizon = objective.horizon;
  let cur = byId.get(circleId);
  while (cur) {
    h = narrowest(h, cur.horizon);
    cur = cur.parent === null ? undefined : byId.get(cur.parent);
  }
  return HORIZON_DAYS[h];
}
