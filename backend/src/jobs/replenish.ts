/**
 * docs/53. the last organ: an objective that is behind has to be able to ask for work.
 *
 * until now the org finished what it was given. this turns a metric missing its target into
 * concrete tasks, and it refuses often and loudly, because the failure mode of a machine that
 * can invent work is a thousand tasks nobody can finish.
 */
export interface Objective {
  id: string;
  version: number;
  ownerTier: string;
  baseline: number;
  target: number;
  deadline: Date;
  status: string;
  /** when this objective's period began: its first measurement, or the project's start. pace is
   *  meaningless without it, and measuring from the latest run makes every objective look ahead */
  observedSince?: Date;
  /** the catalog line this objective belongs to; only a live or prototype line may be worked */
  lineStatus?: 'planned' | 'prototype' | 'live' | 'retired';
  /** the task kinds this objective accepts, in the order they should be tried */
  kinds: string[];
}
export interface Measurement {
  objectiveId: string;
  value: number;
  computedAt: Date;
}
export interface OpenTask {
  id: string;
  objectiveId: string;
  kind: string;
  state: string;
}
export interface Proposal {
  objectiveId: string;
  objectiveVersion: number;
  kind: string;
  slice: string;
  ownerTier: string;
  brief: string;
  deficit: number;
  why: 'behind_target' | 'no_measurement';
}
export interface Refusal {
  objectiveId: string;
  why: 'on_track' | 'already_queued' | 'wip_limit' | 'kind_unregistered' | 'no_deadline_left' | 'line_not_live';
}

export const WIP_LIMIT = 2;
/** on pace means at least this share of the progress the clock demands: 85% of pace, not 100%,
 *  so ordinary jitter does not manufacture tasks */
export const SLACK = 0.15;

const fraction = (v: number, from: number, to: number): number => {
  if (to === from) return 1;
  const f = (v - from) / (to - from);
  return Math.max(0, Math.min(1, f));
};

/** the ten kinds of work this org does, mirroring the task_kind_known constraint */
export const KNOWN_KINDS = [
  'code', 'design', 'research', 'security', 'financial',
  'media', 'ops', 'accounting', 'support', 'doc',
] as const;

/**
 * obj.trinketeer.meeniable.code.repo -> code.
 *
 * found by looking for a legal kind rather than by counting segments: the id grew a product line
 * (obj.meenible.code.repo -> obj.trinketeer.meeniable.code.repo) and a positional rule silently
 * started reading "meeniable" as the slice, which turned every objective into kind_unregistered.
 */
export function sliceOf(objective: Objective, registry: readonly string[] = KNOWN_KINDS): string {
  return objective.id.split('.').find((seg) => registry.includes(seg)) ?? 'general';
}

export function replenish(input: {
  objectives: Objective[];
  measurements: Measurement[];
  openTasks: OpenTask[];
  now: Date;
  wipLimit?: number;
}): { proposals: Proposal[]; refusals: Refusal[] } {
  const wip = input.wipLimit ?? WIP_LIMIT;
  const proposals: Proposal[] = [];
  const refusals: Refusal[] = [];

  for (const o of input.objectives) {
    if (o.status !== 'active') continue;
    // scope control: a line that is planned or retired gets no tasks, however behind its metric
    // looks. inventing work for an unlaunched product is the most expensive kind of busy
    if (o.lineStatus === 'planned' || o.lineStatus === 'retired') {
      refusals.push({ objectiveId: o.id, why: 'line_not_live' });
      continue;
    }
    if (o.kinds.length === 0) {
      refusals.push({ objectiveId: o.id, why: 'kind_unregistered' });
      continue;
    }
    if (o.deadline.getTime() <= input.now.getTime()) {
      refusals.push({ objectiveId: o.id, why: 'no_deadline_left' });
      continue;
    }
    const open = input.openTasks.filter((t) => t.objectiveId === o.id);
    if (open.length >= wip) {
      refusals.push({ objectiveId: o.id, why: 'wip_limit' });
      continue;
    }

    const history = input.measurements
      .filter((m) => m.objectiveId === o.id)
      .sort((a, b) => b.computedAt.getTime() - a.computedAt.getTime());
    const measured = history[0];
    const since = o.observedSince ?? history[history.length - 1]?.computedAt ?? input.now;

    // nothing measured is not "on track": it is unknown, and the first job is to find out
    if (!measured) {
      proposals.push({
        objectiveId: o.id, objectiveVersion: o.version, kind: o.kinds[0]!,
        slice: sliceOf(o), ownerTier: o.ownerTier, deficit: 1, why: 'no_measurement',
        brief: `measure "${o.id}": no evidence has been computed, so nobody knows if this is on track`,
      });
      continue;
    }

    const done = fraction(measured.value, o.baseline, o.target);
    const period = o.deadline.getTime() - since.getTime();
    const elapsed = period <= 0 ? 1 : Math.max(0, Math.min(1, (input.now.getTime() - since.getTime()) / period));
    // pace, not fraction: 8% done at 20% of the period is behind, and 96% done is not behind at
    // any point in the period. comparing fractions alone lets an early-period lag hide
    if (done >= elapsed * (1 - SLACK)) {
      refusals.push({ objectiveId: o.id, why: 'on_track' });
      continue;
    }

    // one piece of work per objective at a time: a second task on a behind objective is how a
    // metric gets worse while looking busier
    if (open.length > 0) {
      refusals.push({ objectiveId: o.id, why: 'already_queued' });
      continue;
    }

    const kind = o.kinds.find((k) => !open.some((t) => t.kind === k)) ?? o.kinds[0]!;
    proposals.push({
      objectiveId: o.id, objectiveVersion: o.version, kind,
      slice: sliceOf(o), ownerTier: o.ownerTier,
      deficit: Number((1 - done).toFixed(3)), why: 'behind_target',
      brief: `move "${o.id}" from ${measured.value} toward ${o.target} by ${o.deadline.toISOString().slice(0, 10)}`,
    });
  }

  // worst deficit first, so a bounded number of seats always work the worst hole
  proposals.sort((a, b) => b.deficit - a.deficit || a.objectiveId.localeCompare(b.objectiveId));
  return { proposals, refusals };
}
