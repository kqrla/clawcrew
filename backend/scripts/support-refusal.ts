/**
 * docs/41. the refusal path, live: a seat without the reply tool reaches for it
 * anyway. the ticket must come back to the queue and the strike must be on record.
 */
import { runTicket } from '../src/domain/support.js';
import { createSupportStoreCli } from '../src/store/support-store-cli.js';
import { cell, sql } from '../src/store/sql-cli.js';

async function main(): Promise<void> {
  sql(`insert into support_ticket (id, asker, subject, body) values ('tkt.1002', 'bo@example.com', 'where is my order', 'ordered nine days ago, no tracking yet')`);
  const out = await runTicket(
    {
      seat: 'seat.support.qa',
      verifier: 'seat.support',
      surface: 'support.inbox',
      grant: { tools: ['inbox.read'], scopes: { 'inbox.read': ['inbox'] }, spendUsdPerDay: 1 },
      now: () => new Date().toISOString(),
    },
    createSupportStoreCli('seat.support.qa'),
    (t) => ({ tool: 'inbox.reply', args: { recipient: 'inbox' }, reply: `thanks, about ${t.id}`, outcome: 'advance' }),
  );
  console.log('outcome: ' + JSON.stringify(out));
  console.log('ticket after refusal: ' + cell(`state || ' reply=' || coalesce(reply_body, 'none')`, `support_ticket where id = 'tkt.1002'`));
  console.log('strikes recorded: ' + cell(`count(*)::text || ' (' || coalesce(string_agg(code, ','), '') || ')'`, `seat_strike where seat = 'seat.support.qa'`));
  console.log('seat.support.qa: ' + cell(`state || ' strikes=' || strikes`, `seat where id = 'seat.support.qa'`));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
