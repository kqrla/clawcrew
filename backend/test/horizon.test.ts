import { describe, expect, it } from 'vitest';
import {
  HorizonedTier,
  canCommit,
  effectiveWindowDays,
  narrowest,
  validateHorizonChain,
} from '../src/domain/horizon.js';

const root: HorizonedTier = { id: 'root', parent: null, horizon: 'quarter' };
const eng: HorizonedTier = { id: 'eng', parent: 'root', horizon: 'month' };
const platform: HorizonedTier = { id: 'eng.platform', parent: 'eng', horizon: 'week' };
const oncall: HorizonedTier = { id: 'eng.platform.oncall', parent: 'eng.platform', horizon: 'shift' };
const tiers = [root, eng, platform, oncall];

describe('temporal layering', () => {
  it('lets a tier commit within its horizon', () => {
    expect(canCommit(oncall, { id: 'o', ownerTier: 'eng.platform.oncall', horizon: 'shift' })).toEqual({ ok: true });
  });

  it('refuses a commitment that outlives the tier', () => {
    expect(canCommit(oncall, { id: 'o', ownerTier: 'eng.platform.oncall', horizon: 'month' })).toEqual({
      ok: false,
      reason: 'objective_outlives_tier',
    });
  });

  it('accepts a shorter commitment than the horizon', () => {
    expect(canCommit(root, { id: 'o', ownerTier: 'root', horizon: 'week' })).toEqual({ ok: true });
  });

  it('passes a well-formed chain', () => {
    expect(validateHorizonChain(tiers)).toEqual([]);
  });

  it('flags a child that plans longer than its parent', () => {
    const bad = [...tiers.slice(0, 3), { ...oncall, horizon: 'quarter' as const }];
    expect(validateHorizonChain(bad)).toContain('horizon_exceeds_parent:eng.platform.oncall');
  });

  it('flags a missing parent rather than silently accepting the orphan', () => {
    expect(validateHorizonChain([{ id: 'x', parent: 'ghost', horizon: 'week' }])).toContain(
      'unknown_parent:x->ghost',
    );
  });

  it('bounds a commitment by every ancestor', () => {
    // a quarter-long objective taken on by a shift-level on-call seat is a shift.
    expect(effectiveWindowDays('eng.platform.oncall', tiers, { id: 'o', ownerTier: 'eng.platform.oncall', horizon: 'quarter' })).toBe(1);
  });

  it('picks the narrowest horizon', () => {
    expect(narrowest('month', 'week', 'quarter')).toBe('week');
  });
});
