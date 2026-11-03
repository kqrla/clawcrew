/**
 * docs/35. a message between decoupled seats, and the one invariant that keeps
 * convergence from eating nuance.
 *
 * A2A solves transport: agent cards, tasks, artifacts, streaming. it does not say
 * what a *claim* is, so it cannot stop two seats from merging into a prose summary
 * that quietly loses the disagreement. the fix is not a better prompt. it is that a
 * synthesis must account for every claim it was given: kept, challenged, dropped
 * with a rebuttal, or unresolved. nothing leaves the room silently.
 */

/** the w-framework's fact kinds, so a plan can never be mistaken for a capability */
export type ClaimKind = 'fact' | 'inference' | 'preference' | 'plan';

export interface Claim {
  id: string;
  kind: ClaimKind;
  statement: string;
  /** a resolvable reference. required for a fact, optional for the rest */
  evidence?: string;
  confidence: number;
  basis?: string;
  by: string;
  /** ids this claim argues against, declared by the seat rather than guessed by us */
  opposes?: string[];
}

export interface DiscourseMessage {
  id: string;
  thread: string;
  from: string;
  to: string;
  intent: string;
  claims: Claim[];
  questions: string[];
  refs: string[];
  at: string;
  supersedes?: string;
}

export type Fault = { rule: string; detail: string };

// a scheme, then a payload. `commit:abc`, `artifact://sha256/x`, `http:GET <url>`
const REF = /^[a-z][a-z0-9]*:\s*\S/;

export function validateMessage(m: DiscourseMessage): Fault[] {
  const faults: Fault[] = [];
  if (!m.intent.trim()) faults.push({ rule: 'message_needs_an_intent', detail: m.id });
  if (m.claims.length === 0 && m.questions.length === 0) {
    faults.push({ rule: 'message_says_nothing', detail: m.id });
  }
  const seen = new Set<string>();
  for (const c of m.claims) {
    if (seen.has(c.id)) faults.push({ rule: 'duplicate_claim_id', detail: c.id });
    seen.add(c.id);
    if (c.kind === 'fact' && !(c.evidence && REF.test(c.evidence))) {
      faults.push({ rule: 'fact_without_evidence', detail: c.id });
    }
    if (!(c.confidence >= 0 && c.confidence <= 1)) {
      faults.push({ rule: 'confidence_out_of_range', detail: c.id });
    }
    if (c.kind === 'plan' && c.confidence >= 0.9) {
      // a plan asserted as near-certain is the overclaim the w-framework refuses
      faults.push({ rule: 'plan_stated_as_fact', detail: c.id });
    }
  }
  for (const o of m.claims.flatMap((c) => c.opposes ?? [])) {
    if (!m.claims.some((c) => c.id === o)) {
      faults.push({ rule: 'opposes_an_absent_claim', detail: o });
    }
  }
  return faults;
}

export interface Branch {
  from: string;
  claims: Claim[];
  questions: string[];
}

export type Disposition = 'kept' | 'challenged' | 'dropped' | 'unresolved';

export interface Synthesis {
  kept: Claim[];
  /** kept, and explicitly contested: the dissent that survives the merge */
  challenged: Claim[];
  dropped: { claim: Claim; rebuttal: string }[];
  unresolved: { claim: Claim; why: string }[];
  questions: string[];
  /** claims two seats agree on, with no evidence between them: agreement is not proof */
  agreementWithoutEvidence: string[];
  faults: Fault[];
}

const LOW_CONFIDENCE = 0.4;

export function synthesize(
  branches: Branch[],
  opts: { rebuttals?: Record<string, string> } = {},
): Synthesis {
  const rebuttals = opts.rebuttals ?? {};
  const all = branches.flatMap((b) => b.claims);
  const byId = new Map<string, Claim>();

  const faults: Fault[] = [];
  for (const c of all) {
    const clash = byId.get(c.id);
    if (clash && clash.statement !== c.statement) {
      // two seats asserting different things under one id is a merge hazard, not a
      // detail: the id is the unit of accounting, so it has to mean one thing
      faults.push({ rule: 'claim_id_collision', detail: c.id });
    }
    byId.set(c.id, c);
  }

  // who opposes whom, in both directions
  const opposed = new Set<string>();
  for (const c of all) {
    for (const o of c.opposes ?? []) {
      opposed.add(c.id);
      opposed.add(o);
    }
  }

  const kept: Claim[] = [];
  const challenged: Claim[] = [];
  const dropped: { claim: Claim; rebuttal: string }[] = [];
  const unresolved: { claim: Claim; why: string }[] = [];

  for (const c of byId.values()) {
    if (opposed.has(c.id)) {
      // disagreement is not ours to settle. it stays visible and it stays contested
      challenged.push(c);
      continue;
    }
    if (c.confidence < LOW_CONFIDENCE && !c.evidence) {
      unresolved.push({ claim: c, why: 'low_confidence_without_evidence' });
      continue;
    }
    const rebuttal = rebuttals[c.id];
    if (rebuttal !== undefined) {
      if (c.evidence && !REF.test(rebuttal)) {
        // you may not discard a sourced claim on vibes
        faults.push({ rule: 'rebuttal_needs_evidence', detail: c.id });
        kept.push(c);
        continue;
      }
      dropped.push({ claim: c, rebuttal });
      continue;
    }
    kept.push(c);
  }

  // the conservation rule: every claim is in exactly one bucket
  const buckets = [
    ...kept.map((c) => c.id),
    ...challenged.map((c) => c.id),
    ...dropped.map((d) => d.claim.id),
    ...unresolved.map((u) => u.claim.id),
  ];
  for (const id of byId.keys()) {
    const n = buckets.filter((b) => b === id).length;
    if (n !== 1) faults.push({ rule: 'claim_not_accounted_for', detail: `${id}:${n}` });
  }

  // two seats agreeing is corroboration, not evidence
  const agreementWithoutEvidence = kept
    .filter((c) => !c.evidence && new Set(all.filter((x) => x.statement === c.statement).map((x) => x.by)).size > 1)
    .map((c) => c.id);

  const questions = [...new Set(branches.flatMap((b) => b.questions))];

  return { kept, challenged, dropped, unresolved, questions, agreementWithoutEvidence, faults };
}

/** a synthesis is only usable when it lost nothing and every rebuttal was sourced */
export const synthesisIsSound = (s: Synthesis): boolean =>
  s.faults.length === 0 && s.challenged.length + s.unresolved.length + s.kept.length + s.dropped.length > 0;
