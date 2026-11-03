/**
 * docs/33. the auditor, on a slow clock.
 *
 * corroboration asks one number twice, and both times through the org's own
 * machinery: two expressions, two runners, one database, one set of tables. if the
 * table is wrong, both readings are wrong together and agree beautifully. that is
 * not a hypothetical, it is the normal shape of a measurement bug.
 *
 * so the auditor asks a third time, from outside: the payment provider's own
 * settlement record, the printer's order log, the customer's confirmation, the
 * seller's report. a third answer that comes from the same warehouse the first two
 * came from is not a third answer, it is a third opinion about the same drawer.
 *
 * the auditor runs weekly because it is not a debugger, it is a disagreement
 * detector. nothing it finds needs to be known within the hour, and something it
 * finds needs to be impossible to forget.
 */
import { Reading, sameExpression } from './measure.js';

export type AuditVerdict = 'agrees' | 'disputes' | 'blind_spot' | 'unverifiable';

/** one look at the number from outside the org's own systems */
export interface ExternalObservation {
  objectiveRef: string;
  /** the expression the witness ran. must not be the primary or the crosscheck */
  source: string;
  /** who or what produced it, e.g. 'stripe.settlement', 'auditor.operator' */
  observedBy: string;
  value: number | null;
  ok: boolean;
  detail?: string;
  observedAt: string;
}

export interface AuditResult {
  objectiveRef: string;
  verdict: AuditVerdict;
  reason?: string;
  primary?: number;
  crosscheck?: number;
  external?: number;
  /** relative distance of the external answer from the internal pair */
  spread?: number;
}

export const DEFAULT_TOLERANCE_PCT = 0.05;

const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);

const spread = (a: number, b: number): number => Math.abs(a - b) / Math.max(Math.abs(a), Math.abs(b), 1e-9);

const latest = (readings: Reading[], ref: string, role: 'primary' | 'crosscheck') =>
  readings
    .filter((r) => r.objectiveRef === ref && r.role === role)
    .sort((a, b) => Date.parse(b.computedAt) - Date.parse(a.computedAt))[0];

/**
 * one objective, three answers.
 *
 * the verdict that matters is `blind_spot`: the org's two expressions agree with
 * each other and the outsider disagrees. everything internal said the number was
 * fine, and everything internal was looking at the same wrong thing.
 */
export function auditObjective(
  objective: { ref: string; source: string; crosscheckSource?: string | null },
  readings: Reading[],
  external: ExternalObservation | undefined,
  opts: { tolerancePct?: number; maxAgeMs?: number; now: string } = { now: '' },
): AuditResult {
  const tolerance = opts.tolerancePct ?? DEFAULT_TOLERANCE_PCT;
  const primary = latest(readings, objective.ref, 'primary');
  const crosscheck = latest(readings, objective.ref, 'crosscheck');

  if (!primary) return { objectiveRef: objective.ref, verdict: 'unverifiable', reason: 'primary_never_run' };
  if (!primary.ok || !finite(primary.value)) {
    return { objectiveRef: objective.ref, verdict: 'unverifiable', reason: 'primary_failed' };
  }
  if (!crosscheck || !crosscheck.ok || !finite(crosscheck.value)) {
    return { objectiveRef: objective.ref, verdict: 'unverifiable', reason: 'crosscheck_missing' };
  }

  // the internal pair has to be worth auditing before an outside answer means
  // anything: two expressions from one runner agreeing is one hand, twice
  if (primary.runBy === crosscheck.runBy) {
    return { objectiveRef: objective.ref, verdict: 'unverifiable', reason: 'same_runner' };
  }
  const internalSpread = spread(primary.value, crosscheck.value);
  if (internalSpread > tolerance) {
    return {
      objectiveRef: objective.ref,
      verdict: 'disputes',
      reason: 'internal_disagreement',
      primary: primary.value,
      crosscheck: crosscheck.value,
      spread: round(internalSpread),
    };
  }

  if (!external) {
    return { objectiveRef: objective.ref, verdict: 'unverifiable', reason: 'no_external_witness' };
  }
  if (!external.ok || !finite(external.value)) {
    return { objectiveRef: objective.ref, verdict: 'unverifiable', reason: 'external_failed' };
  }

  // a witness that runs the same expression, or is the same hand, is not outside
  if (
    sameExpression(external.source, objective.source) ||
    (objective.crosscheckSource ? sameExpression(external.source, objective.crosscheckSource) : false)
  ) {
    return {
      objectiveRef: objective.ref,
      verdict: 'unverifiable',
      reason: 'external_is_an_internal_expression',
      primary: primary.value,
      crosscheck: crosscheck.value,
    };
  }
  if (external.observedBy === primary.runBy || external.observedBy === crosscheck.runBy) {
    return {
      objectiveRef: objective.ref,
      verdict: 'unverifiable',
      reason: 'external_observer_is_the_org',
      primary: primary.value,
      crosscheck: crosscheck.value,
    };
  }

  const outBy = spread(external.value, primary.value);
  const base = {
    primary: primary.value,
    crosscheck: crosscheck.value,
    external: external.value,
    spread: round(outBy),
  };
  return outBy <= tolerance
    ? { objectiveRef: objective.ref, verdict: 'agrees', ...base }
    : { objectiveRef: objective.ref, verdict: 'blind_spot', reason: 'external_disagrees', ...base };
}

const round = (n: number): number => Math.round(n * 10_000) / 10_000;

export interface AuditAlert {
  objectiveRef: string;
  code: 'audit_blind_spot' | 'audit_dispute' | 'audit_cannot_verify';
  severity: 'high' | 'medium';
  detail: Record<string, unknown>;
}

/** a round is the whole objective set, because a metric nobody can check is also a finding */
export function auditRound(
  objectives: { ref: string; source: string; crosscheckSource?: string | null }[],
  readings: Reading[],
  externals: ExternalObservation[],
  opts: { tolerancePct?: number; now: string },
): { results: AuditResult[]; alerts: AuditAlert[] } {
  const byRef = new Map(externals.map((e) => [e.objectiveRef, e]));
  const results = objectives.map((o) => auditObjective(o, readings, byRef.get(o.ref), opts));

  const alerts: AuditAlert[] = results.flatMap((r): AuditAlert[] => {
    if (r.verdict === 'blind_spot') {
      return [
        {
          objectiveRef: r.objectiveRef,
          code: 'audit_blind_spot' as const,
          severity: 'high' as const,
          detail: { primary: r.primary, crosscheck: r.crosscheck, external: r.external, spread: r.spread },
        },
      ];
    }
    if (r.verdict === 'disputes') {
      return [
        {
          objectiveRef: r.objectiveRef,
          code: 'audit_dispute' as const,
          severity: 'high' as const,
          detail: { primary: r.primary, crosscheck: r.crosscheck, spread: r.spread, reason: r.reason },
        },
      ];
    }
    if (r.verdict === 'unverifiable') {
      return [
        {
          objectiveRef: r.objectiveRef,
          code: 'audit_cannot_verify' as const,
          severity: 'medium' as const,
          detail: { reason: r.reason },
        },
      ];
    }
    return [];
  });

  return { results, alerts };
}

/** the slow clock. weekly by default, and never inside the hour it last ran */
export function dueForAudit(
  lastRunAt: string | null,
  now: string,
  intervalDays = 7,
): { due: boolean; nextAt: string | null } {
  if (!lastRunAt) return { due: true, nextAt: null };
  const last = Date.parse(lastRunAt);
  if (!Number.isFinite(last)) return { due: true, nextAt: null };
  const next = last + intervalDays * 86_400_000;
  return { due: Date.parse(now) >= next, nextAt: new Date(next).toISOString() };
}

/**
 * alerts are closed by a later round that resolves them, never by time. a
 * disagreement that faded out of the window is not a disagreement that was fixed.
 */
export function reconcileAlerts(open: AuditAlert[], current: AuditAlert[]): AuditAlert[] {
  const still = new Set(current.map((a) => `${a.code}:${a.objectiveRef}`));
  return open.filter((a) => still.has(`${a.code}:${a.objectiveRef}`));
}
