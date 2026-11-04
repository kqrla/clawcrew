import { SegmentContext, TicketOutcome, runTicket, scriptedResponder } from '../domain/support.js';
import { ModelProvider, resolveProvider } from '../ports/model.js';
import { SupportStore } from '../domain/support.js';

/**
 * docs/41. the segment's entry point for a process: one ticket per call, no state
 * kept between calls, so stopping the runner is safe at any instant.
 */
export const SUPPORT_CONTEXT: Omit<SegmentContext, 'now'> = {
  seat: 'seat.support',
  verifier: 'seat.support.qa',
  surface: 'support.inbox',
  grant: {
    tools: ['inbox.read', 'inbox.reply'],
    scopes: { 'inbox.read': ['inbox'], 'inbox.reply': ['inbox'] },
    spendUsdPerDay: 2,
  },
  spendPerCallUsd: 0.01,
};

/**
 * the responder is whatever the machine actually has. if a credential is present it is
 * used and a failure is a failure: falling back to the template on a bad key is the
 * same false green the migration runner used to print.
 */
export function responderFor(provider: ModelProvider) {
  return async (ticket: { id: string; subject: string; body: string }) => {
    if (provider.label.startsWith('scripted')) return scriptedResponder({ ...ticket } as never);
    const p = await provider.propose({
      // a seat that is handed a ticket but not told the job refuses the work, and it is
      // right to: the first live run did exactly that and said so in its reason
      task: {
        id: ticket.id,
        slice: 'support',
        kind: 'support',
        job: 'write the reply this customer should receive, then call inbox.reply with the recipient and put the words in reply',
        subject: ticket.subject,
        body: ticket.body,
      } as never,
      // the offer carries the argument domain, because a seat told only a tool name
      // guesses, and a guess outside the grant costs it a strike
      tools: [
        { name: 'inbox.read', args: [{ name: 'inbox', type: 'string', allowed: ['inbox'] }] },
        { name: 'inbox.reply', args: [{ name: 'recipient', type: 'string', allowed: ['inbox'] }] },
      ],
      claims: [],
    });
    if (process.env.ORCHART_DEBUG_PROPOSAL) console.error('proposal:', JSON.stringify(p).slice(0, 600));
    const call = p.calls[0];
    return {
      tool: call?.tool ?? '',
      args: call?.args ?? {},
      reply: (p as { reply?: string }).reply ?? '',
      outcome: p.outcome === 'advance' ? ('advance' as const) : ('blocked' as const),
    };
  };
}

export async function runSupportOnce(
  store: SupportStore,
  now: string,
  ctx: Omit<SegmentContext, 'now'> = SUPPORT_CONTEXT,
  provider: ModelProvider = resolveProvider(process.env),
): Promise<TicketOutcome> {
  return runTicket({ ...ctx, provider: provider.label, now: () => now }, store, responderFor(provider));
}
