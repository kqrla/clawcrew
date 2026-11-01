import { describe, expect, it } from 'vitest';
import {
  OPERATING_WINDOW_DAYS,
  Project,
  ProjectContext,
  advance,
  evaluate,
  kill,
  validateProject,
} from '../src/domain/project.js';
import { compose } from '../src/domain/ontology.js';
import { LedgerObjective } from '../src/domain/project.js';
import { readFileSync, readdirSync } from 'node:fs';
import { SliceOntology } from '../src/domain/ontology.js';

/**
 * docs/30. a project is the factory's unit of business: it starts, it ships, it
 * runs for a month, and then a number decides whether it continues.
 */
const NOW = '2026-11-01T12:00:00.000Z';
const plusDays = (d: number) => new Date(Date.parse(NOW) + d * 86_400_000).toISOString();

const load = (name: string): SliceOntology =>
  JSON.parse(readFileSync(new URL(`../ontology/${name}.json`, import.meta.url), 'utf8'));
const ALL = readdirSync(new URL('../ontology/', import.meta.url))
  .filter((f) => f.endsWith('.json'))
  .map((f) => load(f.replace('.json', '')));

const SLICES = ALL.map((o, i) => ({
  slice: o.slice,
  ontologyVersion: o.version,
  objectiveRef: `obj.${o.slice}.v1`,
}));

const project = (over: Partial<Project> = {}): Project => ({
  id: 'test-01.figures',
  name: 'test 1 — custom 3D figures, B2C',
  phase: 'inception',
  startedAt: NOW,
  phaseStartedAt: NOW,
  objectiveRef: 'obj.figures.revenue.v1',
  slices: SLICES,
  unitCostCeilingUsd: 22,
  killCriteria: [
    'no printed figure can be produced under the ceiling from a live quote',
    'any part ships without a licence record',
    'the harness refuses more than 1 in 20 recipes after two repairs',
  ],
  ...over,
});

const objectivesFor = (slices = SLICES): LedgerObjective[] =>
  slices.map((s) => ({
    ref: s.objectiveRef,
    metric: `${s.slice} shipped units per week`,
    source: `provider.${s.slice}`,
    baseline: 0,
    target: 1,
    selfReported: false,
  }));

const ctx = (over: Partial<ProjectContext> = {}): ProjectContext => ({
  now: NOW,
  composition: compose(ALL),
  objectives: objectivesFor(),
  done: [],
  facts: {},
  ...over,
});

const ids = (checks: { id: string; ok: boolean }[]) => checks.filter((c) => !c.ok).map((c) => c.id);

describe('a project is startable or it is not', () => {
  it('the ten slices form a closed business', () => {
    expect(ids(evaluate(project(), ctx()))).toEqual([]);
  });

  it('refuses to start on a slice set that cannot cover its own contracts', () => {
    const withoutCode = project({ slices: SLICES.filter((s) => s.slice !== 'code.repo') });
    const c = ctx({ composition: compose(ALL.filter((o) => o.slice !== 'code.repo')) });
    const unmet = evaluate(withoutCode, c).filter((x) => !x.ok);
    expect(unmet.map((u) => u.id)).toContain('composition_closed');
    const gap = unmet.find((u) => u.id === 'composition_closed')!;
    expect(gap.detail.missing).toEqual([
      { contract: 'code.change', neededBy: ['documentation.site', 'financials.rails', 'operations.runtime', 'security.controls'] },
    ]);
  });

  it('refuses to start on an objective measured by the seat that owns it', () => {
    const objs = objectivesFor().map((o, i) =>
      i === 0 ? { ...o, source: 'self', selfReported: true } : o,
    );
    expect(ids(evaluate(project(), ctx({ objectives: objs })))).toContain('objectives_externally_measured');
  });

  it('refuses to start on an objective with no baseline or no target', () => {
    const objs = objectivesFor();
    objs[1] = { ...objs[1]!, target: null };
    objs[2] = { ...objs[2]!, baseline: null };
    const unmet = evaluate(project(), ctx({ objectives: objs })).filter((c) => !c.ok);
    expect(unmet[0]?.id).toBe('objectives_externally_measured');
    expect(unmet[0]?.detail.objectives).toHaveLength(2);
  });

  it('refuses a project whose next slice has no objective at all', () => {
    const objs = objectivesFor().filter((o) => o.ref !== 'obj.media.studio.v1');
    const unmet = evaluate(project(), ctx({ objectives: objs })).filter((c) => !c.ok);
    expect(unmet.map((u) => u.id)).toContain('objectives_present');
    expect(unmet.find((u) => u.id === 'objectives_present')!.detail.unresolved).toEqual([
      'obj.media.studio.v1',
    ]);
  });

  it('a kill criterion of "it fails" is not a criterion', () => {
    const faults = validateProject(project({ killCriteria: ['fails'] }));
    expect(faults.map((f) => f.id)).toContain('kill_criteria_too_thin');
  });

  it('a project with no cost ceiling cannot exist', () => {
    expect(validateProject(project({ unitCostCeilingUsd: 0 })).map((f) => f.id)).toContain(
      'no_unit_cost_ceiling',
    );
  });
});

describe('the build phase needs one of everything, not a promise of everything', () => {
  const inBuild = project({ phase: 'build' });

  it('blocks until every slice has shipped once', () => {
    const done = ALL.slice(0, 9).map((o) => ({
      slice: o.slice,
      kind: o.kinds[0]!,
      evidenceRef: o.kinds[0] === 'code' ? 'commit:9f2a1c' : 'artifact://sha256/abc',
    }));
    const unmet = evaluate(inBuild, ctx({ done })).filter((c) => !c.ok);
    expect(unmet.map((u) => u.id)).toEqual(['every_slice_shipped_once']);
    expect(unmet[0]!.detail.waiting).toEqual([ALL[9]!.slice]);
  });

  it('a finished task with no reference does not count as shipping', () => {
    const done = ALL.map((o) => ({ slice: o.slice, kind: o.kinds[0]!, evidenceRef: '' }));
    const unmet = evaluate(inBuild, ctx({ done })).filter((c) => !c.ok);
    expect(unmet[0]!.id).toBe('every_slice_shipped_once');
    expect(unmet[0]!.detail.waiting).toHaveLength(10);
  });

  it('passes when every slice has a referenced artifact', () => {
    const done = ALL.map((o) => ({ slice: o.slice, kind: o.kinds[0]!, evidenceRef: 'artifact://sha256/a' }));
    expect(ids(evaluate(inBuild, ctx({ done })))).toEqual([]);
  });

  it('will not leave build with the harness still refusing recipes', () => {
    const done = ALL.map((o) => ({ slice: o.slice, kind: o.kinds[0]!, evidenceRef: 'artifact://sha256/a' }));
    const unmet = evaluate(inBuild, ctx({ done, facts: { harnessBlocked: 3 } })).filter((c) => !c.ok);
    expect(unmet.map((u) => u.id)).toEqual(['no_open_harness_refusals']);
    expect(unmet[0]!.detail.blocked).toBe(3);
  });
});

describe('assemble: the three things that kill this business are gates, not memos', () => {
  const inAssemble = project({ phase: 'assemble' });
  const good = {
    endToEndArtifact: 'artifact://sha256/9f2a',
    liveQuoteUsd: 18.4,
    unlicensedParts: 0,
    paymentRailVerified: true,
  };

  it('passes on a live quote inside the ceiling, a licensed catalog, and a working rail', () => {
    expect(ids(evaluate(inAssemble, ctx({ facts: good })))).toEqual([]);
  });

  it('blocks a price the fulfilment house never quoted', () => {
    const unmet = evaluate(inAssemble, ctx({ facts: { ...good, liveQuoteUsd: null } })).filter((c) => !c.ok);
    expect(unmet.map((u) => u.id)).toEqual(['live_quote', 'unit_cost_under_ceiling']);
  });

  it('blocks a full-colour promise the printer cannot honour at the ceiling', () => {
    const unmet = evaluate(inAssemble, ctx({ facts: { ...good, liveQuoteUsd: 41.5 } })).filter((c) => !c.ok);
    expect(unmet.map((u) => u.id)).toEqual(['unit_cost_under_ceiling']);
    expect(unmet[0]!.detail).toEqual({ usd: 41.5, ceiling: 22 });
  });

  it('blocks launch on a single unlicensed part', () => {
    const unmet = evaluate(inAssemble, ctx({ facts: { ...good, unlicensedParts: 1 } })).filter((c) => !c.ok);
    expect(unmet.map((u) => u.id)).toEqual(['all_parts_licensed']);
  });

  it('an unread licence count is not zero', () => {
    const unmet = evaluate(inAssemble, ctx({ facts: { ...good, unlicensedParts: null } })).filter((c) => !c.ok);
    expect(unmet.map((u) => u.id)).toEqual(['all_parts_licensed']);
  });

  it('blocks launch without an artifact that went through the real pipeline', () => {
    const unmet = evaluate(inAssemble, ctx({ facts: { ...good, endToEndArtifact: 'it works' } })).filter((c) => !c.ok);
    expect(unmet.map((u) => u.id)).toEqual(['end_to_end_artifact']);
  });

  it('blocks launch until somebody moves money for real', () => {
    const unmet = evaluate(inAssemble, ctx({ facts: { ...good, paymentRailVerified: false } })).filter((c) => !c.ok);
    expect(unmet.map((u) => u.id)).toEqual(['payment_rail_verified']);
  });
});

describe('launch and operate', () => {
  it('is not operating without a pager under a lease', () => {
    const unmet = evaluate(project({ phase: 'launch' }), ctx({
      facts: { supportResolvedByOther: true, docsPageResolves: true, oncallLeaseHeld: false },
    })).filter((c) => !c.ok);
    expect(unmet.map((u) => u.id)).toEqual(['oncall_lease_held']);
  });

  it('a support queue closed by its own author is not a support queue', () => {
    const unmet = evaluate(project({ phase: 'launch' }), ctx({
      facts: { supportResolvedByOther: false, docsPageResolves: true, oncallLeaseHeld: true },
    })).filter((c) => !c.ok);
    expect(unmet.map((u) => u.id)).toEqual(['support_closed_by_other']);
  });

  it('cannot be judged before it has run a month', () => {
    const p = project({ phase: 'operate', phaseStartedAt: NOW });
    const unmet = evaluate(p, ctx({ now: plusDays(12), facts: { metricSamples: 12 } })).filter((c) => !c.ok);
    expect(unmet.map((u) => u.id)).toEqual(['operated_a_month', 'metric_sampled_daily']);
    expect(unmet[0]!.detail).toEqual({ days: 12, need: OPERATING_WINDOW_DAYS });
  });

  it('a month of ticks with three samples is not a month of data', () => {
    const p = project({ phase: 'operate', phaseStartedAt: NOW });
    const unmet = evaluate(p, ctx({ now: plusDays(31), facts: { metricSamples: 3 } })).filter((c) => !c.ok);
    expect(unmet.map((u) => u.id)).toEqual(['metric_sampled_daily']);
  });

  it('passes a full month of daily samples', () => {
    const p = project({ phase: 'operate', phaseStartedAt: NOW });
    expect(ids(evaluate(p, ctx({ now: plusDays(31), facts: { metricSamples: 31 } })))).toEqual([]);
  });
});

describe('the review decides, and "continue" is not an option', () => {
  const inReview = project({ phase: 'review' });

  it('will not rule without the auditor agreeing with the primary number', () => {
    const unmet = evaluate(inReview, ctx({ facts: { auditAgrees: false, metricMoved: true } })).filter((c) => !c.ok);
    expect(unmet.map((u) => u.id)).toEqual(['audit_agrees']);
  });

  it('will not rule on a missing verdict', () => {
    const unmet = evaluate(inReview, ctx({ facts: { auditAgrees: true } })).filter((c) => !c.ok);
    expect(unmet.map((u) => u.id)).toEqual(['verdict_reachable']);
  });

  it('closes when the number moved beyond the noise floor', () => {
    const r = advance(inReview, ctx({ facts: { auditAgrees: true, metricMoved: true } }));
    expect(r.ok && r.project.phase).toBe('closed');
  });

  it('kills when the number did not move', () => {
    const r = advance(inReview, ctx({ facts: { auditAgrees: true, metricMoved: false } }));
    expect(r.ok && r.project.phase).toBe('killed');
  });
});

describe('advancing', () => {
  it('walks inception to closed on evidence, stamping each phase', () => {
    let p = project();
    const steps: string[] = [];
    const done = ALL.map((o) => ({ slice: o.slice, kind: o.kinds[0]!, evidenceRef: 'artifact://sha256/a' }));

    p = advance(p, ctx()).ok ? (advance(p, ctx()) as { project: Project }).project : p;
    steps.push(p.phase);
    expect(p.phaseStartedAt).toBe(NOW);

    p = (advance(p, ctx({ done })) as { project: Project }).project;
    steps.push(p.phase);

    p = (advance(p, ctx({ facts: {
      endToEndArtifact: 'artifact://sha256/9f2a', liveQuoteUsd: 18.4,
      unlicensedParts: 0, paymentRailVerified: true,
    } })) as { project: Project }).project;
    steps.push(p.phase);

    p = (advance(p, ctx({ facts: { supportResolvedByOther: true, docsPageResolves: true, oncallLeaseHeld: true } })) as { project: Project }).project;
    steps.push(p.phase);

    p = (advance(p, ctx({ now: plusDays(31), facts: { metricSamples: 31 } })) as { project: Project }).project;
    steps.push(p.phase);

    p = (advance(p, ctx({ now: plusDays(31), facts: { auditAgrees: true, metricMoved: true } })) as { project: Project }).project;
    steps.push(p.phase);

    expect(steps).toEqual(['build', 'assemble', 'launch', 'operate', 'review', 'closed']);
  });

  it('reports the gate rather than a vague refusal', () => {
    const r = advance(project({ phase: 'assemble' }), ctx());
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe('gate_unmet');
      expect(r.unmet.map((u) => u.id)).toEqual([
        'end_to_end_artifact',
        'live_quote',
        'unit_cost_under_ceiling',
        'all_parts_licensed',
        'payment_rail_verified',
      ]);
    }
  });

  it('a terminal project does not advance', () => {
    expect(advance(project({ phase: 'closed' }), ctx())).toMatchObject({
      ok: false,
      reason: 'terminal_phase',
    });
  });
});

describe('killing', () => {
  it('only on a criterion declared at inception', () => {
    expect(() => kill(project(), 'the vibes were off', 'it just did not feel right')).toThrow(
      'kill_criterion_not_declared',
    );
  });

  it('carries a reason a human can read later', () => {
    expect(() => kill(project(), project().killCriteria[0]!, 'nah')).toThrow('kill_reason_too_thin');
  });

  it('kills on a real criterion', () => {
    const p = kill(
      project({ phase: 'assemble' }),
      'no printed figure can be produced under the ceiling from a live quote',
      'the cheapest full-colour quote came back at $41.50 against a $22 ceiling',
    );
    expect(p.phase).toBe('killed');
  });
});
