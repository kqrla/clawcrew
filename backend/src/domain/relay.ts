/**
 * a sandbox has two properties, and teams only work if both hold.
 *
 *   isolation   what cannot cross. this is the one everyone builds.
 *   permeability what may cross, on purpose, in a declared shape. this is the one
 *               that makes isolation survivable.
 *
 * a wall with no door is not a sandbox, it is a set of teams that cannot converge.
 * a wall with an open door is not a wall. a door with a declared width, an hourly
 * limit and an expiry is a control surface.
 *
 * three mechanisms, deliberately separate:
 *   crossing  the permit: may this kind of thing move from here to there
 *   relay     the transport: store and forward, with a receipt
 *   handoff   the responsibility: who owes the work now (see handoff.ts)
 */
export type EnvelopeKind = 'finding' | 'proposal' | 'request' | 'signal' | 'artifact_ref';

export interface Envelope {
  id: string;
  from: string;
  to: string;
  kind: EnvelopeKind;
  subject: string;
  /** a reference, never prose. a relay that carries paragraphs is a chat app. */
  payloadRef: string;
  authorityBasis: string;
  createdAt: string;
  expiresAt: string;
  hops: number;
  maxHops: number;
  replyTo?: string;
  dedupeKey: string;
}

export interface Crossing {
  id: string;
  from: string;
  to: string;
  allowedKinds: EnvelopeKind[];
  maxPerHour: number;
  expiresAt: string;
  authorizedBy: string;
  /** above this many bytes the crossing needs a fresh authorization */
  maxBytes?: number;
}

export type RejectionReason =
  | 'no_crossing'
  | 'kind_not_allowed'
  | 'crossing_expired'
  | 'envelope_expired'
  | 'hops_exceeded'
  | 'rate_limited'
  | 'payload_not_a_reference';

export type RelayDecision =
  | { state: 'accepted'; crossing: string }
  | { state: 'duplicate' }
  | { state: 'rejected'; reason: RejectionReason };

export interface RelayContext {
  now: string;
  /** deliveries already made on this (from,to,kind) in the last hour */
  perHourCount: number;
  alreadySeen: boolean;
}

const REFERENCE = /^(artifact|repo|db|doc|url|issue|bookmark):\/\/.+/;

export function isReference(ref: string): boolean {
  return REFERENCE.test(ref);
}

/** first crossing that matches direction and kind. order is declaration order. */
export function findCrossing(crossings: Crossing[], from: string, to: string): Crossing | undefined {
  return crossings.find((c) => c.from === from && c.to === to);
}

export function relay(env: Envelope, crossings: Crossing[], ctx: RelayContext): RelayDecision {
  if (ctx.alreadySeen) return { state: 'duplicate' };
  if (Date.parse(ctx.now) > Date.parse(env.expiresAt)) {
    return { state: 'rejected', reason: 'envelope_expired' };
  }
  if (env.hops >= env.maxHops) return { state: 'rejected', reason: 'hops_exceeded' };
  if (!isReference(env.payloadRef)) return { state: 'rejected', reason: 'payload_not_a_reference' };

  const crossing = findCrossing(crossings, env.from, env.to);
  if (!crossing) return { state: 'rejected', reason: 'no_crossing' };
  if (!crossing.allowedKinds.includes(env.kind)) {
    return { state: 'rejected', reason: 'kind_not_allowed' };
  }
  if (Date.parse(ctx.now) > Date.parse(crossing.expiresAt)) {
    return { state: 'rejected', reason: 'crossing_expired' };
  }
  if (ctx.perHourCount >= crossing.maxPerHour) return { state: 'rejected', reason: 'rate_limited' };

  return { state: 'accepted', crossing: crossing.id };
}

/** relaying onward through another wall costs a hop, which bounds loops. */
export function forward(env: Envelope, to: string, now: string): Envelope {
  return {
    ...env,
    id: `${env.id}.f${env.hops + 1}`,
    to,
    hops: env.hops + 1,
    createdAt: now,
    replyTo: env.replyTo ?? env.from,
  };
}

export interface CrossingCheck {
  ok: boolean;
  problems: string[];
}

/** crossings are declared, not discovered. a typo here is a wall with no door. */
export function validateCrossing(c: Crossing, tiers: string[]): CrossingCheck {
  const problems: string[] = [];
  if (!tiers.includes(c.from)) problems.push(`unknown_from:${c.from}`);
  if (!tiers.includes(c.to)) problems.push(`unknown_to:${c.to}`);
  if (c.from === c.to) problems.push('self_crossing');
  if (c.allowedKinds.length === 0) problems.push('no_kinds');
  if (c.maxPerHour <= 0) problems.push('no_rate');
  if (Number.isNaN(Date.parse(c.expiresAt))) problems.push('expiry_invalid');
  if (c.authorizedBy.trim().length === 0) problems.push('no_authorizer');
  return { ok: problems.length === 0, problems };
}

/**
 * permeability is a shape, not a boolean. this is the whole policy in one number:
 * a pair of teams with zero crossings cannot converge, and a pair with an
 * unlimited one is a single team with extra steps.
 */
export function permeabilityScore(crossings: Crossing[], from: string, to: string): number {
  const c = findCrossing(crossings, from, to);
  if (!c) return 0;
  return c.allowedKinds.length * c.maxPerHour;
}
