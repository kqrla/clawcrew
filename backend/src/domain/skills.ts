import { GrantSet, intersect } from './grants.js';
import { isReference } from './relay.js';

/**
 * a skill library is how an org compounds instead of re-deriving.
 * it is also the fastest way for one bad skill to poison every caller silently.
 *
 * the rule that keeps it safe is the same rule as everywhere else:
 * a skill never confers authority. invocation is the intersection of what the
 * caller already holds and what the skill declares it needs. a skill written by
 * finance cannot lend money-moving power to an engineer who retrieves it.
 */

export type SkillStatus = 'active' | 'stale' | 'retired';

export interface Skill {
  id: string;
  version: number;
  /** content hash of the code. two skills with the same hash on a surface are one skill. */
  hash: string;
  ownerTier: string;
  intent: string;
  /** the surface the skill operates on. retrieval keys on this, not on vibes. */
  surface: string;
  requires: GrantSet;
  testRef: string;
  lastVerifiedAt: string;
  /** fingerprint of the surface the test ran against. a changed surface invalidates the test. */
  verifiedAgainst: string;
  status: SkillStatus;
  retiredReason?: string;
}

export interface InvocationContext {
  callerTier: string;
  callerGrants: GrantSet;
  now: string;
  surfaceFingerprint: string;
  maxAgeDays?: number;
}

export type SkillDenial =
  | 'retired'
  | 'stale'
  | 'test_missing'
  | 'surface_changed'
  | 'verification_expired'
  | 'missing_requirement';

export interface Invocation {
  allowed: boolean;
  effective?: GrantSet;
  denials: SkillDenial[];
  detail?: string;
}

const DAY = 86_400_000;

export function canInvoke(skill: Skill, ctx: InvocationContext): Invocation {
  const denials: SkillDenial[] = [];

  if (skill.status === 'retired') denials.push('retired');
  if (skill.status === 'stale') denials.push('stale');
  if (!isReference(skill.testRef)) denials.push('test_missing');
  if (skill.verifiedAgainst !== ctx.surfaceFingerprint) denials.push('surface_changed');

  const age = (Date.parse(ctx.now) - Date.parse(skill.lastVerifiedAt)) / DAY;
  const maxAge = ctx.maxAgeDays ?? 30;
  if (!Number.isFinite(age) || age > maxAge) denials.push('verification_expired');

  // the laundromat guard: authority is intersected, never borrowed
  const effective = intersect(ctx.callerGrants, skill.requires);
  const missing = skill.requires.tools.filter((t) => !effective.tools.includes(t));
  if (missing.length > 0) denials.push('missing_requirement');

  return {
    allowed: denials.length === 0,
    effective,
    denials,
    ...(missing.length > 0 ? { detail: `caller lacks ${missing.join(', ')}` } : {}),
  };
}

export interface VerificationInput {
  testPassed: boolean;
  surfaceFingerprint: string;
  now: string;
  testRef?: string;
}

export function verify(skill: Skill, input: VerificationInput): Skill {
  if (!input.testPassed) {
    return { ...skill, status: 'stale', lastVerifiedAt: skill.lastVerifiedAt };
  }
  return {
    ...skill,
    status: 'active',
    lastVerifiedAt: input.now,
    verifiedAgainst: input.surfaceFingerprint,
    ...(input.testRef ? { testRef: input.testRef } : {}),
  };
}

export interface RegisterCandidate {
  id: string;
  hash: string;
  ownerTier: string;
  intent: string;
  surface: string;
  requires: GrantSet;
  testRef: string;
}

export type RegisterProblem =
  | 'no_owner'
  | 'no_test'
  | 'duplicate_hash'
  | 'duplicate_intent';

export interface RegisterResult {
  ok: boolean;
  problems: RegisterProblem[];
}

const normalize = (s: string): string =>
  s.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();

/** registration is the moment sprawl happens, so it is the moment to refuse it. */
export function register(
  candidate: RegisterCandidate,
  existing: Skill[],
): RegisterResult {
  const problems: RegisterProblem[] = [];
  if (!candidate.ownerTier) problems.push('no_owner');
  if (!isReference(candidate.testRef)) problems.push('no_test');

  const sameSurface = existing.filter((s) => s.surface === candidate.surface);
  if (sameSurface.some((s) => s.hash === candidate.hash)) problems.push('duplicate_hash');
  if (sameSurface.some((s) => normalize(s.intent) === normalize(candidate.intent))) {
    problems.push('duplicate_intent');
  }

  return { ok: problems.length === 0, problems };
}

export function markStale(skill: Skill, reason: string): Skill {
  return { ...skill, status: 'stale', retiredReason: reason };
}

export interface RetrievalQuery {
  surface: string;
  intent: string;
  now: string;
  surfaceFingerprint: string;
  limit?: number;
}

const tokens = (s: string): Set<string> =>
  new Set(normalize(s).split(' ').filter((w) => w.length > 3));

/**
 * retrieval is by surface and precondition, not by embedding similarity.
 * a skill that is semantically close but was written for a different surface is
 * the most expensive kind of wrong.
 */
export function select(skills: Skill[], q: RetrievalQuery): Skill[] {
  const want = tokens(q.intent);
  const scored = skills
    .filter((s) => s.status === 'active')
    .filter((s) => s.verifiedAgainst === q.surfaceFingerprint)
    .filter((s) => (Date.parse(q.now) - Date.parse(s.lastVerifiedAt)) / DAY <= 30)
    .map((s) => {
      const have = tokens(s.intent);
      let score = 0;
      for (const w of want) if (have.has(w)) score += 1;
      if (s.surface === q.surface) score += 3;
      return { s, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) =>
      b.score - a.score || Date.parse(b.s.lastVerifiedAt) - Date.parse(a.s.lastVerifiedAt),
    );

  return scored.slice(0, q.limit ?? 3).map((x) => x.s);
}
