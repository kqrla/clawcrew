import { describe, expect, it } from 'vitest';
import { Claim, DiscourseMessage, synthesize, validateMessage } from '../src/domain/discourse.js';

const claim = (over: Partial<Claim> = {}): Claim => ({
  id: 'c1',
  kind: 'fact',
  statement: 'the printer quotes 38.00 for a 100mm figure',
  evidence: 'http:GET https://quotes.example/api/v1/quote/100mm',
  confidence: 0.9,
  by: 'seat.operations',
  ...over,
});

const msg = (over: Partial<DiscourseMessage> = {}): DiscourseMessage => ({
  id: 'm1',
  thread: 'th.unit-cost',
  from: 'seat.operations',
  to: 'seat.financials',
  intent: 'hand over the quote so pricing can be set',
  claims: [claim()],
  questions: [],
  refs: [],
  at: '2026-11-03T00:00:00.000Z',
  ...over,
});

const rules = (faults: { rule: string }[]) => faults.map((f) => f.rule);

describe('a claim carries its own provenance', () => {
  it('accepts a sourced fact', () => {
    expect(validateMessage(msg())).toEqual([]);
  });

  it('refuses a fact with no evidence', () => {
    expect(rules(validateMessage(msg({ claims: [claim({ evidence: undefined })] })))).toContain('fact_without_evidence');
  });

  it('refuses evidence that is prose wearing a colon', () => {
    const bad = claim({ evidence: 'the printer said so' });
    expect(rules(validateMessage(msg({ claims: [bad] })))).toContain('fact_without_evidence');
  });

  it('refuses a plan dressed as certainty', () => {
    const plan = claim({ kind: 'plan', evidence: undefined, confidence: 0.95 });
    expect(rules(validateMessage(msg({ claims: [plan] })))).toContain('plan_stated_as_fact');
  });

  it('refuses a message that says nothing', () => {
    expect(rules(validateMessage(msg({ claims: [], questions: [] })))).toContain('message_says_nothing');
  });

  it('refuses opposition to a claim that is not in the message', () => {
    expect(rules(validateMessage(msg({ claims: [claim({ opposes: ['c9'] })] })))).toContain('opposes_an_absent_claim');
  });
});

describe('convergence that cannot lose anything', () => {
  it('keeps what agrees and carries what disagrees', () => {
    const a = { from: 'seat.operations', claims: [claim({ id: 'a1' })], questions: [] };
    const b = {
      from: 'seat.financials',
      claims: [claim({ id: 'b1', statement: 'the ceiling must be met before launch', kind: 'preference', evidence: undefined, opposes: ['a1'] })],
      questions: ['does the quote include shipping?'],
    };
    const s = synthesize([a, b]);
    expect(s.faults).toEqual([]);
    expect(s.kept.map((c) => c.id)).toEqual([]);
    expect(s.challenged.map((c) => c.id).sort()).toEqual(['a1', 'b1']);
    expect(s.questions).toEqual(['does the quote include shipping?']);
  });

  it('accounts for every claim exactly once, always', () => {
    const branches = [
      { from: 'a', claims: [claim({ id: 'x1' }), claim({ id: 'x2', confidence: 0.2, evidence: undefined, kind: 'inference' })], questions: [] },
      { from: 'b', claims: [claim({ id: 'y1' })], questions: [] },
    ];
    const s = synthesize(branches, { rebuttals: { y1: 'run:catalog verify --quote' } });
    const ids = [
      ...s.kept.map((c) => c.id),
      ...s.challenged.map((c) => c.id),
      ...s.dropped.map((d) => d.claim.id),
      ...s.unresolved.map((u) => u.claim.id),
    ].sort();
    expect(ids).toEqual(['x1', 'x2', 'y1']);
  });

  it('will not drop a sourced claim on an unsourced objection', () => {
    const s = synthesize([{ from: 'a', claims: [claim({ id: 'z1' })], questions: [] }], { rebuttals: { z1: 'i disagree' } });
    expect(rules(s.faults)).toContain('rebuttal_needs_evidence');
    expect(s.kept.map((c) => c.id)).toEqual(['z1']);
  });

  it('drops a sourced claim when the objection is sourced too', () => {
    const s = synthesize([{ from: 'a', claims: [claim({ id: 'z2' })], questions: [] }], {
      rebuttals: { z2: 'http:GET https://quotes.example/api/v1/quote/100mm/current' },
    });
    expect(s.faults).toEqual([]);
    expect(s.dropped.map((d) => d.claim.id)).toEqual(['z2']);
  });

  it('holds a weak claim as unresolved rather than deciding it', () => {
    const weak = claim({ id: 'w1', kind: 'inference', evidence: undefined, confidence: 0.2 });
    const s = synthesize([{ from: 'a', claims: [weak], questions: [] }]);
    expect(s.unresolved.map((u) => u.claim.id)).toEqual(['w1']);
  });

  it('marks agreement without evidence as agreement, not proof', () => {
    const price = { kind: 'inference' as const, evidence: undefined, statement: 'unit cost lands near 40' };
    const s = synthesize([
      { from: 'a', claims: [claim({ id: 'p1', by: 'seat.financials', ...price })], questions: [] },
      { from: 'b', claims: [claim({ id: 'p2', by: 'seat.operations', ...price })], questions: [] },
    ]);
    expect(s.agreementWithoutEvidence).toEqual(['p1', 'p2']);
  });

  it('refuses two different statements wearing one id', () => {
    const s = synthesize([
      { from: 'a', claims: [claim({ id: 'same' })], questions: [] },
      { from: 'b', claims: [claim({ id: 'same', statement: 'something else entirely' })], questions: [] },
    ]);
    expect(rules(s.faults)).toContain('claim_id_collision');
  });
});
