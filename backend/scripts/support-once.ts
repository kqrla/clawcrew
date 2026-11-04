/**
 * docs/41. run the support segment once against the real database with whichever
 * provider this machine actually has, and print what a person can verify with a query.
 *
 * the bridge lives in src/jobs/support.ts. an earlier version of this script carried
 * its own copy, which meant two bridges and one of them silently out of date: the
 * model was being offered a tool name without its arguments and refusing the work.
 */
import { runSupportOnce } from '../src/jobs/support.js';
import { createSupportStoreCli } from '../src/store/support-store-cli.js';
import { cell, sql } from '../src/store/sql-cli.js';
import { resolveProvider } from '../src/ports/model.js';

async function main(): Promise<void> {
  const provider = resolveProvider(process.env);
  console.log(`provider: ${provider.label}`);

  const outcome = await runSupportOnce(createSupportStoreCli('seat.support'), new Date().toISOString(), undefined, provider);
  console.log(JSON.stringify(outcome, null, 2));
  if (outcome.status === 'failed') {
    console.error(`the provider failed and the ticket went back in the queue: ${outcome.reason}`);
    process.exitCode = 1;
  }

  console.log('tickets: ' + cell(`string_agg(id || ' ' || state || ' via ' || coalesce(provider, '(unlabelled)'), ' | ' order by id)`, 'support_ticket'));
  console.log('seat.support: ' + cell(`state || ' strikes=' || strikes`, `seat where id = 'seat.support'`));
  console.log('objective: ' + cell(`(select count(*) filter (where state in ('closed','verified'))::numeric / greatest(count(*),1) from support_ticket)::text`));
  console.log('evidence: ' + cell(`evidence_ref`, `task where id = (select 't.' || max(id) from support_ticket)`));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
