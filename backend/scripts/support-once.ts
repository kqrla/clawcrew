/**
 * docs/41. run the support segment once against the real database with whichever
 * provider this machine actually has, and print what a person can verify with a query.
 */
import { runTicket } from '../src/domain/support.js';
import { createSupportStoreCli } from '../src/store/support-store-cli.js';
import { fromEnv, scripted } from '../src/ports/model.js';

async function main(): Promise<void> {
  const provider = fromEnv(process.env) ?? scripted();
  const out = await runTicket(
    {
      seat: 'seat.support',
      verifier: 'seat.support.qa',
      surface: 'support.inbox',
      grant: { tools: ['inbox.read', 'inbox.reply'], scopes: { 'inbox.reply': ['inbox'], 'inbox.read': ['inbox'] }, spendUsdPerDay: 2 },
      provider: provider.label,
      now: () => new Date().toISOString(),
    },
    createSupportStoreCli('seat.support'),
    async (ticket) => {
      const p = await provider.propose({
        task: { id: ticket.id, slice: 'support', kind: 'support', body: ticket.body } as never,
        tools: ['inbox.read', 'inbox.reply'],
        claims: [],
      });
      const call = p.calls[0];
      return { tool: call?.tool ?? '', args: call?.args ?? {}, reply: (p as { reply?: string }).reply ?? '', outcome: 'advance' };
    },
  );
  console.log(`provider: ${provider.label}`);
  console.log(JSON.stringify(out, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
