import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  KIND_EVIDENCE,
  SliceOntology,
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
 * docs/29. the factory's surfaces are not all files, and the schema used to
 * assume they were: one evidence scheme, one acceptance test, applied to a deal.
 */
const NOW = '2026-11-01T12:00:00.000Z';
const future = (m: number) => new Date(Date.parse(NOW) + m * 60_000).toISOString();

const load = (name: string): SliceOntology =>
  JSON.parse(readFileSync(new URL(`../ontology/${name}`, import.meta.url), 'utf8'));

const code = load('code-repo.json');
const crm = load('crm-pipeline.json');
const docs = load('docs-site.json');
const support = load('support-queue.json');
const seeds = { code, crm, docs, support };

describe('the seeds are real ontologies', () => {
  it('there is one for every non-code surface the org runs', () => {
    expect(Object.keys(seeds).sort()).toEqual(['code', 'crm', 'docs', 'support']);
    expect(readdirSync(new URL('../ontology/', import.meta.url)).filter((f) => f.endsWith('.json'))).toHaveLength(4);
  });

  it.each(Object.entries(seeds))('%s validates', (_name, ontology) => {
    expect(validate(ontology)).toEqual([]);
  });

  it('only the code slice accepts code work', () => {
    expect(code.kinds).toEqual(['code', 'data']);
    expect(crm.kinds).toEqual(['deal']);
    expect(support.kinds).toContain('support');
  });
});

describe('resolution', () => {
  it('resolves the canonical id and the label at full confidence', () => {
    expect(resolve(code, 'bug')).toMatchObject({ ok: true, via: 'id', confidence: 1 });
    // the label is not the id: 'flaky test' resolves to `flake` at full confidence
    expect(resolve(code, 'Flaky Test')).toMatchObject({ ok: true, via: 'label', confidence: 1 });
  });

  it('resolves an alias, and never loses what was written', () => {
    const r = resolve(code, 'intermittent failure');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.term.id).toBe('flake');
      expect(r.via).toBe('alias');
      expect(r.confidence).toBeLessThan(1);
      // the raw phrasing is the provenance; normalising it away deletes the data
      expect(r.raw).toBe('intermittent failure');
    }
  });

  it('normalises punctuation and case without inventing a match', () => {
    expect(resolve(docs, 'Getting  Started')).toMatchObject({ ok: true });
    expect(resolve(docs, 'server-rendered-widget')).toMatchObject({ ok: false, reason: 'unknown_term' });
  });

  it('offers candidates instead of guessing', () => {
    const r = resolve(docs, 'reference page for the api');
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe('unknown_term');
      expect(r.candidates.map((t) => t.id)).toContain('reference');
    }
  });

  it('refuses a deprecated term and points at its replacement', () => {
    const withDeprecated: SliceOntology = {
      ...docs,
      terms: [
        ...docs.terms,
        { id: 'spec page', label: 'spec page', status: 'deprecated', replacedBy: 'reference' },
      ],
    };
    expect(resolve(withDeprecated, 'spec page')).toMatchObject({
      ok: false,
      reason: 'term_deprecated:use:reference',
    });
  });

  it('weights the same term differently for different seats', () => {
    // memorium's lesson, applied: one canonical id, two perspectives
    const asSales = resolve(crm, 'stage', { seat: 'seat.sales' });
    const asOps = resolve(crm, 'stage', { seat: 'seat.ops' });
    expect(asSales.ok && asSales.relevance).toBe(0.9);
    expect(asOps.ok && asOps.relevance).toBe(0.2);
  });
});

describe('proposals', () => {
  it('keeps the raw term and the seat that wrote it', () => {
    const p = propose(crm, 'quarterly hygiene sweep', 'seat.sales', { intent: 'a recurring cleanup task', at: NOW });
    expect(p.raw).toBe('quarterly hygiene sweep');
    expect(p.normalised).toBe('quarterly hygiene sweep');
    expect(p.by).toBe('seat.sales');
    expect(p.ontologyVersion).toBe(1);
    expect(p.intent).toBe('a recurring cleanup task');
    expect(p.candidates).toEqual([]);
  });

  it('carries the closest existing terms so a reviewer has somewhere to start', () => {
    expect(propose(crm, 'renewal expansion', 'seat.sales', { at: NOW }).candidates).toEqual(
      expect.arrayContaining(['renewal', 'expansion']),
    );
  });
});

describe('evidence fits the kind of work', () => {
  it('a deal cannot be closed with a commit hash', () => {
    expect(evidenceFits('deal', 'commit:9f2a1c')).toEqual({
      ok: false,
      reason: 'evidence_kind_mismatch:deal_expects_crm:',
    });
  });

  it('a doc cannot be closed with a test run', () => {
    expect(evidenceFits('doc', 'run:npm test').ok).toBe(false);
    expect(evidenceFits('doc', 'url:https://example.com/guide')).toEqual({ ok: true, scheme: 'url:' });
  });

  it('accepts each kind own scheme', () => {
    expect(evidenceFits('code', 'commit:abc123').ok).toBe(true);
    expect(evidenceFits('data', 'sql:select count(*) from t').ok).toBe(true);
    expect(evidenceFits('deal', 'crm:deal_8821').ok).toBe(true);
    expect(evidenceFits('support', 'ticket:TCK-119').ok).toBe(true);
    expect(evidenceFits('research', 'source:https://arxiv.org/abs/2401.1').ok).toBe(true);
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
      ...code,
      acceptance: { code: { evidence: ['url:'], gate: 'a link' } },
    };
    expect(evidenceFits('code', 'url:https://x.dev', widened)).toEqual({
      ok: false,
      reason: 'slice_widened_code_past_commit:|run:',
    });
  });

  it('every kind has a default scheme, and they are not all the same', () => {
    expect(Object.keys(KIND_EVIDENCE)).toHaveLength(8);
    expect(new Set(Object.values(KIND_EVIDENCE).flat()).size).toBeGreaterThan(4);
  });
});

describe('completion is gated by the kind', () => {
  const SEAT = { id: 'seat.a', slice: ['crm.pipeline'] };
  const deal = (over: Partial<WorkRow> = {}): WorkRow => ({
    id: 'w1',
    state: 'ready',
    tier: 't.sales',
    objectiveRef: 'obj.pipeline.v1',
    kind: 'deal',
    surfaces: ['crm.pipeline'],
    nextActionAt: future(10),
    claimDeadlineAt: future(10),
    progressVersion: 0,
    attempts: 0,
    maxAttempts: 3,
    ...over,
  });

  it('refuses the wrong evidence for a deal', () => {
    const held = claimWork(deal(), SEAT, NOW, { ttlMs: 600_000 });
    if (!held.ok) throw new Error(held.reason);
    expect(complete(held.row, 'seat.a', 'commit:9f2a1c', NOW)).toEqual({
      ok: false,
      reason: 'evidence_kind_mismatch:deal_expects_crm:',
    });
  });

  it('accepts the right evidence, and still requires a reference', () => {
    const held = claimWork(deal(), SEAT, NOW, { ttlMs: 600_000 });
    if (!held.ok) throw new Error(held.reason);
    expect(complete(held.row, 'seat.a', 'crm:deal_8821', NOW)).toMatchObject({ ok: true });
    // a kinded row is held to its kind's vocabulary, so prose fails there first
    expect(complete(held.row, 'seat.a', 'closed it', NOW)).toEqual({
      ok: false,
      reason: 'evidence_not_a_reference',
    });
  });

  it('leaves unkinded work on the payload rule it always had', () => {
    const held = claimWork(deal({ kind: undefined }), SEAT, NOW, { ttlMs: 600_000 });
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
    ...docs,
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
    const rules = validate({ ...docs, kinds: ['doc', 'deal'] }).map((f) => f.rule);
    expect(rules).toContain('acceptance_missing');
  });

  it('refuses acceptance recorded for a kind the slice does not accept', () => {
    const rules = validate({ ...docs, kinds: ['doc'] }).map((f) => f.rule);
    expect(rules).toContain('acceptance_for_unaccepted_kind');
  });

  it('refuses a duplicate term and a self-parent', () => {
    const dup: SliceOntology = {
      ...docs,
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
    expect(validate({ ...docs, axioms: ['be good'] }).map((f) => f.rule)).toContain(
      'axiom_too_thin_to_check',
    );
  });
});

describe('versioning', () => {
  it('hashes the document, not the key order', () => {
    const reordered = JSON.parse(JSON.stringify({ ...crm, kinds: [...crm.kinds] }));
    expect(versionHash(reordered)).toBe(versionHash(crm));
  });

  it('a changed ontology has a different hash', () => {
    expect(versionHash({ ...crm, version: 2 })).not.toBe(versionHash(crm));
  });

  it('the diff is what a human reviews', () => {
    const before = load('crm-pipeline.json');
    const after: SliceOntology = {
      ...before,
      version: 2,
      terms: before.terms
        .filter((t) => t.id !== 'disqualified')
        .map((t) => (t.id === 'stage' ? { ...t, aliases: [...(t.aliases ?? []), 'milestone'] } : t))
        .concat([{ id: 'pipeline-review', label: 'pipeline review', parent: 'deal' }]),
    };
    const d = diff(before, after);
    expect(d.added).toEqual(['pipeline-review']);
    expect(d.removed).toEqual(['disqualified']);
    expect(d.changed).toEqual([{ id: 'stage', fields: ['aliases'] }]);
    expect(d.meta).toEqual([]);
  });
});
