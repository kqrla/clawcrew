/**
 * socratica. a debate that informs and cannot bind.
 *
 * the module is deterministic on purpose: it arranges arguments, it does not generate
 * them. the arguing is done by seats, and what is checked here is the shape of the
 * argument, which is where debates usually cheat: a rebuttal with no steelman, a
 * position with no falsifier, a majority treated as a conclusion, a memo that quietly
 * becomes a veto.
 */
import { Claim } from '../backend/src/domain/discourse.js';

export type Stance = 'for' | 'against' | 'conditional';

export interface Position {
  seat: string;
  stance: Stance;
  claims: Claim[];
  /** the observation that would make this seat drop its position. prose or a command */
  falsifier: string;
}

export interface Rebuttal {
  by: string;
  /** the strongest version of the position being answered, in the answerer's words */
  steelman: string;
  answers: string;
  claims: Claim[];
}

export interface Debate {
  question: string;
  positions: Position[];
  rebuttals: Rebuttal[];
}

export interface Memo {
  question: string;
  positions: Position[];
  steelmen: { by: string; steelman: string; answers: string }[];
  /** claims with evidence that nobody rebutted with evidence */
  survived: Claim[];
  /** claims still contested, both sides intact */
  split: Claim[];
  falsifiers: { seat: string; test: string }[];
  recommendation: { by: string; claim: Claim } | null;
  unanimousByFraming: boolean;
  authority: 'advisory';
  faults: { rule: string; detail: string }[];
}

const REF = /^[a-z][a-z0-9]*:\s*\S/;

export function debate(d: Debate): Memo {
  const faults: { rule: string; detail: string }[] = [];

  for (const p of d.positions) {
    if (!p.falsifier.trim()) {
      // a position with nothing that could refute it is not arguable, so it is not
      // allowed to look like an argument
      faults.push({ rule: 'position_without_a_falsifier', detail: p.seat });
    }
  }

  const answered = new Set(d.rebuttals.map((r) => r.by));
  for (const r of d.rebuttals) {
    if (r.steelman.trim().length < 20) {
      faults.push({ rule: 'rebuttal_without_a_steelman', detail: r.by });
    }
    if (!d.positions.some((p) => p.seat === r.by)) {
      faults.push({ rule: 'rebuttal_from_a_non_participant', detail: r.by });
    }
  }

  const contested = new Set(d.positions.flatMap((p) => p.claims.flatMap((c) => c.opposes ?? [])));
  const rebutted = new Set(d.rebuttals.flatMap((r) => r.claims.flatMap((c) => c.opposes ?? [])));

  const all = d.positions.flatMap((p) => p.claims);
  // a claim that argues against something is part of the disagreement, not beside it
  const arguing = (c: Claim) => (c.opposes?.length ?? 0) > 0;
  const survived = all.filter(
    (c) => !contested.has(c.id) && !rebutted.has(c.id) && !arguing(c) && c.evidence && REF.test(c.evidence),
  );
  const split = all.filter((c) => contested.has(c.id) || rebutted.has(c.id) || arguing(c));

  // independent agreement means distinct evidence, not distinct sentences
  const evidenceRefs = new Set(survived.map((c) => c.evidence));
  const unanimousByFraming = d.positions.length > 1 && split.length === 0 && evidenceRefs.size < 2;

  const first = d.positions[0];
  const recommendation =
    d.positions.length === 1 && first && first.claims[0]
      ? { by: first.seat, claim: first.claims[0] }
      : null;

  return {
    question: d.question,
    positions: d.positions,
    steelmen: d.rebuttals.map((r) => ({ by: r.by, steelman: r.steelman, answers: r.answers })),
    survived,
    split,
    falsifiers: d.positions.map((p) => ({ seat: p.seat, test: p.falsifier })),
    recommendation,
    unanimousByFraming,
    authority: 'advisory',
    faults,
  };
}

/** the only thing a memo may be handed to. never a gate */
export const memoIsUsable = (m: Memo): boolean => m.faults.length === 0 && m.question.trim().length > 0;

/** a gate must refuse a memo: a debate that could block would be a veto */
export function gateAccepts(memo: unknown): { ok: false; reason: string } {
  const kind = (memo as Memo | null)?.authority;
  return { ok: false, reason: kind === 'advisory' ? 'a_memo_is_advisory_not_evidence' : 'a_gate_takes_evidence_not_argument' };
}
