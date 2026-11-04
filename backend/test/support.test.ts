import { describe, expect, it } from 'vitest';
import { CheckpointRun } from '../src/domain/checkpoints.js';
import { SeatStanding } from '../src/domain/strikes.js';
import { SegmentContext, SupportStore, SupportTicket, runTicket, scriptedResponder, verifyReply } from '../src/domain/support.js';

/**
 * docs/41. the segment test: a ticket goes in, a verified reply comes out, and every
 * way of cheating it is a case here rather than a hope.
 */
const ticket: SupportTicket = {
  id: 'tkt.1',
  asker: 'ana@example.com',
  subject: 'the hoodie arrived with a torn seam',
  body: 'the left seam is open about 3cm.',
  state: 'open',
};

function memStore(over: { standing?: Partial<SeatStanding>; verify?: (t: SupportTicket, s: string) => boolean } = {}) {
  const log = { replies: [] as string[], runs: [] as CheckpointRun[], refusals: [] as string[][], releases: [] as string[], froze: false, verified: false, spent: 0, reserved: 0, settled: 0 };
  let standing: SeatStanding = { seat: 'seat.support', strikes: 0, state: 'active', ...over.standing };
  const store: SupportStore = {
    async claimOpenTicket() {
      return log.replies.length || log.froze ? null : { ...ticket };
    },
    async release(id) {
      log.releases.push(id);
    },
    async saveReply(_id, body) {
      log.replies.push(body);
    },
    async saveEvidence(_id, runs) {
      log.runs = runs;
    },
    async markVerified() {
      log.verified = true;
    },
    async standing() {
      return standing;
    },
    async spentToday() {
      return log.spent;
    },
    async reserveSpend(_seat, usd) {
      log.spent += usd;
      log.reserved += 1;
    },
    async settleSpend() {
      log.settled += 1;
    },

    async recordRefusal(_seat, codes) {
      log.refusals.push(codes);
      standing = { ...standing, strikes: standing.strikes + 1 };
    },
    async freeze() {
      log.froze = true;
      standing = { ...standing, state: 'frozen' };
    },
  };
  return { store, log, get standing() { return standing; } };
}

const ctx = (over: Partial<SegmentContext> = {}): SegmentContext => ({
  seat: 'seat.support',
  verifier: 'seat.support.qa',
  surface: 'support.inbox',
  grant: { tools: ['inbox.read', 'inbox.reply'], scopes: { 'inbox.reply': ['inbox'], 'inbox.read': ['inbox'] }, spendUsdPerDay: 2 },
  now: () => '2026-11-03T14:00:00.000Z',
  ...over,
});

describe('one ticket, end to end', () => {
  it('answers, verifies and closes it', async () => {
    const m = memStore();
    const out = await runTicket(ctx(), m.store, scriptedResponder);
    expect(out.status).toBe('verified');
    expect(m.log.replies[0]).toContain('tkt.1');
    expect(m.log.verified).toBe(true);
    // the second signature is not the author's
    expect(m.log.runs.map((r) => r.by)).toEqual(['seat.support', 'seat.support.qa']);
  });

  it('refuses at the cap before the model is called, and gives the ticket back', async () => {
    const m = memStore();
    m.log.spent = 1.995;
    let asked = 0;
    const out = await runTicket(
      ctx({ spendPerCallUsd: 0.01 }),
      m.store,
      () => {
        asked += 1;
        return scriptedResponder(ticket);
      },
    );
    expect(out.status).toBe('over_cap');
    expect(asked).toBe(0); // nothing was bought, so nothing was spent
    expect(m.log.releases).toContain('tkt.1');
    expect(m.log.settled).toBe(0);
  });

  it('gives the ticket back when the responder throws', async () => {
    const m = memStore();
    const out = await runTicket(ctx(), m.store, () => {
      throw new Error('insufficient_quota');
    });
    expect(out.status).toBe('failed');
    expect(m.log.releases).toContain('tkt.1');
  });

  it('does no work when the queue is empty, rather than inventing some', async () => {
    const m = memStore();
    await runTicket(ctx(), m.store, scriptedResponder);
    const again = await runTicket(ctx(), m.store, scriptedResponder);
    expect(again.status).toBe('no_work');
    expect(m.log.replies).toHaveLength(1);
  });

  it('refuses a seat without the reply tool and records why', async () => {
    const m = memStore();
    const out = await runTicket(
      ctx({ grant: { tools: ['inbox.read'], scopes: {}, spendUsdPerDay: 2 } }),
      m.store,
      scriptedResponder,
    );
    expect(out.status).toBe('refused');
    expect(m.log.replies).toEqual([]);
    expect(m.log.refusals[0]).toEqual(['tool_not_granted']);
    // the ticket goes back to the queue: a refusal is not a reason to keep the customer
    expect(m.log.releases).toEqual(['tkt.1']);
  });

  it('freezes the seat that reaches twice instead of nudging it a third time', async () => {
    const m = memStore({ standing: { strikes: 1 } });
    const out = await runTicket(
      ctx({ grant: { tools: ['inbox.read'], scopes: {}, spendUsdPerDay: 2 } }),
      m.store,
      scriptedResponder,
    );
    expect(out).toMatchObject({ status: 'refused', frozen: true, strikes: 2 });
    expect(m.log.froze).toBe(true);
  });

  it('refuses to work at all for a seat that is already frozen', async () => {
    const m = memStore({ standing: { state: 'frozen', strikes: 2 } });
    const out = await runTicket(ctx(), m.store, scriptedResponder);
    expect(out.status).toBe('refused');
    expect(m.log.replies).toEqual([]);
  });

  it('sends to an address outside the granted scope only by refusing to', async () => {
    const m = memStore();
    const out = await runTicket(ctx(), m.store, (t) => ({
      ...scriptedResponder(t),
      args: { recipient: 'someone-else@example.com' },
    }));
    expect(out.status).toBe('refused');
    expect(m.log.refusals[0]).toEqual(['scope_outside_grant']);
  });

  it('stores a reply the verifier rejects, and does not close the ticket on it', async () => {
    const m = memStore();
    const out = await runTicket(ctx(), m.store, (t) => ({ ...scriptedResponder(t), reply: 'TODO: answer this' }));
    expect(out.status).toBe('answered_unverified');
    expect(m.log.verified).toBe(false);
    expect(out).toMatchObject({ unmet: ['closed:failed'] });
  });
});

describe('what the verifier will not sign', () => {
  it('accepts a reply that references the ticket and acknowledges the problem', () => {
    expect(verifyReply(ticket, scriptedResponder(ticket).reply).ok).toBe(true);
  });

  it('rejects a placeholder, a blank, and a reply about some other ticket', () => {
    expect(verifyReply(ticket, 'lorem ipsum dolor').why).toBe('placeholder_text');
    expect(verifyReply(ticket, '   ').why).toBe('empty_reply');
    expect(verifyReply(ticket, 'thanks! all sorted.').why).toBe('reply_does_not_reference_ticket');
  });
});
