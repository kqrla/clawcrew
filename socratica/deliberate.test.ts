import { describe, expect, it } from 'vitest';
import { Candidate, Seat, deliberate, dispatchNext, gateAccepts } from './deliberate.js';

const cand = (id: string, over: Partial<Candidate> = {}): Candidate => ({
  id,
  slice: 'code.repo',
  title: id,
  costHours: 4,
  ...over,
});

const fact = (id: string, evidence: string) =>
  ({ id, kind: 'fact' as const, statement: id, evidence, confidence: 0.9, by: 'seat.x' });

const seat = (name: string, positions: Seat['positions']): Seat => ({
  seat: name,
  interest: 'stated so the others can attack it',
  positions,
});

describe('the work set is chosen before the work, not after it', () => {
  it('orders what the room argues for, and postpones what it argues against', () => {
    const plan = deliberate({
      question: 'which gauge first',
      candidates: [cand('cost_gauge', { blocksLaunch: true }), cand('media_room', { costHours: 20 })],
      seats: [
        seat('seat.financials', [
          { candidate: 'cost_gauge', stance: 'do-first', claim: fact('c1', 'http:GET quote') },
          {
            candidate: 'media_room',
            stance: 'do-later',
            claim: fact('c2', 'run:catalog verify'),
            falsifier: 'a licence record exists for every shipped part',
          },
        ]),
      ],
    });
    expect(plan.order.map((o) => o.candidate)).toEqual(['cost_gauge']);
    expect(plan.deferred).toEqual([
      expect.objectContaining({ candidate: 'media_room', falsifier: 'a licence record exists for every shipped part' }),
    ]);
    expect(plan.faults).toEqual([]);
  });

  it('no single seat can remove a candidate, only postpone it', () => {
    const plan = deliberate({
      question: 'q',
      candidates: [cand('media_room')],
      seats: [
        seat('seat.security', [
          {
            candidate: 'media_room',
            stance: 'never',
            claim: fact('c1', 'run:scan report'),
            falsifier: 'every part has a licence record',
          },
        ]),
        seat('seat.design', [{ candidate: 'media_room', stance: 'do-first', claim: fact('c2', 'run:catalog verify') }]),
      ],
    });
    expect(plan.omitted).toEqual([]);
    expect(plan.deferred.map((d) => d.candidate)).toEqual(['media_room']);
    expect(plan.dissent.map((d) => d.seat)).toContain('seat.security');
  });

  it('omits only when every voice that spoke said the same thing', () => {
    const plan = deliberate({
      question: 'q',
      candidates: [cand('video_channel')],
      seats: [
        seat('seat.media', [
          { candidate: 'video_channel', stance: 'never', claim: fact('c1', 'run:asset verify'), falsifier: 'a paying order exists' },
        ]),
        seat('seat.operations', [
          { candidate: 'video_channel', stance: 'never', claim: fact('c2', 'run:check run'), falsifier: 'support queue is empty for a week' },
        ]),
      ],
    });
    expect(plan.omitted.map((o) => o.candidate)).toEqual(['video_channel']);
    expect(plan.omitted[0]!.because).toContain('seat.media');
  });

  it('refuses a postponement with no falsifier, because that is a graveyard', () => {
    const plan = deliberate({
      question: 'q',
      candidates: [cand('a')],
      seats: [
        seat('seat.x', [{ candidate: 'a', stance: 'do-later', claim: fact('c1', 'run:check run') }]),
      ],
    });
    expect(plan.faults).toContain('postponement_without_a_falsifier:a');
  });

  it('refuses a stance with no claim behind it', () => {
    const plan = deliberate({
      question: 'q',
      candidates: [cand('a')],
      seats: [seat('seat.x', [{ candidate: 'a', stance: 'do-first', claim: undefined as never }])],
    });
    expect(plan.faults).toContain('stance_without_a_claim:a');
  });

  it('never loses a candidate, however the room feels about it', () => {
    const plan = deliberate({
      question: 'q',
      candidates: [cand('a'), cand('b'), cand('c'), cand('d')],
      seats: [seat('seat.x', [{ candidate: 'a', stance: 'do-first', claim: fact('c1', 'run:check run') }])],
    });
    const all = [
      ...plan.order.map((o) => o.candidate),
      ...plan.deferred.map((d) => d.candidate),
      ...plan.omitted.map((o) => o.candidate),
    ];
    expect(all.sort()).toEqual(['a', 'b', 'c', 'd']);
    expect(plan.faults.filter((f) => f.startsWith('candidate_lost'))).toEqual([]);
  });

  it('says a plan cannot bind, and means it', () => {
    const plan = deliberate({ question: 'q', candidates: [cand('a')], seats: [] });
    expect(plan.authority).toBe('proposal');
    expect(gateAccepts(plan)).toBe(false);
  });
});

describe('the order is a queue, so it has to be executable', () => {
  const base = {
    question: 'q',
    candidates: [cand('dep', { costHours: 8 }), cand('work', { dependsOn: ['dep'], costHours: 1 })],
    seats: [
      seat('seat.x', [
        { candidate: 'work', stance: 'do-first', claim: fact('c1', 'run:check run') },
        { candidate: 'dep', stance: 'do-first', claim: fact('c2', 'run:scan report') },
      ]),
    ],
  };

  it('moves a dependency ahead of the thing that needs it', () => {
    const plan = deliberate(base);
    expect(plan.order.map((o) => o.candidate)).toEqual(['dep', 'work']);
    expect(plan.faults).toContain('order_repaired:work');
  });

  it('postpones work whose dependency is postponed, rather than pretending', () => {
    const plan = deliberate({
      question: 'q',
      candidates: [cand('dep'), cand('work', { dependsOn: ['dep'] })],
      seats: [
        seat('seat.x', [
          { candidate: 'work', stance: 'do-first', claim: fact('c1', 'run:check run') },
          { candidate: 'dep', stance: 'do-later', claim: fact('c2', 'run:scan report'), falsifier: 'a printer is chosen' },
        ]),
      ],
    });
    expect(plan.order).toEqual([]);
    expect(plan.deferred.map((d) => d.candidate).sort()).toEqual(['dep', 'work']);
    expect(plan.deferred.find((d) => d.candidate === 'work')!.because).toContain('postponed');
  });

  it('hands the scheduler the first ready item and nothing postponed', () => {
    const plan = deliberate(base);
    expect(dispatchNext(plan, [])).toEqual({ next: 'dep' });
    expect(dispatchNext(plan, ['dep'])).toEqual({ next: 'work' });
    expect(dispatchNext(plan, ['dep', 'work'])).toEqual({ waiting: [] });
  });

  it('keeps a this-cycle cap honest by deferring with a reason, not dropping', () => {
    const plan = deliberate(
      {
        question: 'q',
        candidates: [cand('a'), cand('b'), cand('c')],
        seats: [seat('seat.x', ['a', 'b', 'c'].map((id, i) => ({ candidate: id, stance: 'do-first' as const, claim: fact(`c${i}`, 'run:check run') })))],
      },
      { topN: 2 },
    );
    expect(plan.order).toHaveLength(2);
    expect(plan.deferred.map((d) => d.candidate)).toEqual(['c']);
  });
});
