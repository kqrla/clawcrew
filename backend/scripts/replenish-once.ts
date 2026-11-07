/**
 * docs/53. one replenishment pass: read objectives, their latest measurement, and what is already
 * open, then create the tasks the ledger is asking for. bounded by construction: WIP per objective.
 */
import { lit, marked, sql } from '../src/store/sql-cli.js';
import { Objective, replenish } from '../src/jobs/replenish.js';

const F = '\u001f';
const rows = (select: string): string[] => {
  const out = marked(`select '##' || coalesce((${select}), '') || '##' as k`);
  return out.split('~').filter(Boolean);
};
const parts = (r: string): string[] => r.split(F);

// the registry of legal task kinds is the CHECK constraint, and evidence kinds are not task
// kinds ('commit' evidences a code task; it is not a kind of work). intersect, and if the
// objective's slice is itself a kind, that is the fallback
const registry = Array.from(
  marked(`select '##' || coalesce((select pg_get_constraintdef(oid) from pg_constraint where conrelid = 'task'::regclass and contype = 'c' and conname = 'task_kind_known'), '') || '##' as k`)
    .matchAll(/'([a-z_.-]+)'/g),
).map((m) => m[1]!);
const legal = (candidates: string[], slice: string): string[] => {
  const ok = candidates.filter((k) => registry.includes(k));
  return ok.length > 0 ? ok : registry.includes(slice) ? [slice] : [];
};

const objectives: Objective[] = rows(
  `select string_agg(id || '${F}' || version || '${F}' || coalesce(owner_tier, '') || '${F}' || coalesce(baseline, 0) || '${F}' ||
                     coalesce(target, 0) || '${F}' || coalesce(deadline::text, (now() + interval '30 days')::text) || '${F}' || coalesce(status, ''),
                     '~' order by id)
     from objective where status = 'active'`,
).map((r) => {
  const [id, version, ownerTier, baseline, target, deadline, status] = parts(r);
  return {
    id: id!, version: Number(version ?? 1), ownerTier: ownerTier ?? '',
    baseline: Number(baseline ?? 0), target: Number(target ?? 0),
    deadline: new Date(deadline!), status: status ?? 'active',
    // kinds are scoped to the objective: its own evidence history, else its slice's. a global
    // list of kinds let a "support" task be created for the security objective, which is the
    // org pretending to work on something it has no way to measure
    kinds: legal(
      rows(
        `select string_agg(distinct kind, '~') from evidence
          where objective = ${lit(id!)}
             or source in (select id from objective where id like ${lit(`obj.%.${(id ?? '').split('.')[2] ?? ''}.%`)})`,
      ),
      (id ?? '').split('.')[2] ?? '',
    ),
  };
});

const measurements = rows(
  `select string_agg(objective || '${F}' || value || '${F}' || computed_at::text, '~' order by computed_at desc) from evidence`,
).map((r) => {
  const [objectiveId, value, computedAt] = parts(r);
  return { objectiveId: objectiveId!, value: Number(value ?? 0), computedAt: new Date(computedAt!) };
});

const openTasks = rows(
  `select string_agg(id || '${F}' || coalesce(objective_id, '') || '${F}' || coalesce(kind, '') || '${F}' || state, '~' order by id)
     from task where state in ('ready','open','pending','leased','blocked')`,
).map((r) => {
  const [id, objectiveId, kind, state] = parts(r);
  return { id: id!, objectiveId: objectiveId ?? '', kind: kind ?? '', state: state ?? '' };
});

const { proposals, refusals } = replenish({ objectives, measurements, openTasks, now: new Date() });

for (const p of proposals) {
  const id = `t.${p.objectiveId.split('.').slice(1).join('.')}.${Date.now().toString(36)}`;
  sql(
    `insert into task (id, objective_id, objective_version, owner_tier, kind, state, brief, claim_deadline_at, next_action_at)
     values (${lit(id)}, ${lit(p.objectiveId)}, ${p.objectiveVersion}, ${lit(p.ownerTier)}, ${lit(p.kind)},
             'ready', ${lit(p.brief)}, now() + interval '1 day', now())`,
  );
  console.log(`replenish: + ${p.objectiveId} -> ${p.kind} (${p.why}, deficit ${p.deficit}) as ${id}`);
}
for (const r of refusals) console.log(`replenish: - ${r.objectiveId} (${r.why})`);
console.log(`replenish: ${proposals.length} created, ${refusals.length} refused, ${objectives.length} objectives`);
