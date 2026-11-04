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
import type { SupportStore } from '../src/domain/support.js';

const everyArg = process.argv.indexOf('--every');
const everyMs = everyArg === -1 ? 0 : Number(process.argv[everyArg + 1] ?? 0);
const cyclesArg = process.argv.indexOf('--cycles');
const maxCycles = cyclesArg === -1 ? Infinity : Number(process.argv[cyclesArg + 1] ?? 1);

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

async function one(store: SupportStore): Promise<number> {
  const outcome = await runSupportOnce(store, new Date().toISOString());
  const line =
    outcome.status === 'verified'
      ? `verified ${outcome.reply.slice(0, 60)}...`
      : outcome.status === 'over_cap'
        ? `over_cap spent=${outcome.spentUsd.toFixed(3)} cap=${outcome.capUsd}`
        : outcome.status === 'refused'
          ? `refused ${outcome.verdict.code}`
          : outcome.status === 'failed'
            ? `failed ${outcome.reason.slice(0, 80)}`
            : outcome.status;
  console.log(`${new Date().toISOString()} ${line}`);
  if (outcome.status === 'failed') return 1;
  if (outcome.status === 'over_cap') return 2;
  return 0;
}

async function main(): Promise<void> {
  const provider = resolveProvider(process.env);
  console.log(`provider: ${provider.label}`);
  const store = createSupportStoreCli('seat.support');

  if (!everyMs) {
    const outcome = await runSupportOnce(store, new Date().toISOString(), undefined, provider);
    console.log(JSON.stringify(outcome, null, 2));
    if (outcome.status === 'failed') {
      console.error(`the provider failed and the ticket went back in the queue: ${outcome.reason}`);
      process.exitCode = 1;
    }
    report();
    return;
  }

  // the night shift. one ticket per cycle, and a cap that refuses costs nothing, so
  // hitting it is a reason to wait rather than to stop
  for (let i = 0; i < maxCycles; i += 1) {
    const code = await one(store);
    if (code === 1) process.exitCode = 1;
    if (i === maxCycles - 1) break;
    await sleep(code === 2 ? Math.max(everyMs, 60_000) : everyMs);
  }
  report();
}

function report(): void {
  console.log('tickets: ' + cell(`string_agg(id || ' ' || state || ' via ' || coalesce(provider, '(unlabelled)'), ' | ' order by id)`, 'support_ticket'));
  console.log('seat.support: ' + cell(`state || ' strikes=' || strikes`, `seat where id = 'seat.support'`));
  console.log('objective: ' + cell(`(select count(*) filter (where state in ('closed','verified'))::numeric / greatest(count(*),1) from support_ticket)::text`));
  console.log('spend today: ' + cell(`coalesce(sum(coalesce(settled_amount, amount)), 0)::text`, `budget_reservation where started_at >= date_trunc('day', now())`));
  const evidence = cell(
    `coalesce((select evidence_ref from task where id = (select 't.' || max(id) from support_ticket)), 'none')`,
  );
  console.log('evidence: ' + evidence);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
