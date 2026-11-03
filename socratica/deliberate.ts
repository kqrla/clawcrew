/**
 * socratica. pre-build, not pre-merge.
 *
 * the room where the work set is chosen: which candidates get tackled first, which
 * wait, and which are not done this month at all. the output is a queue, because a
 * decision that does not change what the scheduler picks up next is a memo.
 *
 * nothing here can veto. no seat can remove a candidate alone, and the whole plan
 * binds no gate. what it can do is order, and postpone, and say what would bring a
 * postponed thing back. a postponement with no falsifier is how a queue becomes a
 * graveyard, so that is a refusal.
 */
import { Claim } from '../backend/src/domain/discourse.js';

const REF = /^[a-z][a-z0-9]*:\s*\S/;

export interface Candidate {
  id: string;
  slice: string;
  title: string;
  /** what must be true first: other candidates in this set, or nothing */
  dependsOn?: string[];
  /** seat-hours, the org's only scarce unit */
  costHours: number;
  /** on the path to a gate that blocks launch */
  blocksLaunch?: boolean;
}

export type Stance = 'do-first' | 'do-later' | 'never';

export interface Position {
  candidate: string;
  stance: Stance;
  /** the argument, with provenance or a declared gap */
  claim: Claim;
  /** required for do-later and never: what would change your mind */
  falsifier?: string;
}

export interface Seat {
  seat: string;
  /** the interest this seat argues from, stated so the others can attack it */
  interest: string;
  positions: Position[];
}

export interface Plan {
  question: string;
  /** dispatch order. the first ready entry is what the org works on next */
  order: { candidate: string; score: number; argued: string[]; dependsOn: string[] }[];
  /** alive, postponed, and re-entered by its falsifier */
  deferred: { candidate: string; because: string; falsifier: string; argued: string[] }[];
  /** not this month. requires every voice that spoke to have said so */
  omitted: { candidate: string; because: string; dissent: string[] }[];
  /** arguments that lost but are still on the record */
  dissent: { seat: string; candidate: string; claim: Claim }[];
  /** advisory by construction; a plan that could bind is a refusal */
  authority: 'proposal';
  faults: string[];
}

const WEIGHT: Record<Stance, number> = { 'do-first': 2, 'do-later': 0, never: -2 };

export function deliberate(
  input: { question: string; candidates: Candidate[]; seats: Seat[] },
  opts: { topN?: number } = {},
): Plan {
  const faults: string[] = [];
  const byId = new Map(input.candidates.map((c) => [c.id, c]));

  // a position about a candidate that does not exist is a conversation about nothing
  for (const s of input.seats) {
    for (const p of s.positions) {
      if (!byId.has(p.candidate)) faults.push(`unknown_candidate:${p.candidate}`);
      if (!p.claim?.statement) faults.push(`stance_without_a_claim:${p.candidate}`);
      if (p.claim?.kind === 'fact' && !(p.claim.evidence && REF.test(p.claim.evidence))) {
        faults.push(`fact_without_evidence:${p.claim.id}`);
      }
      if ((p.stance === 'never' || p.stance === 'do-later') && !p.falsifier?.trim()) {
        faults.push(`postponement_without_a_falsifier:${p.candidate}`);
      }
    }
  }

  const dissent: Plan['dissent'] = [];
  const order: Plan['order'] = [];
  const deferred: Plan['deferred'] = [];
  const omitted: Plan['omitted'] = [];

  for (const c of input.candidates) {
    const said = input.seats.flatMap((s) =>
      s.positions.filter((p) => p.candidate === c.id).map((p) => ({ ...p, seat: s.seat })),
    );
    const score = said.reduce((n, p) => n + WEIGHT[p.stance], 0);
    const argued = said.map((p) => `${p.seat}:${p.stance}`);
    const firsts = said.filter((p) => p.stance === 'do-first');
    const lastWords = said.filter((p) => p.stance !== 'do-first');

    for (const p of lastWords) dissent.push({ seat: p.seat, candidate: c.id, claim: p.claim });

    // omission is the strongest thing this room can do, so it needs every voice,
    // not merely the absence of an argument for
    const unanimousNever = said.length > 0 && said.every((p) => p.stance === 'never');
    if (unanimousNever) {
      omitted.push({ candidate: c.id, because: said.map((p) => `${p.seat} says ${p.falsifier}`).join('; '), dissent: [] });
    } else if (score > 0 || (said.length === 0 && c.blocksLaunch)) {
      order.push({ candidate: c.id, score, argued, dependsOn: c.dependsOn ?? [] });
    } else {
      const blocker = lastWords.slice().sort((a, b) => WEIGHT[a.stance] - WEIGHT[b.stance])[0];
      deferred.push({
        candidate: c.id,
        because: blocker ? `${blocker.seat} wants it later` : 'nobody argued for it',
        falsifier: blocker?.falsifier ?? 'unstated',
        argued,
      });
    }
  }

  // an order that cannot be executed is not an order
  const deferredIds = new Set(deferred.map((d) => d.candidate));
  for (const item of [...order]) {
    const missing = (byId.get(item.candidate)?.dependsOn ?? []).filter((d) => deferredIds.has(d));
    if (missing.length > 0) {
      order.splice(order.indexOf(item), 1);
      const src = deferred.find((d) => d.candidate === missing[0]);
      deferred.push({
        candidate: item.candidate,
        because: `waits on ${missing.join(', ')}, which is postponed`,
        falsifier: src?.falsifier ?? 'unstated',
        argued: item.argued,
      });
      deferredIds.add(item.candidate);
    }
  }

  // highest score first, then the launch blocker, then the cheap one, then stable id
  order.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const ab = byId.get(a.candidate)!.blocksLaunch ? 1 : 0;
    const bb = byId.get(b.candidate)!.blocksLaunch ? 1 : 0;
    if (ab !== bb) return bb - ab;
    const ac = byId.get(a.candidate)!.costHours;
    const bc = byId.get(b.candidate)!.costHours;
    if (ac !== bc) return ac - bc;
    return a.candidate.localeCompare(b.candidate);
  });

  // dependencies inside the order: a thing cannot precede what it waits on
  const rank = new Map(order.map((o, i) => [o.candidate, i]));
  for (let i = 0; i < order.length; i++) {
    const deps = (byId.get(order[i]!.candidate)?.dependsOn ?? []).filter((d) => rank.has(d));
    const late = deps.filter((d) => rank.get(d)! > i);
    if (late.length > 0) {
      const [moved] = order.splice(i, 1);
      const at = Math.min(...late.map((d) => rank.get(d)!));
      order.splice(at, 0, moved!);
      return { ...finish(order, deferred, omitted, dissent, faults, input.question), faults: [...faults, `order_repaired:${moved!.candidate}`] };
    }
  }

  const seen = new Set<string>();
  for (const id of [...order.map((o) => o.candidate), ...deferred.map((d) => d.candidate), ...omitted.map((o) => o.candidate)]) {
    if (seen.has(id)) faults.push(`candidate_twice:${id}`);
    seen.add(id);
  }
  for (const c of input.candidates) if (!seen.has(c.id)) faults.push(`candidate_lost:${c.id}`);

  const limit = opts.topN;
  if (limit && order.length > limit) {
    for (const cut of order.splice(limit)) {
      deferred.push({ candidate: cut.candidate, because: 'beyond this cycle', falsifier: 'next cycle opens', argued: cut.argued });
    }
  }

  return finish(order, deferred, omitted, dissent, faults, input.question);
}

function finish(
  order: Plan['order'],
  deferred: Plan['deferred'],
  omitted: Plan['omitted'],
  dissent: Plan['dissent'],
  faults: string[],
  question: string,
): Plan {
  return { question, order, deferred, omitted, dissent, authority: 'proposal', faults };
}

/** what the scheduler takes next: the first ordered item whose dependencies are done */
export function dispatchNext(plan: Plan, done: Iterable<string>): { next: string } | { waiting: string[] } {
  const finished = new Set(done);
  for (const item of plan.order) {
    if (finished.has(item.candidate)) continue;
    const deps = item.dependsOn;
    if (deps.some((d) => !finished.has(d))) continue;
    return { next: item.candidate };
  }
  return { waiting: plan.order.map((o) => o.candidate).filter((c) => !finished.has(c)) };
}

/** no plan, however well argued, is accepted by a gate. the memo informs, the gate decides */
export function gateAccepts(plan: Plan): false {
  return false;
}
