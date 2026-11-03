import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { SliceOntology, compose } from '../src/domain/ontology.js';
import { ToolEntry, toolsForSlice, validateToolbox } from '../src/domain/toolbox.js';

/**
 * docs/36. the toolbox is a permission list. the slice set closes it, not taste.
 */
const load = (n: string): SliceOntology =>
  JSON.parse(readFileSync(new URL(`../ontology/${n}.json`, import.meta.url), 'utf8'));
const ALL = readdirSync(new URL('../ontology/', import.meta.url))
  .filter((f) => f.endsWith('.json'))
  .map((f) => load(f.replace('.json', '')));
const COMPOSITION = compose(ALL);
const INDEX: { tools: ToolEntry[] } = JSON.parse(
  readFileSync(new URL('../../toolbox/index.json', import.meta.url), 'utf8'),
);

const codes = (entries: ToolEntry[]) => validateToolbox(entries, COMPOSITION).faults.map((f) => f.code);

describe('the shelf is closed by the slice ontology', () => {
  it('the index in the repo is valid against the live slice set', () => {
    const report = validateToolbox(INDEX.tools, COMPOSITION);
    expect(report.faults).toEqual([]);
    expect(report.ok).toBe(true);
  });

  it('recognises what this repo has actually run', () => {
    const report = validateToolbox(INDEX.tools, COMPOSITION);
    expect(report.adopted).toEqual(['postgres', 'node-vitest', 'git', 'python3']);
  });

  it('refuses a tool for a surface no slice provides', () => {
    const t: ToolEntry = { id: 'discord', status: 'candidate', holder: 'slice', surface: 'chat.presence' };
    expect(codes([t])).toContain('surface_not_in_the_slice_set');
  });

  it('refuses a slice-held tool that names no surface, because that is a grant with no contract', () => {
    const t: ToolEntry = { id: 'misc', status: 'candidate', holder: 'slice' };
    expect(codes([t])).toContain('slice_tool_without_a_surface');
  });

  it('refuses an engine tool that claims a surface, because that is reach smuggled into infrastructure', () => {
    const t: ToolEntry = { id: 'sneaky', status: 'candidate', holder: 'engine', surface: 'code.change' };
    expect(codes([t])).toContain('engine_tool_claims_a_surface');
  });

  it('refuses an adopted tool with nothing to show for it', () => {
    const t: ToolEntry = { id: 'trusted', status: 'adopted', holder: 'engine', licence: 'MIT' };
    expect(codes([t])).toContain('adopted_without_evidence');
  });

  it('refuses a rejection with no stated reason', () => {
    const t: ToolEntry = { id: 'nope', status: 'rejected', holder: 'slice', surface: 'code.change' };
    expect(codes([t])).toContain('rejection_without_a_reason');
  });
});

describe('an agent reaches exactly its slice', () => {
  it('gives the support slice nothing, because no support tool is adopted yet', () => {
    const support = ALL.find((o) => o.slice === 'support.inbox')!;
    expect(toolsForSlice(support, INDEX.tools)).toEqual([]);
  });

  it('gives the code slice nothing either, since github is still a candidate', () => {
    const code = ALL.find((o) => o.slice === 'code.repo')!;
    expect(toolsForSlice(code, INDEX.tools)).toEqual([]);
  });

  it('hands over a tool only once it is adopted and the slice names the surface', () => {
    const withStripe: ToolEntry = {
      id: 'stripe',
      status: 'adopted',
      holder: 'slice',
      surface: 'payment.rail',
      licence: 'proprietary-saas',
      evidence: 'a checkout object created in test mode',
    };
    const fin = ALL.find((o) => o.slice === 'financials.rails')!;
    const acct = ALL.find((o) => o.slice === 'accounting.books')!;
    expect(toolsForSlice(fin, [withStripe]).map((t) => t.id)).toEqual(['stripe']);
    // accounting requires payment.rail but does not provide it: the grant is not shared
    expect(toolsForSlice(acct, [withStripe])).toEqual([]);
  });
});
