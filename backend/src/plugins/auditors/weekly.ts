import { AuditorPlugin, AuditInput, Finding } from '../types.js';

/**
 * three questions, one job: compare what the org claimed to what is measurably true.
 * the audit executes no work and owns no surface, so it cannot mark its own homework.
 */
export function weeklyAuditor(): AuditorPlugin {
  return {
    id: 'weekly-standard',
    kind: 'auditor',
    abi: '1',
    description: 'q1 claim vs measurement, q2 untraceable work, q3 spend without movement',
    async run(input: AuditInput): Promise<Finding[]> {
      const findings: Finding[] = [];
      const push = (f: Omit<Finding, 'id' | 'week' | 'status'>) =>
        findings.push({
          ...f,
          id: `fnd.${input.week}.${findings.length + 1}`,
          week: input.week,
          status: 'open',
        });

      const latestEvidence = (objectiveId: string) =>
        input.evidence
          .filter((e) => e.objective === objectiveId)
          .sort((a, b) => Date.parse(b.computedAt) - Date.parse(a.computedAt))[0];

      // q1: what did we claim, and what is measurably true
      for (const task of input.tasks) {
        if (task.state !== 'done' || !task.objectiveId) continue;
        const objective = input.objectives.find((o) => o.id === task.objectiveId);
        const ev = latestEvidence(task.objectiveId);
        if (!objective) {
          push({
            question: 'q1',
            claim: `task ${task.id} closed against a missing objective`,
            measured: null,
            expected: null,
            source: null,
            severity: 'integrity',
            ownerTier: task.ownerTier,
            actionRequired: 'restore the objective or reopen the task',
          });
          continue;
        }
        if (!ev || (task.completedAt && Date.parse(ev.computedAt) < Date.parse(task.completedAt))) {
          push({
            question: 'q1',
            claim: `task ${task.id} closed as done`,
            measured: null,
            expected: objective.target,
            source: objective.source,
            severity: 'untraceable',
            ownerTier: task.ownerTier,
            actionRequired: 'produce evidence from the declared source or reopen',
          });
          continue;
        }
        const claimed = task.claim?.value ?? objective.target;
        const delta = ev.value - claimed;
        const tolerance = Math.abs(objective.target - objective.baseline) * 0.1;
        if (Math.abs(delta) > tolerance) {
          push({
            question: 'q1',
            claim: `claimed ${claimed} on ${objective.metric}`,
            measured: ev.value,
            expected: objective.target,
            source: objective.source,
            severity: 'drift',
            ownerTier: task.ownerTier,
            actionRequired: 'explain the gap at re-charter or revert',
          });
        }
      }

      // q2: what has no objective, no owner or no evidence
      for (const task of input.tasks) {
        if (task.objectiveId === null && task.state !== 'done') {
          push({
            question: 'q2',
            claim: `open task ${task.id} cites no objective`,
            measured: null,
            expected: null,
            source: null,
            severity: 'untraceable',
            ownerTier: task.ownerTier,
            actionRequired: 'attach an objective or move it to the exploration budget',
          });
        }
      }

      for (const o of input.objectives) {
        if (o.status !== 'active') continue;
        const ev = latestEvidence(o.id);
        if (!ev) {
          push({
            question: 'q2',
            claim: `active objective ${o.id} has never been measured`,
            measured: null,
            expected: o.target,
            source: o.source,
            severity: 'stall',
            ownerTier: o.ownerTier,
            actionRequired: 'run the source, or retire the objective',
          });
        }
      }

      // q3: where did spend move less than the metric
      const spend = new Map<string, number>();
      for (const t of input.tasks) {
        if (t.state !== 'done' || !t.objectiveId) continue;
        spend.set(t.objectiveId, (spend.get(t.objectiveId) ?? 0) + t.costUsd);
      }
      for (const [objectiveId, cost] of spend) {
        const o = input.objectives.find((x) => x.id === objectiveId);
        if (!o || cost <= 0) continue;
        const ev = latestEvidence(objectiveId);
        const moved = ev ? Math.abs(ev.value - o.baseline) : 0;
        const span = Math.abs(o.target - o.baseline) || 1;
        const costPerUnit = cost / (moved / span || 1e-9);
        if (moved / span < 0.25 && cost > 0) {
          push({
            question: 'q3',
            claim: `spent $${cost.toFixed(2)} on ${o.id}`,
            measured: moved,
            expected: span,
            source: o.source,
            severity: 'drift',
            ownerTier: o.ownerTier,
            actionRequired: `cost per unit of movement is $${costPerUnit.toFixed(0)}; justify or retire`,
          });
        }
      }

      return findings;
    },
  };
}
