import { describe, expect, it } from 'vitest';
import { Claim } from '../src/domain/discourse.js';
import { Proposal, TurnContext, auditProposal, runTurn } from '../src/domain/turn.js';

/**
 * docs/37. the method is not a framework, it is a check that runs after generation:
 * a proposal is not a permission, and a prompt is not a policy.
 */
const ctx = (over: Partial<TurnContext> = {}): TurnContext => ({
  task: {
    id: 't.meenible.support.1',
    seat: 'seat.support',
    slice: 'support.inbox',
    kind: 'support',
    objectiveRef: 'obj.meenible.support.inbox',
    acceptance: 'a stranger answers a refund question without the author',
  },
  grant: { tools: ['inbox.read', 'inbox.reply'] },
  bindings: [
    { tool: 'inbox.read', surface: 'support.inbox' },
    { tool: 'inbox.reply', surface: 'support.inbox' },
    { tool: 'repo.push', surface: 'code.change' },
  ],
  ...over,
});

const claim = (over: Partial<Claim> = {}): Claim => ({
  id: 'c1',
  kind: 'inference',
  statement: 'the refund question is answerable from the policy page',
  confidence: 0.8,
  by: 'seat.support',
  ...over,
});

const proposal = (over: Partial<Proposal> = {}): Proposal => ({
  claims: [claim()],
  calls: [{ tool: 'inbox.read', args: { limit: 10 } }],
  outcome: 'advance',
  artifacts: ['ticket:t_8812'],
  ...over,
});

const codes = (p: Proposal, c = ctx()) => auditProposal(p, c).map((f) => f.code);

describe('a proposal has to pass one gate, after it is generated', () => {
  it('accepts a granted call on its own slice with an artifact to show for it', () => {
    expect(codes(proposal())).toEqual([]);
  });

  it('refuses a tool the seat was never granted', () => {
    const p = proposal({ calls: [{ tool: 'stripe.charge', args: { amount: 8900 } }] });
    expect(codes(p)).toEqual(['tool_not_granted']);
  });

  it('refuses a granted tool that reaches another slice', () => {
    const c = ctx({ grant: { tools: ['repo.push'] } });
    const p = proposal({ calls: [{ tool: 'repo.push', args: { branch: 'main' } }] });
    expect(codes(p, c)).toEqual(['call_on_another_slice']);
  });

  it('refuses a grant that names no surface, because reach must be attributable', () => {
    const c = ctx({ grant: { tools: ['shell.everything'] }, bindings: [] });
    const p = proposal({ calls: [{ tool: 'shell.everything', args: {} }] });
    expect(codes(p, c)).toEqual(['tool_not_granted']);
  });

  it('refuses "done" with nothing to look at', () => {
    expect(codes(proposal({ artifacts: [] }))).toEqual(['advance_without_artifact']);
  });

  it('refuses a fact with no reference behind it', () => {
    const p = proposal({ claims: [claim({ kind: 'fact', evidence: undefined })] });
    expect(codes(p)).toEqual(['claim_not_well_formed']);
  });

  it('refuses a block or a refusal that does not say why', () => {
    expect(codes(proposal({ outcome: 'block' }))).toEqual(['block_without_a_reason']);
    expect(codes(proposal({ outcome: 'refuse', artifacts: [] }))).toEqual(['refuse_without_a_reason']);
  });

  it('reports every fault at once, so one retry can fix several', () => {
    const p = proposal({
      calls: [{ tool: 'stripe.charge', args: {} }],
      artifacts: [],
      claims: [claim({ kind: 'fact', evidence: 'trust me' })],
    });
    expect(codes(p)).toEqual(['tool_not_granted', 'claim_not_well_formed', 'advance_without_artifact']);
  });
});

describe('a turn is a receipt, not a verdict on the model', () => {
  it('records what was attempted when the model fails outright', async () => {
    const r = await runTurn(ctx(), {
      async propose() {
        throw new Error('context_length_exceeded');
      },
    });
    expect(r.accepted).toBe(false);
    expect(r.retryable).toBe(true);
    expect(r.faults[0]!.detail).toContain('context_length_exceeded');
  });

  it('does not retry a proposal that reached the wrong surface, because the model cannot be trusted to try again', async () => {
    const c = ctx({ grant: { tools: ['repo.push'] } });
    const r = await runTurn(c, { async propose() { return proposal({ calls: [{ tool: 'repo.push', args: {} }] }); } });
    expect(r.accepted).toBe(false);
    expect(r.retryable).toBe(false);
  });

  it('gives an accepted turn an effect the ledger can write, and counts the prompt', async () => {
    const r = await runTurn(ctx(), { async propose() { return proposal(); } }, [claim({ id: 'ctx1' })]);
    expect(r.accepted).toBe(true);
    expect(r.effect).toEqual({ outcome: 'advance', artifacts: ['ticket:t_8812'], claims: 1 });
    expect(r.promptTokens).toEqual({ tools: 2, claims: 1 });
  });

  it('sends the seat only its own tools, never the whole shelf', async () => {
    let seen: string[] = [];
    await runTurn(ctx(), {
      async propose(p) {
        seen = p.tools;
        return proposal();
      },
    });
    expect(seen).toEqual(['inbox.read', 'inbox.reply']);
    expect(seen).not.toContain('repo.push');
  });
});
