import { describe, expect, it } from 'vitest';
import {
  HorizonedCircle,
  canCommit,
  effectiveWindowDays,
  narrowest,
  validateHorizonChain,
} from '../src/domain/horizon.js';

const root: HorizonedCircle = { id: 'root', parent: null, horizon: 'quarter' };
const eng: HorizonedCircle = { id: 'eng', parent: 'root', horizon: 'month' };
const platform: HorizonedCircle = { id: 'eng.platform', parent: 'eng', horizon: 'week' };
const oncall: HorizonedCircle = { id: 'eng.platform.oncall', parent: 'eng.platform', horizon: 'shift' };
const circles = [root, eng, platform, oncall];

describe('temporal layering', () => {
  it('lets a circle commit within its horizon', () => {
    expect(canCommit(oncall, { id: 'o', ownerCircle: 'eng.platform.oncall', horizon: 'shift' })).toEqual({ ok: true });
  });

  it('refuses a commitment that outlives the circle', () => {
    expect(canCommit(oncall, { id: 'o', ownerCircle: 'eng.platform.oncall', horizon: 'month' })).toEqual({
      ok: false,
      reason: 'objective_outlives_circle',
    });
  });

  it('accepts a shorter commitment than the horizon', () => {
    expect(canCommit(root, { id: 'o', ownerCircle: 'root', horizon: 'week' })).toEqual({ ok: true });
  });

  it('passes a well-formed chain', () => {
    expect(validateHorizonChain(circles)).toEqual([]);
  });

  it('flags a child that plans longer than its parent', () => {
    const bad = [...circles.slice(0, 3), { ...oncall, horizon: 'quarter' as const }];
    expect(validateHorizonChain(bad)).toContain('horizon_exceeds_parent:eng.platform.oncall');
  });

  it('flags a missing parent rather than silently accepting the orphan', () => {
    expect(validateHorizonChain([{ id: 'x', parent: 'ghost', horizon: 'week' }])).toContain(
      'unknown_parent:x->ghost',
    );
  });

  it('bounds a commitment by every ancestor', () => {
    // a quarter-long objective taken on by a shift-level on-call seat is a shift.
    expect(effectiveWindowDays('eng.platform.oncall', circles, { id: 'o', ownerCircle: 'eng.platform.oncall', horizon: 'quarter' })).toBe(1);
  });

  it('picks the narrowest horizon', () => {
    expect(narrowest('month', 'week', 'quarter')).toBe('week');
  });
});
