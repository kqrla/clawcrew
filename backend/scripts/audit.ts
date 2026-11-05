/**
 * docs/47. the auditor: a slow clock that checks the org against its own data.
 *
 * weekly, not per turn. it does no work and spends nothing. it counts four things into the
 * existing audit_run row shape (objectives, agrees, disputes, blind_spots, unverifiable) and
 * exits 3 when a count that should be zero is not, so cron or systemd can page.
 */
import { cell, sql } from '../src/store/sql-cli.js';

const PROJECT = process.argv.includes('--project') ? process.argv[process.argv.indexOf('--project') + 1]! : 'meenible';

const n = (expr: string): number => {
  const v = Number(cell(`(${expr})`));
  return Number.isFinite(v) ? v : 0;
};

const objectives = n(`select count(*) from objective where status = 'active'`);
const agrees = n(`select count(*) from support_ticket where reply_body is not null and provider is not null`);
const disputes = n(`select count(*) from support_ticket t where t.state = 'answered' and t.reply_body is not null
                      and (select count(*) from task where task.id = 't.' || substr(t.id, 5)) > 0`);
const blindSpots = n(`select count(*) from support_ticket where reply_body is not null and provider is null`);
const unverifiable = n(`select count(*) from budget_reservation where state = 'held' and started_at < now() - interval '1 day'`);

const dirty = disputes + blindSpots + unverifiable > 0;
sql(
  `insert into audit_run (project_id, objectives, agrees, disputes, blind_spots, unverifiable)
   values ('${PROJECT}', ${objectives}, ${agrees}, ${disputes}, ${blindSpots}, ${unverifiable})`,
);

console.log(`audit ${PROJECT}: objectives=${objectives} agrees=${agrees} disputes=${disputes} blind_spots=${blindSpots} unverifiable=${unverifiable}`);
if (dirty) {
  // a claim nobody signed, an author nobody recorded, and a reservation nobody settled are
  // the three ways this org can be quietly wrong while every dashboard says fine
  console.error('audit: findings, this needs a person');
  process.exitCode = 3;
}
