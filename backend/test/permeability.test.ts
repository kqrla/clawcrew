import { describe, expect, it } from 'vitest';
import {
  Crossing,
  CrossingDecl,
  authorize,
  burstFor,
  compileCrossings,
  consume,
  resolveCrossing,
} from '../src/domain/permeability.js';

const NOW = '2026-11-01T00:00:00.000Z';
const TIERS = ['root', 'brand', 'brand.social', 'eng', 'eng.product', 'fin.ops'];

function decl(over: Partial<CrossingDecl> = {}): CrossingDecl {
  return {
    id: 'brand-to-eng',
    from: 'brand.social',
    to: 'eng.product',
    kinds: ['proposal', 'artifact_ref'],
    maxPerHour: 60,
    expiresAt: '2027-01-01T00:00:00.000Z',
    authorizedBy: 'root',
    reason: 'launch assets',
    ...over,
  };
}

function compiled(over: Partial<CrossingDecl> = {}): Crossing {
  const { crossings } = compileCrossings([decl(over)], { tiers: TIERS, now: NOW, configHash: 'h1' });
  return crossings[0]!;
}

describe('permeability', () => {
  it('compiles a clean declaration', () => {
    const { crossings, problems } = compileCrossings([decl()], {
      tiers: TIERS,
      now: NOW,
      configHash: 'h1',
    });
    expect(problems).toEqual([]);
    expect(crossings[0]!.configHash).toBe('h1');
    expect(crossings[0]!.revokeMode).toBe('drain');
  });

  it('refuses the declaration mistakes that become holes', () => {
    const { problems } = compileCrossings(
      [
        decl({ id: 'a', from: 'ghost' }),
        decl({ id: 'b', to: 'brand.social' }),
        decl({ id: 'c', kinds: [] }),
        decl({ id: 'd', maxPerHour: 0 }),
        decl({ id: 'e', expiresAt: '' }),
        decl({ id: 'f', reason: '  ' }),
        decl({ id: 'g', expiresAt: '2026-10-01T00:00:00.000Z' }),
      ],
      { tiers: TIERS, now: NOW, configHash: 'h1' },
    );
    const byId = Object.fromEntries(problems.map((p) => [p.id, p.problem]));
    expect(byId.a).toContain('unknown_from:ghost');
    expect(byId.b).toContain('self_crossing');
    expect(byId.c).toContain('no_kinds');
    expect(byId.d).toContain('no_rate');
    expect(byId.e).toContain('no_expiry');
    expect(byId.f).toContain('no_reason');
    expect(byId.g).toBe('already_expired');
  });

  it('denies by default', () => {
    expect(resolveCrossing([], { from: 'brand.social', to: 'eng.product', kind: 'proposal', now: NOW })).toEqual({
      ok: false,
      reason: 'no_crossing',
    });
  });

  it('denies the wrong kind across an open door', () => {
    const r = resolveCrossing([compiled()], {
      from: 'brand.social',
      to: 'eng.product',
      kind: 'signal',
      now: NOW,
    });
    expect(r).toEqual({ ok: false, reason: 'kind_not_allowed' });
  });

  it('denies after expiry', () => {
    const r = resolveCrossing([compiled()], {
      from: 'brand.social',
      to: 'eng.product',
      kind: 'proposal',
      now: '2027-06-01T00:00:00.000Z',
    });
    expect(r).toEqual({ ok: false, reason: 'crossing_expired' });
  });

  it('does not union two doors into a wider permission', () => {
    const narrow = compiled({ id: 'narrow', kinds: ['proposal'] });
    const other = compiled({ id: 'other', kinds: ['signal'] });
    const r = resolveCrossing([narrow, other], {
      from: 'brand.social',
      to: 'eng.product',
      kind: 'artifact_ref',
      now: NOW,
    });
    expect(r).toEqual({ ok: false, reason: 'kind_not_allowed' });
  });

  it('prefers the narrower matching door', () => {
    const wide = compiled({ id: 'wide', kinds: ['proposal', 'signal', 'finding'] });
    const narrow = compiled({ id: 'narrow', kinds: ['proposal'] });
    const r = resolveCrossing([wide, narrow], {
      from: 'brand.social',
      to: 'eng.product',
      kind: 'proposal',
      now: NOW,
    });
    expect(r.ok && r.crossing.id).toBe('narrow');
  });

  it('fills a burst then refuses, and recovers by refill', () => {
    const c = compiled({ maxPerHour: 60 }); // burst 10, refill 1 per minute
    expect(burstFor(60)).toBe(10);
    let state = consume(c, null, NOW);
    expect(state.allowed).toBe(true);
    for (let i = 1; i < 10; i++) state = consume(c, state.state, NOW);
    expect(state.allowed).toBe(true);
    expect(state.state.tokens).toBe(0);

    const blocked = consume(c, state.state, NOW);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterMs).toBe(60_000);

    const later = consume(c, blocked.state, '2026-11-01T00:05:00.000Z');
    expect(later.allowed).toBe(true);
    expect(later.state.tokens).toBeCloseTo(4, 5);
  });

  it('sizes a message against the door', () => {
    const c = compiled({ maxBytes: 1000 });
    const r = authorize([c], {
      from: 'brand.social',
      to: 'eng.product',
      kind: 'artifact_ref',
      now: NOW,
      bytes: 2000,
    }, null);
    expect(r).toEqual({ ok: false, reason: 'too_large' });
  });

  it('authorizes and returns the spent bucket', () => {
    const r = authorize([compiled()], {
      from: 'brand.social',
      to: 'eng.product',
      kind: 'proposal',
      now: NOW,
    }, null);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.state.tokens).toBeLessThan(burstFor(60));
  });
});
