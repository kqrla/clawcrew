import { describe, expect, it } from 'vitest';
import { Claim } from '../backend/src/domain/discourse.js';
import { Debate, debate, gateAccepts } from './debate.js';

const claim = (over: Partial<Claim> = {}): Claim => ({
  id: 'a1',
  kind: 'fact',
  statement: 'a fourth outfit room costs 9 hours of catalog work',
  evidence: 'run:catalog estimate --room outerwear',
  confidence: 0.7,
  by: 'seat.design',
  ...over,
});

const base: Debate = {
  question: 'fourth outfit room, or deepen the three that exist',
  positions: [
    {
      seat: 'seat.design',
      stance: 'for',
      claims: [claim()],
      falsifier: 'run:catalog verify --room outerwear exits non-zero twice in a row',
    },
    {
      seat: 'seat.financials',
      stance: 'against',
      claims: [
        claim({
          id: 'b1',
          kind: 'inference',
          evidence: undefined,
          confidence: 0.6,
          statement: 'a fourth room dilutes support without a pricing tier',
          by: 'seat.financials',
          opposes: ['a1'],
        }),
      ],
      falsifier: 'sql:select count(*) from ticket where surface = $1 having count(*) < 5',
    },
  ],
  rebuttals: [
    {
      by: 'seat.financials',
      steelman: 'a fourth room is the cheapest way to make the catalog feel worth returning to',
      answers: 'seat.design',
      claims: [],
    },
  ],
};

const rules = (m: { faults: { rule: string }[] }) => m.faults.map((f) => f.rule);

describe('a debate that cannot bind', () => {
  it('produces an advisory memo and nothing more', () => {
    const m = debate(base);
    expect(m.authority).toBe('advisory');
    expect(m.faults).toEqual([]);
    expect(m.falsifiers).toHaveLength(2);
  });

  it('refuses a position with no falsifier', () => {
    const d: Debate = { ...base, positions: [{ ...base.positions[0]!, falsifier: '  ' }] };
    expect(rules(debate(d))).toContain('position_without_a_falsifier');
  });

  it('refuses a rebuttal that never states the case it answers', () => {
    const d: Debate = { ...base, rebuttals: [{ ...base.rebuttals[0]!, steelman: 'that is wrong' }] };
    expect(rules(debate(d))).toContain('rebuttal_without_a_steelman');
  });

  it('refuses a voice from outside the debate', () => {
    const d: Debate = { ...base, rebuttals: [{ ...base.rebuttals[0]!, by: 'seat.support' }] };
    expect(rules(debate(d))).toContain('rebuttal_from_a_non_participant');
  });

  it('keeps both sides of a live disagreement instead of resolving it', () => {
    const m = debate(base);
    expect(m.split.map((c) => c.id).sort()).toEqual(['a1', 'b1']);
    expect(m.survived).toEqual([]);
  });

  it('calls unanimity by framing what it is when nobody brought evidence', () => {
    const agreed = {
      ...base,
      positions: base.positions.map((p) => ({
        ...p,
        claims: [claim({ id: `${p.seat}.x`, statement: 'go deep first', evidence: undefined, kind: 'preference' as const })],
      })),
      rebuttals: [],
    };
    expect(debate(agreed).unanimousByFraming).toBe(true);
  });

  it('treats independent agreement as more than agreement', () => {
    const independent: Debate = {
      question: 'ship the room',
      positions: [
        { seat: 'seat.design', stance: 'for', claims: [claim({ id: 'd1' })], falsifier: 'run:x' },
        { seat: 'seat.financials', stance: 'for', claims: [claim({ id: 'f1', evidence: 'run:y' })], falsifier: 'sql:select 1' },
      ],
      rebuttals: [],
    };
    expect(debate(independent).unanimousByFraming).toBe(false);
  });

  it('cannot be handed to a gate, and says why in both cases', () => {
    const m = debate(base);
    expect(gateAccepts(m).reason).toBe('a_memo_is_advisory_not_evidence');
    expect(gateAccepts({ authority: 'binding' }).reason).toBe('a_gate_takes_evidence_not_argument');
  });
});
