/**
 * docs/30. a project is the factory's unit of *business*, not of work.
 *
 * tasks are hours, objectives are months, and a project is the thing that has to
 * survive being run for thirty days by seats nobody is watching. it moves through
 * phases, and a phase moves only when a gate over rows says it may. there is no
 * "call it done" verb: the same reason custody refuses prose evidence.
 */
import { Composition } from './ontology.js';
import { TaskKind } from './ontology.js';
import { isReference } from './relay.js';

/**
 * a pointer somebody else can resolve. the relay's payload rule (`artifact://`) and
 * the ontology's evidence vocabulary (`commit:`, `sheet:`, `stripe:`) are different
 * grammars, and a project gate has to read both: what it is checking is that a
 * reference exists, not which vocabulary it came from.
 */
const isEvidenceRef = (ref: unknown): ref is string =>
  typeof ref === 'string' && (isReference(ref) || /^[a-z][a-z0-9]*:\S+/.test(ref));

export const PHASES = [
  'inception',
  'build',
  'assemble',
  'launch',
  'operate',
  'review',
  'closed',
  'killed',
] as const;

export type Phase = (typeof PHASES)[number];

export const TERMINAL_PHASES: readonly Phase[] = ['closed', 'killed'];

export const isTerminal = (phase: Phase): boolean => TERMINAL_PHASES.includes(phase);

const DAY_MS = 86_400_000;
/** how long the business must actually run before it is judged */
export const OPERATING_WINDOW_DAYS = 30;

export interface ProjectSlice {
  slice: string;
  ontologyVersion: number;
  objectiveRef: string;
}

export interface Project {
  id: string;
  name: string;
  phase: Phase;
  startedAt: string;
  phaseStartedAt: string;
  /** the objective the whole project is judged by */
  objectiveRef: string;
  slices: ProjectSlice[];
  /** what one shipped unit has to cost, from a live quote, or the business does not exist */
  unitCostCeilingUsd: number;
  /** declared at inception, so that stopping is a decision made before the sunk cost exists */
  killCriteria: string[];
}

export interface LedgerObjective {
  ref: string;
  metric: string;
  /** where the number comes from. 'self' means the reporting seat measured itself, which is not a source */
  source: string;
  baseline: number | null;
  target: number | null;
  selfReported: boolean;
}

/** completed work, projected to the fields a gate reads */
export interface DoneWork {
  slice: string;
  kind: TaskKind;
  evidenceRef: string;
}

export interface ProjectFacts {
  /** something shipped end to end through the real pipeline: recipe -> artifact -> validated */
  endToEndArtifact?: string | null;
  /** the lowest real price from a fulfilment integration, not a spreadsheet estimate */
  liveQuoteUsd?: number | null;
  /** parts whose licence record is missing or unusable */
  unlicensedParts?: number | null;
  paymentRailVerified?: boolean;
  docsPageResolves?: boolean;
  /** support closed by someone other than the author, the way docs/29 defines support's gate */
  supportResolvedByOther?: boolean;
  oncallLeaseHeld?: boolean;
  harnessBlocked?: number;
  metricSamples?: number;
  /** the auditor's independent number agrees with the primary one */
  auditAgrees?: boolean;
  /** last sample against baseline, beyond the noise floor declared at inception */
  metricMoved?: boolean;
}

export interface ProjectContext {
  now: string;
  composition: Composition;
  objectives: LedgerObjective[];
  done: DoneWork[];
  facts: ProjectFacts;
}

export interface Check {
  id: string;
  ok: boolean;
  detail: Record<string, unknown>;
}

export type AdvanceResult =
  | { ok: true; project: Project; checks: Check[] }
  | { ok: false; reason: 'terminal_phase' | 'gate_unmet'; unmet: Check[] };

const pass = (id: string, detail: Record<string, unknown> = {}): Check => ({ id, ok: true, detail });
const fail = (id: string, detail: Record<string, unknown> = {}): Check => ({ id, ok: false, detail });

/** structure, not progress. a project that fails this is not startable at all. */
export function validateProject(project: Project): Check[] {
  const faults: Check[] = [];
  if (project.slices.length === 0) faults.push(fail('no_slices'));
  if (new Set(project.slices.map((s) => s.slice)).size !== project.slices.length) {
    faults.push(fail('duplicate_slice'));
  }
  if (!(project.unitCostCeilingUsd > 0)) faults.push(fail('no_unit_cost_ceiling'));
  if (project.killCriteria.filter((c) => c.trim().length > 12).length === 0) {
    // "it fails" is not a kill criterion. it has to name a condition someone can check.
    faults.push(fail('kill_criteria_too_thin', { criteria: project.killCriteria }));
  }
  if (project.slices.some((s) => s.objectiveRef.trim() === '')) {
    faults.push(fail('slice_without_objective'));
  }
  return faults;
}

function inception(project: Project, ctx: ProjectContext): Check[] {
  const checks: Check[] = [...validateProject(project)];

  // 5.1 of the figure brief: a slice set that cannot cover its own contracts is
  // not a business, it is a plan with a hole in it.
  checks.push(
    ctx.composition.missing.length === 0
      ? pass('composition_closed', { provided: ctx.composition.provided.length })
      : fail('composition_closed', { missing: ctx.composition.missing }),
  );

  const byRef = new Map(ctx.objectives.map((o) => [o.ref, o]));
  const unresolved = project.slices
    .map((s) => s.objectiveRef)
    .filter((ref) => !byRef.has(ref));
  checks.push(
    unresolved.length === 0
      ? pass('objectives_present', { count: project.slices.length })
      : fail('objectives_present', { unresolved }),
  );

  // an objective measured by the seat that owns it is a mood, not a metric
  const selfMeasured = [...byRef.values()].filter(
    (o) => o.source === 'self' || o.selfReported || o.baseline === null || o.target === null,
  );
  checks.push(
    selfMeasured.length === 0
      ? pass('objectives_externally_measured')
      : fail('objectives_externally_measured', {
          objectives: selfMeasured.map((o) => ({ ref: o.ref, source: o.source, baseline: o.baseline, target: o.target })),
        }),
  );

  return checks;
}

function build(project: Project, ctx: ProjectContext): Check[] {
  const shipped = new Set(ctx.done.filter((d) => isEvidenceRef(d.evidenceRef)).map((d) => d.slice));
  const waiting = project.slices.map((s) => s.slice).filter((s) => !shipped.has(s));

  const harnessBlocked = ctx.facts.harnessBlocked ?? 0;

  return [
    waiting.length === 0
      ? pass('every_slice_shipped_once', { slices: project.slices.length })
      : fail('every_slice_shipped_once', { waiting }),
    harnessBlocked === 0
      ? pass('no_open_harness_refusals')
      : fail('no_open_harness_refusals', { blocked: harnessBlocked }),
  ];
}

function assemble(_project: Project, ctx: ProjectContext): Check[] {
  const { endToEndArtifact, liveQuoteUsd, unlicensedParts, paymentRailVerified } = ctx.facts;
  const ceiling = _project.unitCostCeilingUsd;
  const checks: Check[] = [];

  checks.push(
    isEvidenceRef(endToEndArtifact)
      ? pass('end_to_end_artifact', { ref: endToEndArtifact })
      : fail('end_to_end_artifact', { got: endToEndArtifact ?? null }),
  );

  // "roughly twenty dollars" is not a quote. the number comes from the house.
  checks.push(
    typeof liveQuoteUsd === 'number'
      ? pass('live_quote', { usd: liveQuoteUsd })
      : fail('live_quote', { got: liveQuoteUsd ?? null }),
  );

  checks.push(
    typeof liveQuoteUsd === 'number' && liveQuoteUsd <= ceiling
      ? pass('unit_cost_under_ceiling', { usd: liveQuoteUsd, ceiling })
      : fail('unit_cost_under_ceiling', { usd: liveQuoteUsd ?? null, ceiling }),
  );

  // 5.2: an unlicensed part is not a design problem, it is a legal one, and it
  // blocks the same gate money does.
  checks.push(
    unlicensedParts === 0
      ? pass('all_parts_licensed')
      : fail('all_parts_licensed', { unlicensed: unlicensedParts ?? 'unknown' }),
  );

  checks.push(
    paymentRailVerified === true
      ? pass('payment_rail_verified')
      : fail('payment_rail_verified', { got: paymentRailVerified ?? null }),
  );

  return checks;
}

function launch(_project: Project, ctx: ProjectContext): Check[] {
  const f = ctx.facts;
  return [
    f.supportResolvedByOther === true
      ? pass('support_closed_by_other')
      : fail('support_closed_by_other', { got: f.supportResolvedByOther ?? null }),
    f.docsPageResolves === true
      ? pass('docs_page_resolves')
      : fail('docs_page_resolves', { got: f.docsPageResolves ?? null }),
    // nothing is "operating" without somebody holding the pager under a lease
    f.oncallLeaseHeld === true
      ? pass('oncall_lease_held')
      : fail('oncall_lease_held', { got: f.oncallLeaseHeld ?? null }),
  ];
}

function operate(project: Project, ctx: ProjectContext): Check[] {
  const elapsed = Date.parse(ctx.now) - Date.parse(project.phaseStartedAt);
  const days = elapsed / DAY_MS;
  const samples = ctx.facts.metricSamples ?? 0;

  return [
    days >= OPERATING_WINDOW_DAYS
      ? pass('operated_a_month', { days: Math.floor(days) })
      : fail('operated_a_month', { days: Math.floor(days), need: OPERATING_WINDOW_DAYS }),
    samples >= OPERATING_WINDOW_DAYS
      ? pass('metric_sampled_daily', { samples })
      : fail('metric_sampled_daily', { samples, need: OPERATING_WINDOW_DAYS }),
  ];
}

function review(_project: Project, ctx: ProjectContext): Check[] {
  const f = ctx.facts;
  return [
    f.auditAgrees === true
      ? pass('audit_agrees')
      : fail('audit_agrees', { got: f.auditAgrees ?? null }),
    typeof f.metricMoved === 'boolean'
      ? pass('verdict_reachable', { moved: f.metricMoved })
      : fail('verdict_reachable', { got: f.metricMoved ?? null }),
  ];
}

/** the gate standing between the project and its next phase. empty at a terminal phase. */
export function evaluate(project: Project, ctx: ProjectContext): Check[] {
  switch (project.phase) {
    case 'inception':
      return inception(project, ctx);
    case 'build':
      return build(project, ctx);
    case 'assemble':
      return assemble(project, ctx);
    case 'launch':
      return launch(project, ctx);
    case 'operate':
      return operate(project, ctx);
    case 'review':
      return review(project, ctx);
    case 'closed':
    case 'killed':
      return [];
  }
}

function nextPhase(project: Project, ctx: ProjectContext): Phase {
  switch (project.phase) {
    case 'inception':
      return 'build';
    case 'build':
      return 'assemble';
    case 'assemble':
      return 'launch';
    case 'launch':
      return 'operate';
    case 'operate':
      return 'review';
    case 'review':
      // the only phase with two exits, and the deciding evidence is a number that
      // moved, not an opinion about how it went
      return ctx.facts.metricMoved === true ? 'closed' : 'killed';
    default:
      return project.phase;
  }
}

/**
 * advance, or say precisely what is missing. a project in `review` advances to
 * either `closed` or `killed`: continuing is not one of the options, because a
 * business that neither works nor ends is how a month becomes a year.
 */
export function advance(project: Project, ctx: ProjectContext): AdvanceResult {
  if (isTerminal(project.phase)) {
    return { ok: false, reason: 'terminal_phase', unmet: [] };
  }
  const checks = evaluate(project, ctx);
  const unmet = checks.filter((c) => !c.ok);
  if (unmet.length > 0) {
    return { ok: false, reason: 'gate_unmet', unmet };
  }
  return {
    ok: true,
    project: { ...project, phase: nextPhase(project, ctx), phaseStartedAt: ctx.now },
    checks,
  };
}

/** a project only leaves the run because a criterion declared at inception fired. */
export function kill(project: Project, criterion: string, reason: string): Project {
  if (!project.killCriteria.includes(criterion)) {
    // killing on a criterion nobody agreed to is how a bad week ends a business
    throw new Error(`kill_criterion_not_declared:${criterion}`);
  }
  if (reason.trim().length < 12) {
    throw new Error('kill_reason_too_thin');
  }
  return { ...project, phase: 'killed' };
}
