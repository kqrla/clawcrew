import { describe, expect, it } from 'vitest';
import {
  Crossing,
  Envelope,
  findCrossing,
  forward,
  permeabilityScore,
  relay,
  validateCrossing,
} from '../src/domain/relay.js';

const crossing: Crossing = {
  id: 'x.brand-eng',
  from: 'brand',
  to: 'eng',
  allowedKinds: ['proposal', 'artifact_ref', 'signal'],
  maxPerHour: 20,
  expiresAt: '2026-12-01T00:00:00Z',
  authorizedBy: 'seat.ceo',
};

const env: Envelope = {
  id: 'env.1',
  from: 'brand',
  to: 'eng',
  kind: 'proposal',
  subject: 'add a pricing line to the launch page',
  payloadRef: 'issue://orchart/task/221',
  authorityBasis: 'x.brand-eng',
  createdAt: '2026-11-01T00:00:00Z',
  expiresAt: '2026-11-02T00:00:00Z',
  hops: 0,
  maxHops: 2,
  dedupeKey: 'brand-eng:proposal:221',
};

const ctx = { now: '2026-11-01T01:00:00Z', perHourCount: 0, alreadySeen: false };

describe('crossings are the sandbox door', () => {
  it('accepts a declared kind in the declared direction', () => {
    expect(relay(env, [crossing], ctx)).toEqual({ state: 'accepted', crossing: 'x.brand-eng' });
  });

  it('refuses when no crossing exists', () => {
    expect(relay(env, [], ctx)).toEqual({ state: 'rejected', reason: 'no_crossing' });
  });

  it('refuses the reverse direction: permeability is directional', () => {
    const back = { ...env, from: 'eng', to: 'brand' };
    expect(relay(back, [crossing], ctx)).toEqual({ state: 'rejected', reason: 'no_crossing' });
  });

  it('refuses a kind the door was not opened for', () => {
    expect(relay({ ...env, kind: 'finding' }, [crossing], ctx)).toEqual({
      state: 'rejected',
      reason: 'kind_not_allowed',
    });
  });

  it('refuses prose as a payload', () => {
    expect(relay({ ...env, payloadRef: 'they should add a pricing line' }, [crossing], ctx)).toEqual({
      state: 'rejected',
      reason: 'payload_not_a_reference',
    });
  });

  it('rate limits rather than blocking outright', () => {
    expect(relay(env, [crossing], { ...ctx, perHourCount: 20 })).toEqual({
      state: 'rejected',
      reason: 'rate_limited',
    });
    expect(relay(env, [crossing], { ...ctx, perHourCount: 19 }).state).toBe('accepted');
  });

  it('expires with the crossing, not with the recipient', () => {
    const longLived = { ...env, expiresAt: '2027-01-01T00:00:00Z' };
    expect(relay(longLived, [crossing], { ...ctx, now: '2026-12-02T00:00:00Z' })).toEqual({
      state: 'rejected',
      reason: 'crossing_expired',
    });
  });

  it('dedupes a replayed envelope', () => {
    expect(relay(env, [crossing], { ...ctx, alreadySeen: true })).toEqual({ state: 'duplicate' });
  });

  it('bounds loops with a hop limit', () => {
    expect(relay({ ...env, hops: 2 }, [crossing], ctx)).toEqual({ state: 'rejected', reason: 'hops_exceeded' });
    const hopped = forward(env, 'brand.design', '2026-11-01T02:00:00Z');
    expect(hopped.hops).toBe(1);
    expect(hopped.replyTo).toBe('brand');
  });
});

describe('crossing declaration', () => {
  it('refuses the obvious mistakes', () => {
    const bad = validateCrossing(
      { ...crossing, from: 'ghost', to: 'ghost', allowedKinds: [], maxPerHour: 0 },
      ['brand', 'eng'],
    );
    expect(bad.ok).toBe(false);
    expect(bad.problems).toContain('unknown_from:ghost');
    expect(bad.problems).toContain('unknown_to:ghost');
    expect(bad.problems).toContain('self_crossing');
    expect(bad.problems).toContain('no_kinds');
    expect(bad.problems).toContain('no_rate');
  });

  it('scores permeability as a shape, not a boolean', () => {
    expect(permeabilityScore([], 'brand', 'eng')).toBe(0);
    expect(permeabilityScore([crossing], 'brand', 'eng')).toBe(60);
    expect(findCrossing([crossing], 'brand', 'eng')?.id).toBe('x.brand-eng');
  });
});
