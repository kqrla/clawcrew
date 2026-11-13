/**
 * docs/55. what counts as done, per kind.
 *
 * until this existed, "complete" meant "some evidence landed", which is the same as trusting the
 * seat. a rule says what the evidence has to be, how much of it, how old it may be, and whether a
 * second seat has to sign it. no rule means no completion: an unknown kind is a refusal, not a
 * default.
 */
export interface Rule {
  kind: string;
  requires: string;
  sourcePattern: string;
  minCount: number;
  maxAgeHours: number;
  needsSecondSeat: boolean;
}
export interface Proof {
  kind: string;
  source: string;
  runBy: string;
  computedAt: Date;
}
export type Verdict =
  | { ok: true; accepted: Proof[] }
  | { ok: false; why: 'no_rule' | 'source_mismatch' | 'too_few' | 'stale' | 'unsigned' };

export function checkEvidence(rule: Rule | undefined, proofs: Proof[], now: Date): Verdict {
  if (!rule) return { ok: false, why: 'no_rule' };

  const rightKind = proofs.filter((p) => p.kind === rule.kind);
  if (rightKind.length === 0) return { ok: false, why: 'source_mismatch' };

  const re = new RegExp(rule.sourcePattern);
  const matching = rightKind.filter((p) => re.test(p.source));
  if (matching.length === 0) return { ok: false, why: 'source_mismatch' };

  const fresh = matching.filter(
    (p) => now.getTime() - p.computedAt.getTime() <= rule.maxAgeHours * 3600_000,
  );
  // stale is distinguished from absent: "you have not run this recently" is actionable,
  // "you have never run this" is a different conversation
  if (fresh.length === 0) return { ok: false, why: 'stale' };

  const uniqueSources = Array.from(new Map(fresh.map((p) => [`${p.source}`, p])).values());
  if (uniqueSources.length < rule.minCount) return { ok: false, why: 'too_few' };

  if (rule.needsSecondSeat) {
    const seats = new Set(fresh.map((p) => p.runBy));
    if (seats.size < 2) return { ok: false, why: 'unsigned' };
  }

  return { ok: true, accepted: fresh.sort((a, b) => b.computedAt.getTime() - a.computedAt.getTime()) };
}
