/**
 * docs/51. one dispatch pass: read the ledger, pick the next task, hold a lease on it.
 * prints the decision either way, because "nothing to do" is a fact worth logging.
 */
import { marked, sql, cell } from '../src/store/sql-cli.js';
import { nextAssignment } from '../src/jobs/dispatch.js';

const F = '\u001f';
const rows = marked(
  // task has no priority or slice column: the objective carries the slice and the ledger is
// ordered by staleness (starved_at) then age, which is what "next" means in this schema
  `select '##' || coalesce(string_agg(id || '${F}' || kind || '${F}' || coalesce(owner_tier, '') || '${F}' || coalesce(objective_id, ''), '~' order by coalesce(starved_at, created_at)), '') || '##' as k
     from task where state in ('ready','open','pending')`,
);
const candidates = rows.split('~').filter(Boolean).map((r) => {
  const [taskId, kind, tier, objectiveId] = r.split(F);
  // the slice a task belongs to is the first segment of its tier: t.test01.support -> support
  const slice = (tier ?? '').split('.').slice(2).join('.') || 'support';
  return { taskId: taskId!, kind: kind ?? 'reply', slice, objectiveId: objectiveId ?? '', priority: 0 };
});

const seatRows = marked(
  `select '##' || coalesce(string_agg(seat || '${F}' || slice || '${F}' || on_call, '~' order by seat), '') || '##' as k from seat_shift`,
);
const seats = seatRows.split('~').filter(Boolean).map((r) => {
  const [id, slice, onCall] = r.split(F);
  return { id: id!, slice: slice!, onCall: onCall === 't' || onCall === 'true' };
});

const leaseRows = marked(
  `select '##' || coalesce(string_agg(task_id, '~'), '') || '##' as k from seat_lease where released_at is null and expires_at > now()`,
);
const leasedTaskIds = leaseRows.split('~').filter(Boolean);
// there is no kind registry table: the registry is the CHECK constraint on task.kind, so read
// it from where it lives. parsed from the constraint definition rather than duplicated here,
// because a second copy of the allowed kinds is a copy that drifts.
const constraintDef = marked(
  `select '##' || coalesce((select pg_get_constraintdef(oid) from pg_constraint where conrelid = 'task'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%kind%' limit 1), '') || '##' as k`,
);
const fromConstraint = Array.from(constraintDef.matchAll(/'([a-z_.-]+)'/g)).map((m) => m[1]!);
const fromEvidence = marked(`select '##' || coalesce(string_agg(distinct kind, '~'), '') || '##' as k from evidence`).split('~').filter(Boolean);
const kinds = Array.from(new Set([...fromConstraint, ...fromEvidence]));

const decision = nextAssignment({ candidates, seats, leasedTaskIds, registeredKinds: kinds });
if (!decision.ok) {
  console.log(`dispatch: nothing assigned (${decision.why}) candidates=${candidates.length} seats=${seats.length}`);
} else {
  sql(
    `insert into seat_lease (task_id, seat, kind, expires_at) values ('${decision.taskId}', '${decision.seat}', '${decision.kind}', now() + interval '${Math.round(decision.leaseMs / 1000)} seconds')`,
  );
  console.log(`dispatch: ${decision.taskId} (${decision.kind}) -> ${decision.seat}, lease ${Math.round(decision.leaseMs / 60000)}m`);
}
void cell;
