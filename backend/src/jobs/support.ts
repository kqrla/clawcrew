import { SegmentContext, TicketOutcome, runTicket, scriptedResponder } from '../domain/support.js';
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

export async function runSupportOnce(
  store: SupportStore,
  now: string,
  ctx: Omit<SegmentContext, 'now'> = SUPPORT_CONTEXT,
): Promise<TicketOutcome> {
  return runTicket({ ...ctx, now: () => now }, store, scriptedResponder);
}
