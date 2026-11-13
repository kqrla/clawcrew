/**
 * docs/52. one full pass of the loop: settle every live lease, then dispatch the next task.
 *
 * the order matters. dispatch-then-settle would hand out a second task while the first is still
 * unresolved, which is how a seat ends up with two leases and no completed work.
 */
import { lit, marked, sql } from '../src/store/sql-cli.js';
import { nextAssignment } from '../src/jobs/dispatch.js';
import { Evidence, Lease, judge } from '../src/jobs/complete.js';
import { Rule, checkEvidence } from '../src/jobs/acceptance.js';

const F = '\u001f';
/** takes a whole select that yields one row of 'a~b~c', so every caller states its FROM */
const rows = (select: string): string[] => {
  const out = marked(`select '##' || coalesce((${select}), '') || '##' as k`);
  return out.split('~').filter(Boolean);
};
const parts = (r: string): string[] => r.split(F);
const iso = (s: string): Date => new Date(s);

// ---- settle what is already leased ----
const leaseSql = `
  select string_agg(l.task_id || '${F}' || l.seat || '${F}' || l.kind || '${F}' || coalesce(t.objective_id, '') || '${F}' ||
                    l.acquired_at::text || '${F}' || l.expires_at::text || '${F}' || coalesce(t.attempts, 0) || '${F}' || coalesce(t.max_attempts, 3), '~' order by l.id)
    from seat_lease l join task t on t.id = l.task_id
   where l.released_at is null`;

const liveRows = rows(leaseSql.replace(/\n/g, ' '));

/** docs/55: the rules of acceptance, read from the table so a policy change is a migration */
const rules = new Map<string, Rule>(
  rows(
    `select string_agg(kind || '${F}' || source_pattern || '${F}' || min_count || '${F}' || max_age_hours || '${F}' || needs_second_seat, '~' order by kind)
       from evidence_rule`,
  ).map((r) => {
    const [kind, sourcePattern, minCount, maxAgeHours, second] = parts(r);
    return [kind!, {
      kind: kind!, requires: '', sourcePattern: sourcePattern!,
      minCount: Number(minCount ?? 1), maxAgeHours: Number(maxAgeHours ?? 72),
      needsSecondSeat: second === 't' || second === 'true',
    }];
  }),
);

let completed = 0;
let requeued = 0;
let escalated = 0;
let held = 0;

for (const r of liveRows) {
  const [taskId, seat, kind, objectiveId, acquiredAt, expiresAt, attempts, maxAttempts] = parts(r);
  const lease: Lease = {
    taskId: taskId!, seat: seat!, kind: kind!, objectiveId: objectiveId ?? '',
    acquiredAt: iso(acquiredAt!), expiresAt: iso(expiresAt!),
    attempts: Number(attempts ?? 0), maxAttempts: Number(maxAttempts ?? 3),
  };
  const evidence: Evidence[] = rows(
    `select string_agg(objective || '${F}' || kind || '${F}' || computed_at::text || '${F}' || coalesce(run_by, '') || '${F}' || coalesce(source, ''), '~' order by computed_at desc)
       from evidence where objective = ${lit(lease.objectiveId)}`,
  ).map((r) => {
    const [objectiveId, kind, computedAt, runBy, source] = parts(r);
    return { objectiveId: objectiveId!, kind: kind!, computedAt: iso(computedAt!), runBy: runBy ?? '', source: source ?? '' };
  });

  const verdict = checkEvidence(
    rules.get(lease.kind),
    evidence.map((e) => ({ kind: e.kind, source: e.source ?? '', runBy: e.runBy, computedAt: e.computedAt })),
    new Date(),
  );
  const outcome = judge(lease, evidence, new Date(), verdict as { ok: true } | { ok: false; why: string });
  if (outcome.action === 'hold') { held += 1; continue; }

  if (outcome.action === 'complete') {
    // a value goes in as a literal: JSON.stringify produces double quotes, which postgres reads
    // as an identifier, and the error for that is "column seat.support does not exist"
    sql(`update task set state = 'done', completed_at = now(), evidence_ref = ${lit(outcome.evidence.runBy)} where id = ${lit(lease.taskId)}`);
    sql(`update seat_lease set released_at = now() where task_id = ${lit(lease.taskId)} and released_at is null`);
    completed += 1;
    console.log(`work: ${lease.taskId} complete on ${outcome.evidence.kind} evidence from ${outcome.evidence.runBy}`);
    continue;
  }

  if (outcome.action === 'escalate') {
    sql(`update task set state = 'blocked', blocking_reason = ${lit(`attempts_exhausted after ${lease.attempts}`)}, attempts = attempts + 1 where id = ${lit(lease.taskId)}`);
    sql(`update seat_lease set released_at = now() where task_id = ${lit(lease.taskId)} and released_at is null`);
    escalated += 1;
    console.log(`work: ${lease.taskId} escalated after ${lease.attempts} attempts`);
    continue;
  }

  sql(`update task set attempts = coalesce(attempts, 0) + 1, next_action_at = now() + interval '${Math.round(outcome.backoffMs / 1000)} seconds' where id = ${lit(lease.taskId)}`);
  sql(`update seat_lease set released_at = now() where task_id = ${lit(lease.taskId)} and released_at is null`);
  requeued += 1;
  console.log(`work: ${lease.taskId} requeued (${outcome.why}${'detail' in outcome && outcome.detail ? `: ${outcome.detail}` : ''}) attempt ${lease.attempts + 1}/${lease.maxAttempts}`);
}

// ---- then dispatch ----
const candidates = rows(`select string_agg(id || '${F}' || kind || '${F}' || coalesce(owner_tier, '') || '${F}' || coalesce(objective_id, ''), '~' order by coalesce(starved_at, created_at))
    from task where state in ('ready','open','pending')`)
  .map((r) => {
    const [taskId, kind, tier, objectiveId] = parts(r);
    return { taskId: taskId!, kind: kind!, slice: (tier ?? '').split('.').slice(2).join('.') || 'support', objectiveId: objectiveId ?? '', priority: 0 };
  });
const seats = rows(`select string_agg(seat || '${F}' || slice || '${F}' || on_call, '~' order by seat) from seat_shift`)
  .map((r) => { const [id, slice, onCall] = parts(r); return { id: id!, slice: slice!, onCall: onCall === 't' || onCall === 'true' }; });
const leasedTaskIds = rows(`select string_agg(task_id, '~') from seat_lease where released_at is null and expires_at > now()`);

const constraintDef = marked(`select '##' || coalesce((select pg_get_constraintdef(oid) from pg_constraint where conrelid = 'task'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%kind%' limit 1), '') || '##' as k`);
const kinds = Array.from(new Set([
  ...Array.from(constraintDef.matchAll(/'([a-z_.-]+)'/g)).map((m) => m[1]!),
  ...rows(`select string_agg(distinct kind, '~') from evidence`),
]));

const decision = nextAssignment({ candidates, seats, leasedTaskIds, registeredKinds: kinds });
if (decision.ok) {
  sql(`insert into seat_lease (task_id, seat, kind, expires_at) values (${lit(decision.taskId)}, ${lit(decision.seat)}, ${lit(decision.kind)}, now() + interval '${Math.round(decision.leaseMs / 1000)} seconds')`);
  console.log(`work: ${decision.taskId} (${decision.kind}) -> ${decision.seat}`);
} else {
  console.log(`work: nothing dispatched (${decision.why})`);
}
console.log(`work: settled complete=${completed} requeued=${requeued} escalated=${escalated} held=${held}`);
