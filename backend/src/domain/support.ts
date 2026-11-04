/**
 * docs/41. one segment, all the way through: a ticket arrives, one seat answers it,
 * a second seat verifies the answer, and only then is it closed.
 *
 * every mechanism from the last ten commits is load-bearing here and none of them is
 * decoration: the grant decides whether the reply tool may be called at all, the
 * gateway checks the argument, the checkpoint chain decides what "answered" and
 * "closed" mean, and the strike store is what happens when a seat tries something else.
 */
import { CheckpointRun, evaluateCompletion } from './checkpoints.js';
import { ScopedTool, Verdict, consequence, judge } from './gateway.js';
import { SeatStanding, applyVerdict } from './strikes.js';

export interface SupportTicket {
  id: string;
  asker: string;
  subject: string;
  body: string;
  state: 'open' | 'answered' | 'verified' | 'closed';
}

export interface SupportStore {
  claimOpenTicket(seat: string, at: string): Promise<SupportTicket | null>;
  /** a refused turn must not keep the ticket it took: the claim is a lease, not a state */
  release(ticketId: string, at: string): Promise<void>;
  saveReply(ticketId: string, body: string, by: string, provider: string, at: string): Promise<void>;
  saveEvidence(ticketId: string, runs: CheckpointRun[]): Promise<void>;
  markVerified(ticketId: string, by: string, at: string): Promise<void>;
  standing(seat: string): Promise<SeatStanding>;
  recordRefusal(seat: string, codes: string[], at: string): Promise<void>;
  freeze(seat: string, at: string): Promise<void>;
}

/** the shape a model has to return. a port, so a fixture and a real model are interchangeable */
export interface Proposal {
  tool: string;
  args: Record<string, unknown>;
  reply: string;
  outcome: 'advance' | 'blocked';
}

export const REPLY_TOOL: ScopedTool = { name: 'inbox.reply', surface: 'support.inbox', scopedArgs: ['recipient'] };

/** no key configured in this run, so the responder is a rule. it is still a port. */
export function scriptedResponder(ticket: SupportTicket): Proposal {
  const apologises = /torn|broken|damaged|open seam|missing/i.test(`${ticket.subject} ${ticket.body}`);
  const reply = apologises
    ? `thanks for telling us about ${ticket.id}, and sorry the ${ticket.subject.match(/torn (\w+)/)?.[1] ?? 'item'} arrived damaged. we are sending a replacement and a prepaid return label, no photo needed at this stage.`
    : `thanks for writing in about ${ticket.id}. we have your note and will come back to you within one working day.`;
  return { tool: 'inbox.reply', args: { recipient: 'inbox' }, reply, outcome: 'advance' };
}

/** the second seat reads what was actually stored, not what the first seat said it stored */
export function verifyReply(ticket: SupportTicket, stored: string): { ok: boolean; why?: string } {
  if (!stored.trim()) return { ok: false, why: 'empty_reply' };
  if (/TODO|lorem ipsum|\[insert/i.test(stored)) return { ok: false, why: 'placeholder_text' };
  if (!stored.includes(ticket.id)) return { ok: false, why: 'reply_does_not_reference_ticket' };
  if (stored.length > 1200) return { ok: false, why: 'reply_too_long' };
  if (ticket.body.length > 0 && !/sorry|thanks|apolog/i.test(stored)) return { ok: false, why: 'reply_does_not_acknowledge' };
  return { ok: true };
}

export interface SegmentContext {
  seat: string;
  verifier: string;
  surface: string;
  grant: { tools: string[]; scopes: Record<string, string[]>; spendUsdPerDay?: number };
  spendPerCallUsd?: number;
  /** what wrote the words. a template and a model must not look the same on a row */
  provider?: string;
  now: () => string;
}

export type TicketOutcome =
  | { status: 'no_work' }
  | { status: 'refused'; verdict: Verdict; strikes: number; frozen: boolean }
  | { status: 'answered_unverified'; unmet: string[] }
  | { status: 'verified'; reply: string; checkpoints: string[] };

export async function runTicket(
  ctx: SegmentContext,
  store: SupportStore,
  propose: (t: SupportTicket) => Proposal | Promise<Proposal>,
): Promise<TicketOutcome> {
  const now = ctx.now();
  const ticket = await store.claimOpenTicket(ctx.seat, now);
  if (!ticket) return { status: 'no_work' };

  const proposal = await propose(ticket);

  // the grant and the gateway decide before anything is written
  const standing = await store.standing(ctx.seat);
  if (standing.state !== 'active') {
    await store.release(ticket.id, now);
    const v: Verdict = { ok: false, code: 'struck_out', fatal: true, detail: { seat: ctx.seat } };
    return { status: 'refused', verdict: v, strikes: standing.strikes, frozen: standing.state === 'frozen' };
  }
  const verdict = judge(
    { tool: proposal.tool, args: proposal.args },
    REPLY_TOOL,
    {
      seat: ctx.seat,
      surface: ctx.surface,
      grant: { tools: ctx.grant.tools, spendUsdPerDay: ctx.grant.spendUsdPerDay ?? 0 },
      scopes: ctx.grant.scopes,
      spendPerCallUsd: ctx.spendPerCallUsd ?? 0,
      strikes: standing.strikes,
    },
  );

  if (!verdict.ok) {
    const c = consequence(verdict);
    // found by running it: the claim moved the ticket to answered before the gateway
    // ever looked, so a refusal used to leave a customer stranded in answered-with-no-reply
    await store.release(ticket.id, now);
    if (c.strike) await store.recordRefusal(ctx.seat, [verdict.code ?? 'unknown'], now);
    const after = applyVerdict(standing, verdict, now);
    if (after.froze) await store.freeze(ctx.seat, now);
    return { status: 'refused', verdict, strikes: after.standing.strikes, frozen: after.froze };
  }

  await store.saveReply(ticket.id, proposal.reply, ctx.seat, ctx.provider ?? 'unlabelled', now);

  const runs: CheckpointRun[] = [
    { checkpoint: 'answered', passed: true, evidence: `ticket:${ticket.id}`, by: ctx.seat, at: now },
  ];
  const checked = verifyReply(ticket, proposal.reply);
  runs.push({
    checkpoint: 'closed',
    passed: checked.ok,
    evidence: checked.ok ? `ticket:${ticket.id}` : undefined,
    by: ctx.verifier,
    at: now,
  });

  await store.saveEvidence(ticket.id, runs);
  const completion = evaluateCompletion({ kind: 'support', seat: ctx.seat }, runs);
  if (!completion.ok) {
    return { status: 'answered_unverified', unmet: completion.unmet.map((u) => `${u.checkpoint}:${u.why}`) };
  }

  await store.markVerified(ticket.id, ctx.verifier, now);
  return { status: 'verified', reply: proposal.reply, checkpoints: ['answered', 'closed'] };
}
