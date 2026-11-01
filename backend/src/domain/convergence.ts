import { isReference } from './relay.js';

/**
 * parallel teams work decoupled, then converge. the convergence is a record, not
 * a meeting: an explicit partition map, a barrier, and a join rule.
 *
 * the rule that keeps this honest is the same one that keeps the ledger honest:
 * *silence is not a result*, and mutual agreement is not closure.
 */
export type JoinSemantics = 'all' | 'quorum' | 'first_success';
export type Outcome = 'result' | 'not_applicable' | 'blocked';

export interface Report {
  circle: string;
  partition: string;
  outcome: Outcome;
  artifactRef?: string;
  reason?: string;
  /** surfaces this result wrote to, so contention is detectable */
  touches: string[];
  at: string;
}

export interface Convergence {
  id: string;
  parentObjective: string;
  circles: string[];
  /** partition -> owning circle. exhaustive by construction, not by convention. */
  partitions: Record<string, string>;
  join: JoinSemantics;
  quorum?: number;
  deadline: string;
  reports: Report[];
}

export function validateConvergence(c: Convergence): string[] {
  const problems: string[] = [];
  const partitions = Object.keys(c.partitions);
  if (partitions.length === 0) problems.push('no_partitions');
  if (c.circles.length < 2) problems.push('convergence_needs_two_circles');

  for (const [partition, owner] of Object.entries(c.partitions)) {
    if (!c.circles.includes(owner)) problems.push(`owner_not_a_participant:${partition}:${owner}`);
  }
  for (const circle of c.circles) {
    const owned = partitions.filter((p) => c.partitions[p] === circle);
    if (owned.length === 0) problems.push(`participant_owns_nothing:${circle}`);
  }
  if (c.join === 'quorum') {
    if (c.quorum === undefined) problems.push('quorum_required');
    else if (c.quorum < 1 || c.quorum > partitions.length) problems.push('quorum_out_of_range');
  }
  if (Number.isNaN(Date.parse(c.deadline))) problems.push('deadline_invalid');
  return problems;
}

/**
 * a report must come from the circle that owns the partition. this is what stops
 * a fast team from quietly filling a neighbour's gap, which is how orphans get
 * papered over instead of surfaced.
 */
export function report(c: Convergence, r: Report): Convergence {
  if (!c.circles.includes(r.circle)) throw new Error(`${r.circle} is not a participant`);
  const owner = c.partitions[r.partition];
  if (!owner) throw new Error(`unknown partition ${r.partition}`);
  if (owner !== r.circle) throw new Error(`${r.circle} does not own partition ${r.partition} (owned by ${owner})`);
  if (c.reports.some((x) => x.circle === r.circle && x.partition === r.partition)) {
    throw new Error('partition already reported; amend through the parent circle');
  }
  if (r.outcome === 'result' && (!r.artifactRef || !isReference(r.artifactRef))) {
    throw new Error('a result requires an artifact reference');
  }
  if (r.outcome !== 'result' && !r.reason?.trim()) {
    throw new Error(`a ${r.outcome} report requires a reason`);
  }
  return { ...c, reports: [...c.reports, r] };
}

export interface BarrierState {
  partitions: number;
  reported: number;
  results: number;
  missing: string[];
  blocked: { circle: string; partition: string; reason: string }[];
  satisfied: boolean;
  rule: string;
}

export function barrier(c: Convergence): BarrierState {
  const partitions = Object.keys(c.partitions);
  const reported = new Set(c.reports.map((r) => r.partition));
  const missing = partitions.filter((p) => !reported.has(p));
  const results = c.reports.filter((r) => r.outcome === 'result');
  const na = new Set(c.reports.filter((r) => r.outcome === 'not_applicable').map((r) => r.partition));
  const resolved = new Set([...results.map((r) => r.partition), ...na]);
  const blocked = c.reports
    .filter((r) => r.outcome === 'blocked')
    .map((r) => ({ circle: r.circle, partition: r.partition, reason: r.reason ?? '' }));

  let satisfied = false;
  let rule = '';
  switch (c.join) {
    case 'all':
      satisfied = partitions.every((p) => resolved.has(p));
      rule = 'every_partition_resolved';
      break;
    case 'quorum':
      satisfied = results.length >= (c.quorum ?? partitions.length);
      rule = `results>=${c.quorum}`;
      break;
    case 'first_success':
      satisfied = results.length >= 1;
      rule = 'any_single_result';
      break;
  }

  return { partitions: partitions.length, reported: reported.size, results: results.length, missing, blocked, satisfied, rule };
}

export interface GateVerdict {
  canClose: boolean;
  reasons: string[];
  barrier: BarrierState;
}

/**
 * convergence is not closure. the barrier says the work is in; the parent metric
 * says the work mattered. a team cannot satisfy a parent objective by agreeing
 * with itself, which is the same rule the ledger enforces one level up.
 */
export function integrationGate(
  c: Convergence,
  opts: { parentMetricMeasured: boolean },
): GateVerdict {
  const b = barrier(c);
  const reasons: string[] = [];
  if (!b.satisfied) {
    if (b.missing.length > 0) reasons.push(`unreported_partitions:${b.missing.length}`);
    if (b.blocked.length > 0) reasons.push(`blocked_partitions:${b.blocked.length}`);
    if (b.results < Object.keys(c.partitions).length && c.join === 'all') {
      reasons.push('not_every_partition_returned_a_result');
    }
  }
  if (!opts.parentMetricMeasured) reasons.push('parent_metric_not_measured');
  return { canClose: reasons.length === 0, reasons, barrier: b };
}

export interface Conflict {
  surface: string;
  circles: string[];
  artifacts: string[];
}

/** two teams wrote to the same surface. last-write-wins is not a merge strategy. */
export function conflicts(c: Convergence): Conflict[] {
  const bySurface = new Map<string, { circles: Set<string>; artifacts: Set<string> }>();
  for (const r of c.reports) {
    if (r.outcome !== 'result') continue;
    for (const s of r.touches) {
      const entry = bySurface.get(s) ?? { circles: new Set<string>(), artifacts: new Set<string>() };
      entry.circles.add(r.circle);
      if (r.artifactRef) entry.artifacts.add(r.artifactRef);
      bySurface.set(s, entry);
    }
  }
  const out: Conflict[] = [];
  for (const [surface, entry] of bySurface) {
    if (entry.circles.size > 1) {
      out.push({ surface, circles: [...entry.circles].sort(), artifacts: [...entry.artifacts].sort() });
    }
  }
  return out.sort((a, b) => (a.surface < b.surface ? -1 : 1));
}

export interface Stall {
  overdue: boolean;
  missing: string[];
  blocked: string[];
}

/** a deadline without a stall check is a wish. */
export function stall(c: Convergence, now: string): Stall {
  const b = barrier(c);
  const overdue = Date.parse(now) > Date.parse(c.deadline) && !b.satisfied;
  return { overdue, missing: b.missing, blocked: b.blocked.map((x) => x.partition) };
}

/** under first_success, the losing tracks must be cancelled explicitly, not left running. */
export function cancelledByFirstSuccess(c: Convergence, now: string): string[] {
  if (c.join !== 'first_success') return [];
  const b = barrier(c);
  if (!b.satisfied) return [];
  const winner = c.reports.find((r) => r.outcome === 'result');
  if (!winner) return [];
  return Object.keys(c.partitions).filter(
    (p) => p !== winner.partition && !c.reports.some((r) => r.partition === p),
  );
}
