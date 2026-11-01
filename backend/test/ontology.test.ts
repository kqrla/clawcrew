import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  KIND_EVIDENCE,
  SliceOntology,
  TASK_KINDS,
  compose,
  diff,
  evidenceFits,
  propose,
  resolve,
  validate,
  versionHash,
} from '../src/domain/ontology.js';
import { claimWork, complete } from '../src/domain/custody.js';
import { WorkRow } from '../src/domain/liveness.js';

/**
 * docs/29. the factory's slices are not all code, and the schema used to assume
 * they were: one evidence scheme, one acceptance test, applied to everything.
 */
const NOW = '2026-11-01T12:00:00.000Z';
const future = (m: number) => new Date(Date.parse(NOW) + m * 60_000).toISOString();

const load = (name: string): SliceOntology =>
  JSON.parse(readFileSync(new URL(`../ontology/${name}.json`, import.meta.url), 'utf8'));

const ALL = ['code', 'design', 'research', 'security', 'financials', 'media', 'operations', 'accounting', 'support', 'documentation']
  .map(load);
const by = (slice: string) => {
  const found = ALL.find((o) => o.slice === slice);
  if (!found) throw new Error(`no seed for ${slice}`);
  return found;
};
const code = by('code.repo');
const design = by('design.studio');
const financial = by('financials.rails');
const research = by('research.analysis');
const security = by('security.controls');
const media = by('media.studio');

describe('the seeds are the org the factory actually runs', () => {
  it('covers all ten slices, and none of them is a crm', () => {
    expect(ALL).toHaveLength(10);
    expect(ALL.map((o) => o.slice)).not.toContain('crm.pipeline');
    expect(readdirSync(new URL('../ontology/', import.meta.url)).filter((f) => f.endsWith('.json'))).toHaveLength(10);
  });

  it.each(ALL.map((o) => [o.slice, o] as const))('%s validates', (_slice, ontology) => {
    expect(validate(ontology)).toEqual([]);
  });

  it('a slice only accepts work it can prove, and every kind it claims has acceptance', () => {
    for (const o of ALL) {
      expect(o.kinds.length).toBeGreaterThan(0);
      for (const k of o.kinds) expect(o.acceptance[k]).toBeDefined();
    }
  });

  it('kinds and slices are not the same axis', () => {
    // ten kinds, ten slices, and the mapping is still not a bijection: a slice
    // may accept a kind a neighbouring slice also accepts
    expect(TASK_KINDS).toHaveLength(10);
    expect(new Set(ALL.flatMap((o) => o.kinds)).size).toBe(10);
  });
});

describe('plug and play', () => {
  it('the whole set is closed: every requirement is provided by somebody', () => {
    expect(compose(ALL).missing).toEqual([]);
  });

  it('dropping code names every slice that cannot run, not just one', () => {
    const { missing } = compose(ALL.filter((o) => o.slice !== 'code.repo'));
    expect(missing.map((m) => m.contract)).toEqual(['code.change']);
    expect(missing[0]?.neededBy).toEqual([
      'documentation.site',
      'financials.rails',
      'operations.runtime',
      'security.controls',
    ]);
  });

  it('dropping design leaves media waiting on an asset contract', () => {
    const { missing } = compose(ALL.filter((o) => o.slice !== 'design.studio'));
    expect(missing).toEqual([
      { contract: 'design.asset', neededBy: ['code.repo', 'media.studio'] },
    ]);
  });

  it('a slice that requires what it provides is a claim it cannot see', () => {
    const broken: SliceOntology = { ...code, requires: [...(code.requires ?? []), 'code.change'] };
    expect(validate(broken).map((f) => f.rule)).toContain('self_required_contract');
  });

  it('refuses a contract id that is not a dotted name', () => {
    expect(validate({ ...code, provides: ['whatever you like'] }).map((f) => f.rule)).toContain(
      'malformed_contract',
    );
  });
});

describe('resolution', () => {
  it('resolves the canonical id and the label at full confidence', () => {
    expect(resolve(code, 'bug')).toMatchObject({ ok: true, via: 'id', confidence: 1 });
    expect(resolve(code, 'Flaky Test')).toMatchObject({ ok: true, via: 'label', confidence: 1 });
  });

  it('resolves an alias, and never loses what was written', () => {
    const r = resolve(design, 'style guide');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.term.id).toBe('brand-kit');
      expect(r.via).toBe('alias');
      expect(r.raw).toBe('style guide');
    }
  });

  it('resolves the shapes a real seat writes', () => {
    expect(resolve(research, 'd1 d7 d30')).toMatchObject({ ok: true });
    expect(resolve(financial, 'chargeback')).toMatchObject({ ok: true });
    expect(resolve(operation(), 'pager duty')).toMatchObject({ ok: true });
  });

  it('offers candidates instead of guessing', () => {
    const r = resolve(code, 'reference page for the api');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.candidates.length).toBeLessThanOrEqual(5);
  });

  it('refuses a deprecated term and points at its replacement', () => {
    const withDeprecated: SliceOntology = {
      ...design,
      terms: [...design.terms, { id: 'mockup', label: 'mockup', status: 'deprecated', replacedBy: 'prototype' }],
    };
    expect(resolve(withDeprecated, 'mockup')).toMatchObject({
      ok: false,
      reason: 'term_deprecated:use:prototype',
    });
  });

  it('weights the same term differently for different seats', () => {
    const asSecurity = resolve(security, 'secret', { seat: 'seat.security' });
    const asCode = resolve(security, 'secret', { seat: 'seat.code' });
    expect(asSecurity.ok && asSecurity.relevance).toBe(1);
    expect(asCode.ok && asCode.relevance).toBe(0.3);
  });
});

function operation(): SliceOntology {
  return by('operations.runtime');
}

describe('proposals', () => {
  it('keeps the raw term and the seat that wrote it', () => {
    const p = propose(financial, 'metro pricing sweep', 'seat.finance', { intent: 'per-city pricing', at: NOW });
    expect(p.raw).toBe('metro pricing sweep');
    expect(p.by).toBe('seat.finance');
    expect(p.ontologyVersion).toBe(1);
    expect(p.intent).toBe('per-city pricing');
  });

  it('carries the closest existing terms so a reviewer has somewhere to start', () => {
    expect(propose(financial, 'refund payout dispute', 'seat.finance', { at: NOW }).candidates).toEqual(
      expect.arrayContaining(['refund', 'payout']),
    );
  });
});

describe('evidence fits the kind of work', () => {
  it('money movement is not proven by a commit', () => {
    expect(evidenceFits('financial', 'commit:9f2a1c')).toEqual({
      ok: false,
      reason: 'evidence_kind_mismatch:financial_expects_stripe:|payout:|invoice:',
    });
  });

  it('a design is not proven by a test run', () => {
    expect(evidenceFits('design', 'run:npm test').ok).toBe(false);
    expect(evidenceFits('design', 'figma:file/abc123')).toEqual({ ok: true, scheme: 'figma:' });
  });

  it('accepts the scheme each kind actually produces', () => {
    expect(evidenceFits('code', 'commit:abc123').ok).toBe(true);
    expect(evidenceFits('research', 'sheet:model-v3#retention').ok).toBe(true);
    expect(evidenceFits('security', 'scan:trivy/2026-11-01').ok).toBe(true);
    expect(evidenceFits('media', 'render:final-cut-v2').ok).toBe(true);
    expect(evidenceFits('ops', 'deploy:rev-91f').ok).toBe(true);
    expect(evidenceFits('accounting', 'ledger:2026-11#entry-44').ok).toBe(true);
    expect(evidenceFits('support', 'ticket:TCK-119').ok).toBe(true);
    expect(evidenceFits('doc', 'url:https://docs.example.com/guide').ok).toBe(true);
  });

  it('refuses prose dressed as a reference', () => {
    expect(evidenceFits('code', 'it works now')).toEqual({
      ok: false,
      reason: 'evidence_not_a_reference',
    });
  });

  it('lets a slice narrow its scheme but not widen past the kind', () => {
    const narrower: SliceOntology = {
      ...code,
      acceptance: { code: { evidence: ['run:'], gate: 'tests only' } },
    };
    expect(evidenceFits('code', 'commit:abc', narrower).ok).toBe(false);
    expect(evidenceFits('code', 'run:npm test', narrower).ok).toBe(true);

    const widened: SliceOntology = {
      ...financial,
      acceptance: { financial: { evidence: ['commit:'], gate: 'a commit hash' } },
    };
    expect(evidenceFits('financial', 'commit:abc', widened)).toEqual({
      ok: false,
      reason: 'slice_widened_financial_past_stripe:|payout:|invoice:',
    });
  });

  it('every kind has a default scheme, and they are genuinely different', () => {
    expect(Object.keys(KIND_EVIDENCE)).toHaveLength(TASK_KINDS.length);
    expect(new Set(Object.values(KIND_EVIDENCE).flat()).size).toBeGreaterThan(8);
  });
});

describe('completion is gated by the kind', () => {
  const SEAT = { id: 'seat.a', slice: ['financials.rails'] };
  const priced = (over: Partial<WorkRow> = {}): WorkRow => ({
    id: 'w1',
    state: 'ready',
    tier: 't.revenue',
    objectiveRef: 'obj.mrr.v1',
    kind: 'financial',
    surfaces: ['financials.rails'],
    nextActionAt: future(10),
    claimDeadlineAt: future(10),
    progressVersion: 0,
    attempts: 0,
    maxAttempts: 3,
    ...over,
  });

  it('refuses the wrong evidence for money movement', () => {
    const held = claimWork(priced(), SEAT, NOW, { ttlMs: 600_000 });
    if (!held.ok) throw new Error(held.reason);
    expect(complete(held.row, 'seat.a', 'commit:9f2a1c', NOW)).toEqual({
      ok: false,
      reason: 'evidence_kind_mismatch:financial_expects_stripe:|payout:|invoice:',
    });
  });

  it('accepts the provider record', () => {
    const held = claimWork(priced(), SEAT, NOW, { ttlMs: 600_000 });
    if (!held.ok) throw new Error(held.reason);
    expect(complete(held.row, 'seat.a', 'stripe:price_1Qabc', NOW)).toMatchObject({ ok: true });
  });

  it('refuses prose on a kinded row', () => {
    const held = claimWork(priced(), SEAT, NOW, { ttlMs: 600_000 });
    if (!held.ok) throw new Error(held.reason);
    expect(complete(held.row, 'seat.a', 'closed it', NOW)).toEqual({
      ok: false,
      reason: 'evidence_not_a_reference',
    });
  });

  it('leaves unkinded work on the payload rule it always had', () => {
    const held = claimWork(priced({ kind: undefined }), SEAT, NOW, { ttlMs: 600_000 });
    if (!held.ok) throw new Error(held.reason);
    expect(complete(held.row, 'seat.a', 'artifact://sha256/abc', NOW)).toMatchObject({ ok: true });
    expect(complete(held.row, 'seat.a', 'closed it', NOW)).toEqual({
      ok: false,
      reason: 'evidence_must_be_a_reference',
    });
  });
});

describe('structure', () => {
  const broken = (over: Partial<SliceOntology> = {}): SliceOntology => ({
    ...design,
    terms: [
      { id: 'a', label: 'a', parent: 'b' },
      { id: 'b', label: 'b', parent: 'a' },
      { id: 'c', label: 'c', excludes: ['nowhere'] },
      { id: 'gone', label: 'gone', status: 'deprecated' },
    ],
    ...over,
  });

  it('finds a parent cycle, an unknown exclusion, and a retirement with no successor', () => {
    const rules = validate(broken()).map((f) => f.rule);
    expect(rules).toEqual(
      expect.arrayContaining(['parent_cycle', 'unknown_exclusion', 'deprecated_needs_replacement']),
    );
  });

  it('refuses a slice that accepts a kind it has no acceptance for', () => {
    const rules = validate({ ...design, kinds: ['design', 'code'] }).map((f) => f.rule);
    expect(rules).toContain('acceptance_missing');
  });

  it('refuses acceptance recorded for a kind the slice does not accept', () => {
    const rules = validate({ ...design, kinds: ['design'], acceptance: { ...design.acceptance, code: { evidence: ['commit:'], gate: 'tests' } } })
      .map((f) => f.rule);
    expect(rules).toContain('acceptance_for_unaccepted_kind');
  });

  it('refuses a duplicate term and a self-parent', () => {
    const dup: SliceOntology = {
      ...design,
      terms: [
        { id: 'x', label: 'x' },
        { id: 'X ', label: 'second x' },
        { id: 'y', label: 'y', parent: 'y' },
      ],
    };
    const rules = validate(dup).map((f) => f.rule);
    expect(rules).toContain('duplicate_term');
    expect(rules).toContain('self_parent');
  });

  it('refuses an axiom too thin to check', () => {
    expect(validate({ ...design, axioms: ['be good'] }).map((f) => f.rule)).toContain(
      'axiom_too_thin_to_check',
    );
  });
});

describe('versioning', () => {
  it('hashes the document, not the key order', () => {
    const reordered = JSON.parse(JSON.stringify({ ...media, kinds: [...media.kinds] }));
    expect(versionHash(reordered)).toBe(versionHash(media));
  });

  it('a changed ontology has a different hash', () => {
    expect(versionHash({ ...media, version: 2 })).not.toBe(versionHash(media));
  });

  it('the diff is what a human reviews', () => {
    const before = load('media');
    const after: SliceOntology = {
      ...before,
      version: 2,
      terms: before.terms
        .filter((t) => t.id !== 'broll')
        .map((t) => (t.id === 'cut' ? { ...t, aliases: [...(t.aliases ?? []), 'assembly'] } : t))
        .concat([{ id: 'subtitle-track', label: 'subtitle track', parent: 'render' }]),
    };
    const d = diff(before, after);
    expect(d.added).toEqual(['subtitle-track']);
    expect(d.removed).toEqual(['broll']);
    expect(d.changed).toEqual([{ id: 'cut', fields: ['aliases'] }]);
    expect(d.meta).toEqual([]);
  });

  it('reports a changed contract as meta, because it is the thing that breaks a neighbour', () => {
    const before = load('financials');
    const d = diff(before, { ...before, version: 2, provides: ['payment.rail', 'checkout.page'] });
    expect(d.meta).toEqual(['provides']);
  });
});
