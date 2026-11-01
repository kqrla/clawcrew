// the set point. a task board says what moved; the ledger says whether movement meant anything.
export type ObjectiveStatus = 'active' | 'met' | 'failed' | 'retired' | 'superseded';

export interface Objective {
  id: string;
  parent: string | null;
  ownerTier: string;
  statement: string;
  metric: string;
  /** executable reference. sql: | http: | git: | run: */
  source: string;
  baseline: number;
  target: number;
  deadline: string;
  status: ObjectiveStatus;
  selfReported?: boolean;
  version: number;
  amendedAt?: string;
  retiredReason?: string;
}

export interface Evidence {
  objective: string;
  source: string;
  value: number;
  computedAt: string;
  /** the auditor runs evidence, not the owning tier, wherever possible */
  runBy: string;
  artifact?: string;
}

const EXECUTABLE = /^(sql|http|git|run):.+/;

export function validateObjective(o: Objective): string[] {
  const errors: string[] = [];
  if (!EXECUTABLE.test(o.source)) errors.push('source_must_be_executable');
  if (o.metric.trim().length === 0) errors.push('metric_required');
  if (o.target === o.baseline) errors.push('target_equals_baseline');
  if (Number.isNaN(Date.parse(o.deadline))) errors.push('deadline_invalid');
  if (o.parent === o.id) errors.push('self_parent');
  if (o.selfReported === true && o.parent !== null) {
    errors.push('self_reported_cannot_satisfy_a_parent');
  }
  return errors;
}

const higherIsBetter = (o: Objective) => o.target >= o.baseline;

export interface CloseOptions {
  /** evidence must be newer than this, normally the last amendment */
  since?: string;
  /** classes of action that may never close an objective on their own */
  forbidRunBy?: string[];
}

export interface CloseVerdict {
  ok: boolean;
  reasons: string[];
  usedEvidence?: Evidence;
}

/**
 * rule 4: a parent never closes on child claims. the parent closes on its own
 * metric from its own source. child completion is necessary, never sufficient.
 */
export function canClose(
  o: Objective,
  evidence: Evidence[],
  opts: CloseOptions = {},
): CloseVerdict {
  const reasons: string[] = [];
  const matching = evidence
    .filter((e) => e.objective === o.id && e.source === o.source)
    .filter((e) => (opts.since ? Date.parse(e.computedAt) > Date.parse(opts.since) : true))
    .sort((a, b) => Date.parse(b.computedAt) - Date.parse(a.computedAt));

  if (matching.length === 0) {
    reasons.push('no_evidence_from_declared_source');
    return { ok: false, reasons };
  }
  const latest = matching[0]!;
  if (opts.forbidRunBy?.includes(latest.runBy)) reasons.push('evidence_produced_by_forbidden_actor');

  const met = higherIsBetter(o)
    ? latest.value >= o.target
    : latest.value <= o.target;
  if (!met) reasons.push('target_not_met');

  return reasons.length === 0 ? { ok: true, reasons, usedEvidence: latest } : { ok: false, reasons, usedEvidence: latest };
}

/** closure is refused if the only support is children completing. */
export function childClaimsAreNotEvidence(childVerdicts: CloseVerdict[]): string[] {
  const allGreen = childVerdicts.length > 0 && childVerdicts.every((v) => v.ok);
  return allGreen
    ? ['child_completion_is_necessary_not_sufficient']
    : ['children_incomplete'];
}

export interface TaskRef {
  id: string;
  objectiveId: string | null;
  state: 'open' | 'in_progress' | 'done' | 'blocked';
  costUsd: number;
  completedAt?: string;
}

/** work with no objective is the drift report. keep it short and high-signal. */
export function untraceable(tasks: TaskRef[]): TaskRef[] {
  return tasks.filter((t) => t.objectiveId === null && t.state !== 'done');
}

export function unsupported(
  tasks: TaskRef[],
  evidence: Evidence[],
): TaskRef[] {
  return tasks.filter((t) => {
    if (t.state !== 'done' || t.objectiveId === null) return false;
    if (!t.completedAt) return true;
    return !evidence.some(
      (e) => e.objective === t.objectiveId && Date.parse(e.computedAt) >= Date.parse(t.completedAt!),
    );
  });
}

export function stalled(
  objectives: Objective[],
  evidence: Evidence[],
  now: string,
  minDays = 30,
  epsilon = 0.02,
): Objective[] {
  return objectives.filter((o) => {
    if (o.status !== 'active') return false;
    const mine = evidence
      .filter((e) => e.objective === o.id)
      .sort((a, b) => Date.parse(b.computedAt) - Date.parse(a.computedAt));
    const latest = mine[0];
    const span = Math.abs(o.target - o.baseline) || 1;
    const moved = latest ? Math.abs(latest.value - o.baseline) : 0;
    if (moved >= epsilon * span) return false;
    const deadlinePassed = Date.parse(o.deadline) <= Date.parse(now);
    const staleEvidence =
      latest === undefined || Date.parse(now) - Date.parse(latest.computedAt) >= minDays * 86_400_000;
    return deadlinePassed || staleEvidence;
  });
}

export function retire(o: Objective, reason: string, supersededBy?: string): Objective {
  if (reason.trim().length === 0) throw new Error('retirement requires a reason');
  return {
    ...o,
    status: supersededBy ? 'superseded' : 'retired',
    retiredReason: reason,
    version: o.version + 1,
  };
}
