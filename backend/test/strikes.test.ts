import { describe, expect, it } from 'vitest';
import { Verdict } from '../src/domain/gateway.js';
import { SeatStanding, STRIKE_LIMIT, applyVerdict, clearStrikes } from '../src/domain/strikes.js';

/**
 * docs/39. the limit was a constant with no memory. now the seat carries its own count.
 */
const at = '2026-11-03T13:00:00.000Z';
const standing = (over: Partial<SeatStanding> = {}): SeatStanding => ({
  seat: 'seat.support',
  strikes: 0,
  state: 'active',
  ...over,
});
const reach: Verdict = { ok: false, code: 'tool_not_granted', escalate: true, fatal: true };
const arithmetic: Verdict = { ok: false, code: 'spend_not_reserved' };
const scope: Verdict = { ok: false, code: 'scope_outside_grant', escalate: true, fatal: true };
const allowed: Verdict = { ok: true };

describe('a strike is a memory, not a mood', () => {
  it('records the first reach and keeps the seat working', () => {
    const out = applyVerdict(standing(), reach, at);
    expect(out.froze).toBe(false);
    expect(out.standing.strikes).toBe(1);
    expect(out.standing.state).toBe('active');
    expect(out.standing.lastStrike).toMatchObject({ code: 'tool_not_granted', at });
  });

  it('freezes on the second, which is the whole point of counting', () => {
    const out = applyVerdict(standing({ strikes: STRIKE_LIMIT - 1 }), scope, at);
    expect(out.froze).toBe(true);
    expect(out.standing.state).toBe('frozen');
    expect(out.standing.lastStrike?.code).toBe('scope_outside_grant');
  });

  it('spares arithmetic, so a budget refusal is not a character flaw', () => {
    const out = applyVerdict(standing(), arithmetic, at);
    expect(out.standing.strikes).toBe(0);
    expect(out.spared).toBe('not_a_strike');
  });

  it('spares a successful call, and does not reward it either', () => {
    const out = applyVerdict(standing({ strikes: 1 }), allowed, at);
    expect(out.standing.strikes).toBe(1);
  });

  it('does not keep striking a seat that is already frozen or burned', () => {
    expect(applyVerdict(standing({ state: 'frozen', strikes: 2 }), reach, at).spared).toBe('already_frozen');
    expect(applyVerdict(standing({ state: 'burned', strikes: 2 }), reach, at).spared).toBe('burned');
  });

  it('clears only when a person has looked, and says so by resetting the count', () => {
    const cleared = clearStrikes(standing({ strikes: 2, state: 'frozen', lastStrike: { code: 'x', at } }));
    expect(cleared).toEqual({ seat: 'seat.support', strikes: 0, state: 'active' });
  });

  it('never brings a burned seat back, because burn has no inverse', () => {
    const burned = clearStrikes(standing({ strikes: 2, state: 'burned' }));
    expect(burned.state).toBe('burned');
  });
});

describe('a refusal is written down where it happened', () => {
  it('hands the seat and the codes to the store, so the limit has a memory', async () => {
    const seen: { seat: string; codes: string[] }[] = [];
    const { runTurn } = await import('../src/domain/turn.js');
    const result = await runTurn(
      {
        task: { id: 't1', slice: 'support', kind: 'support', objectiveRef: 'obj.x' },
        seat: 'seat.support',
        grant: { tools: ['inbox.reply'] },
        bindings: [],
      } as never,
      {
        async propose() {
          return { claims: [], calls: [{ tool: 'repo.push', args: {} }], outcome: 'advance' };
        },
        async recordRefusal(seat: string, codes: string[]) {
          seen.push({ seat, codes });
        },
      },
      0 as never,
    );
    expect(result.accepted).toBe(false);
    expect(seen[0]?.seat).toBe('seat.support');
    expect(seen[0]?.codes).toContain('tool_not_granted');
  });
});
