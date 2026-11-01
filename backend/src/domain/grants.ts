// a grant set is the unit of authority. tools are sorted arrays so the value is
// deterministic and safe to hash, diff and log.
export interface GrantSet {
  tools: string[];
  /** undefined means "this level does not constrain spend". the root ceiling must set it. */
  spendUsdPerDay?: number;
}

export function normalize(g: GrantSet): GrantSet {
  const tools = [...new Set(g.tools)].sort();
  return g.spendUsdPerDay === undefined ? { tools } : { tools, spendUsdPerDay: g.spendUsdPerDay };
}

export function intersect(a: GrantSet, b: GrantSet): GrantSet {
  const allowed = new Set(b.tools);
  const spend =
    a.spendUsdPerDay === undefined
      ? b.spendUsdPerDay
      : b.spendUsdPerDay === undefined
        ? a.spendUsdPerDay
        : Math.min(a.spendUsdPerDay, b.spendUsdPerDay);
  return normalize({
    tools: a.tools.filter((t) => allowed.has(t)),
    ...(spend === undefined ? {} : { spendUsdPerDay: spend }),
  });
}

export function subset(child: GrantSet, parent: GrantSet): boolean {
  const allowed = new Set(parent.tools);
  if (!child.tools.every((t) => allowed.has(t))) return false;
  if (child.spendUsdPerDay !== undefined && parent.spendUsdPerDay !== undefined) {
    return child.spendUsdPerDay <= parent.spendUsdPerDay;
  }
  return true;
}

/** invariant 5 in the spec: a child ceiling may never exceed its parent's. */
export function assertNarrowing(child: GrantSet, parent: GrantSet, path: string): void {
  if (!subset(child, parent)) {
    throw new Error(
      `authority violation at ${path}: child ceiling is not a subset of its parent`,
    );
  }
}
