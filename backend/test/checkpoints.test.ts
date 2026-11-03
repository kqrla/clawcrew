import { describe, expect, it } from 'vitest';
import { CheckpointRun, KIND_CHECKPOINTS, evaluateCompletion } from '../src/domain/checkpoints.js';

/**
 * docs/38. "done" is not a word a seat is allowed to use about its own work.
 */
const at = '2026-11-03T12:00:00.000Z';
const run = (checkpoint: string, by: string, evidence: string, passed = true, at2 = at): CheckpointRun => ({
  checkpoint,
  passed,
  evidence,
  by,
  at: at2,
});
const day = (n: number) => new Date(Date.parse(at) + n * 86_400_000).toISOString();

const build = (runs: CheckpointRun[], seat = 'seat.code') =>
  evaluateCompletion({ kind: 'code', seat }, runs);

describe('completion is a chain, not an announcement', () => {
  it('accepts the full chain when every step has evidence and the checks were not signed by the author', () => {
    const c = build([
      run('built', 'seat.code', 'commit:1f2e'),
      run('tested', 'seat.operations', 'run:ci/9f2a'),
      run('merged', 'seat.code', 'commit:9c11'),
    ]);
    expect(c.ok).toBe(true);
    expect(c.unmet).toEqual([]);
  });

  it('refuses a step nobody ran', () => {
    const c = build([run('built', 'seat.code', 'commit:1f2e')]);
    expect(c.ok).toBe(false);
    expect(c.unmet.map((u) => u.checkpoint)).toEqual(['tested', 'merged']);
    expect(c.unmet[0]!.why).toBe('never ran');
  });

  it('refuses a step that only I signed off', () => {
    const c = build([
      run('built', 'seat.code', 'commit:1f2e'),
      run('tested', 'seat.code', 'run:ci/9f2a'),
      run('merged', 'seat.code', 'commit:9c11'),
    ]);
    expect(c.ok).toBe(false);
    expect(c.selfSigned).toEqual(['tested']);
    expect(c.unmet).toContainEqual({ checkpoint: 'tested', why: 'self_signed' });
  });

  it('refuses a checkpoint signed with the wrong kind of evidence', () => {
    const c = build([
      run('built', 'seat.code', 'a paragraph about how it works'),
      run('tested', 'seat.operations', 'run:ci/9f2a'),
      run('merged', 'seat.code', 'commit:9c11'),
    ]);
    expect(c.ok).toBe(false);
    expect(c.unmet[0]).toMatchObject({ checkpoint: 'built' });
    expect(c.unmet[0]!.why).toMatch(/evidence_not_a_reference|evidence_kind_mismatch/);
  });

  it('refuses a chain whose steps were signed in the wrong order, whatever order they arrived in', () => {
    const c = build([
      run('built', 'seat.code', 'commit:1f2e'),
      run('merged', 'seat.code', 'commit:9c11', true, day(1)),
      run('tested', 'seat.operations', 'run:ci/9f2a', true, day(2)),
    ]);
    expect(c.ok).toBe(false);
    // merged was signed before the test it depends on, so the test proves nothing
    expect(c.unmet).toContainEqual({ checkpoint: 'merged', why: 'out_of_order' });
  });

  it('takes the latest run, so a failed check cannot be buried by an older pass', () => {
    const buried = build([
      run('built', 'seat.code', 'commit:1f2e'),
      run('tested', 'seat.operations', 'run:ci/9f2a'),
      run('merged', 'seat.code', 'commit:9c11'),
      run('tested', 'seat.operations', 'run:ci/9f2b', false),
    ]);
    expect(buried.ok).toBe(false);
    expect(buried.unmet).toContainEqual({ checkpoint: 'tested', why: 'failed' });
  });
});

describe('each kind of work has its own idea of done', () => {
  it('will not let a figure be published before it is licenced', () => {
    const c = evaluateCompletion({ kind: 'design', seat: 'seat.design' }, [
      run('drafted', 'seat.design', 'file:design/hoodie.obj'),
      run('approved', 'seat.design', 'file:design/approved.obj'),
    ]);
    expect(c.ok).toBe(false);
    expect(c.unmet.map((u) => u.checkpoint)).toEqual(['licenced', 'approved']);
  });

  it('will not let money settle on the seller of the money own word', () => {
    const c = evaluateCompletion({ kind: 'financial', seat: 'seat.financials' }, [
      run('priced', 'seat.financials', 'stripe:price_123', true, day(0)),
      run('authorised', 'seat.operations', 'stripe:quote_9', true, day(1)),
      run('settled', 'seat.financials', 'stripe:charge_1', true, day(2)),
    ]);
    expect(c.ok).toBe(false);
    expect(c.selfSigned).toEqual(['settled']);
  });

  it('stops the code chain at the code surface, because a deploy is ops work', () => {
    expect(KIND_CHECKPOINTS.code.map((c) => c.id)).toEqual(['built', 'tested', 'merged']);
  });

  it('declares a chain for every kind the ontology knows', () => {
    expect(Object.keys(KIND_CHECKPOINTS).sort()).toEqual(
      ['accounting', 'code', 'design', 'doc', 'financial', 'media', 'ops', 'research', 'security', 'support'],
    );
    for (const chain of Object.values(KIND_CHECKPOINTS)) {
      expect(chain.length).toBeGreaterThan(1);
      // every chain has at least one step its author may not sign
      expect(chain.some((c) => c.selfSignable === false)).toBe(true);
    }
  });
});
