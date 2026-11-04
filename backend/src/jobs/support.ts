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
      task: { id: ticket.id, body: `${ticket.subject}\n\n${ticket.body}` } as never,
      tools: ['inbox.read', 'inbox.reply'],
      claims: [],
    });
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
