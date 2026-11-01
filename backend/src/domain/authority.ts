import { GrantSet, intersect, normalize } from './grants.js';

export interface ChainLevel {
  id: string;
  ceiling: GrantSet;
}

export interface Secondment {
  /** the scope the home circle authorized for work inside the host */
  scope: GrantSet;
}

export interface TraceEntry {
  tool: string;
  kept: boolean;
  droppedBy?: string;
}

export interface AuthorityResult {
  grants: GrantSet;
  trace: TraceEntry[];
  mode: 'home' | 'host';
}

function trace(own: GrantSet, levels: ChainLevel[], kept: Set<string>): TraceEntry[] {
  return own.tools.map((tool) => {
    if (kept.has(tool)) return { tool, kept: true };
    const blocker = levels.find((l) => !l.ceiling.tools.includes(tool));
    return blocker ? { tool, kept: false, droppedBy: blocker.id } : { tool, kept: false };
  });
}

/**
 * authority inside the home circle:
 *   root ceiling ∩ ... ∩ own circle ceiling ∩ own grants
 */
export function effectiveHome(chain: ChainLevel[], own: GrantSet): AuthorityResult {
  if (chain.length === 0) throw new Error('authority requires at least one chain level');
  const ownNorm = normalize(own);
  let grants = ownNorm;
  for (const level of chain) grants = intersect(grants, level.ceiling);
  return { grants, trace: trace(ownNorm, chain, new Set(grants.tools)), mode: 'home' };
}

/**
 * authority inside a host circle during a secondment:
 *   host ceiling ∩ secondment scope ∩ own grants
 *
 * note there is no home-ceiling term: the home ceiling already bounds `own`.
 * spend defaults to zero in the host, because spending someone else's budget
 * has to be an explicit line in the secondment, never an inference.
 */
export function effectiveInHost(
  hostChain: ChainLevel[],
  own: GrantSet,
  secondment: Secondment,
): AuthorityResult {
  if (hostChain.length === 0) throw new Error('authority requires at least one chain level');
  const ownNorm = normalize(own);
  let grants = ownNorm;
  grants = intersect(grants, normalize(secondment.scope));
  for (const level of hostChain) grants = intersect(grants, level.ceiling);
  grants = { ...grants, spendUsdPerDay: Math.min(grants.spendUsdPerDay ?? 0, secondment.scope.spendUsdPerDay ?? 0) };
  const levels = [...hostChain, { id: 'secondment', ceiling: secondment.scope }];
  return { grants, trace: trace(ownNorm, levels, new Set(grants.tools)), mode: 'host' };
}

export interface Elevation {
  id: string;
  issuer: string;
  target: string;
  adds: string[];
  issuedAt: string;
  expiresAt: string;
  maxUses: number;
  used: number;
  window?: { days: number[]; hours: [number, number] };
}

export interface ElevationContext {
  now: string;
  targetChain: string[];
  issuerCeiling: GrantSet;
  dayOfWeek: number; // 0 sun .. 6 sat
  hourUtc: number;
}

/** elevation is explicit widening, and every rejection has a reason worth logging. */
export function applyElevation(
  base: GrantSet,
  elev: Elevation,
  ctx: ElevationContext,
): { grants: GrantSet; applied: boolean; reason?: string } {
  if (ctx.now >= elev.expiresAt) return { grants: base, applied: false, reason: 'expired' };
  if (elev.used >= elev.maxUses) return { grants: base, applied: false, reason: 'exhausted' };
  if (!ctx.targetChain.includes(elev.issuer)) {
    return { grants: base, applied: false, reason: 'issuer_not_ancestor' };
  }
  const beyond = elev.adds.filter((t) => !ctx.issuerCeiling.tools.includes(t));
  if (beyond.length > 0) return { grants: base, applied: false, reason: `issuer_lacks:${beyond.join(',')}` };
  if (elev.window) {
    const inDay = elev.window.days.includes(ctx.dayOfWeek);
    const [from, to] = elev.window.hours;
    if (!inDay || ctx.hourUtc < from || ctx.hourUtc >= to) {
      return { grants: base, applied: false, reason: 'outside_window' };
    }
  }
  return {
    grants: normalize({ tools: [...base.tools, ...elev.adds], spendUsdPerDay: base.spendUsdPerDay }),
    applied: true,
  };
}

export function canAfford(grants: GrantSet, amountUsd: number): boolean {
  if (amountUsd <= 0) return true;
  return grants.spendUsdPerDay !== undefined && amountUsd <= grants.spendUsdPerDay;
}
