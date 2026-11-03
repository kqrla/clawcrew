import { describe, expect, it } from 'vitest';
import { Seat, burn, duplicate, freeze, orphan, thaw } from '../src/domain/agents.js';

/**
 * docs/34. four verbs, and the refusals that make them worth having. the refusals
 * are the product here: a lifecycle that only says yes is a lifecycle that cannot
 * be reasoned about after a month.
 */
const NOW = '2026-11-03T09:00:00.000Z';
const plusDays = (d: number) => new Date(Date.parse(NOW) + d * 86_400_000).toISOString();

const seat = (over: Partial<Seat> = {}): Seat => ({
  id: 's.code.01',
  tier: 't.meenible.code',
  lineage: 'lin.code',
  parentId: null,
  depth: 0,
  state: 'live',
  skills: ['git.commit', 'test.run', 'harness.validate'],
  grants: [{ function: 'pushToBranch', scope: { repo: 'kqrla/orchart', branch: 'main' } }],
  ...over,
});

describe('duplicate: a child, not a copy', () => {
  it('gives the child the same lineage and one more step from the root', () => {
    const r = duplicate(seat(), { id: 's.code.02', now: NOW });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.seat.lineage).toBe('lin.code');
    expect(r.seat.depth).toBe(1);
    expect(r.seat.parentId).toBe('s.code.01');
    expect(r.seat.state).toBe('live');
  });

  it('refuses a skill the parent does not hold, because that is an escalation', () => {
    const r = duplicate(seat(), { id: 's.code.02', now: NOW, skills: ['git.commit', 'deploy.prod'] });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toBe('skill_not_granted');
    expect(r.detail).toEqual({ outside: ['deploy.prod'] });
  });

  it('refuses a grant that reaches further than the parent reaches', () => {
    const r = duplicate(seat(), {
      id: 's.code.02',
      now: NOW,
      grants: [{ function: 'pushToBranch', scope: { repo: 'kqrla/orchart', branch: 'main', force: 'yes' } }],
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toBe('grant_not_granted');
  });

  it('allows a grant bound more tightly than the parent', () => {
    const r = duplicate(seat(), {
      id: 's.code.02',
      now: NOW,
      grants: [{ function: 'pushToBranch', scope: { repo: 'kqrla/orchart', branch: 'main' } }],
    });
    expect(r.ok).toBe(true);
  });

  it('refuses a frozen parent and a burned one', () => {
    const frozen = duplicate(seat({ state: 'frozen' }), { id: 'x', now: NOW });
    expect(frozen.ok ? null : frozen.reason).toBe('seat_is_frozen');
    const burned = duplicate(seat({ state: 'burned' }), { id: 'x', now: NOW });
    expect(burned.ok ? null : burned.reason).toBe('seat_is_burned');
  });

  it('stops a lineage from becoming a tree nobody can read', () => {
    const deep = duplicate(seat(), { id: 'a', now: NOW });
    if (!deep.ok) throw new Error('setup');
    const deeper = duplicate(deep.seat, { id: 'b', now: NOW });
    if (!deeper.ok) throw new Error('setup');
    const deepest = duplicate(deeper.seat, { id: 'c', now: NOW });
    if (!deepest.ok) throw new Error('setup');
    const tooDeep = duplicate(deepest.seat, { id: 'd', now: NOW });
    expect(tooDeep.ok ? null : tooDeep.reason).toBe('lineage_too_deep');
  });

  it('refuses an orphaned seat, because an orphan has nobody to answer to', () => {
    const r = duplicate(orphan(seat()), { id: 'x', now: NOW });
    expect(r.ok ? null : r.reason).toBe('orphaned_seat_may_not_spawn');
  });
});

describe('freeze and thaw', () => {
  it('freezes with a deadline and thaws inside it', () => {
    const f = freeze(seat(), { now: NOW });
    if (!f.ok) throw new Error('setup');
    expect(f.seat.state).toBe('frozen');
    expect(f.seat.frozenUntil).toBe(new Date(Date.parse(NOW) + 14 * 86_400_000).toISOString());
    const t = thaw(f.seat, { now: plusDays(3) });
    expect(t.ok && t.seat.state).toBe('live');
    expect(t.ok && t.seat.frozenUntil).toBe(null);
  });

  it('refuses a thaw after the window, because old state is archaeology not state', () => {
    const f = freeze(seat(), { now: NOW });
    if (!f.ok) throw new Error('setup');
    const t = thaw(f.seat, { now: plusDays(20) });
    expect(t.ok ? null : t.reason).toBe('frozen_window_expired');
  });

  it('refuses to freeze twice, and refuses to thaw what is not frozen', () => {
    const f = freeze(seat(), { now: NOW });
    if (!f.ok) throw new Error('setup');
    expect(freeze(f.seat, { now: NOW }).ok).toBe(false);
    expect(thaw(seat(), { now: NOW }).ok).toBe(false);
  });
});

describe('burn: terminal, and the only verb that cannot be undone', () => {
  it('records why, and refuses a burn with no reason', () => {
    const b = burn(seat(), { now: NOW, reason: 'looped on the same failing test for six hours' });
    expect(b.ok).toBe(true);
    if (!b.ok) return;
    expect(b.seat.state).toBe('burned');
    expect(b.seat.burnedReason).toContain('looped');
    expect(burn(seat(), { now: NOW, reason: '  ' }).ok).toBe(false);
  });

  it('refuses every verb afterwards: thaw, duplicate, and a second burn', () => {
    const b = burn(seat(), { now: NOW, reason: 'wrong grant for the job' });
    if (!b.ok) throw new Error('setup');
    expect(thaw(b.seat, { now: NOW }).ok).toBe(false);
    expect(duplicate(b.seat, { id: 'x', now: NOW }).ok).toBe(false);
    expect(burn(b.seat, { now: NOW, reason: 'again' }).ok).toBe(false);
  });

  it('drops the freeze on a burn, so nothing is left half paused', () => {
    const f = freeze(seat(), { now: NOW });
    if (!f.ok) throw new Error('setup');
    const b = burn(f.seat, { now: NOW, reason: 'frozen for the wrong reason' });
    expect(b.ok && b.seat.frozenAt).toBe(null);
  });

  it('orphans a live child into finishing rather than multiplying', () => {
    const child = duplicate(seat(), { id: 'c', now: NOW });
    if (!child.ok) throw new Error('setup');
    const orphaned = orphan(child.seat);
    expect(orphaned.orphaned).toBe(true);
    expect(duplicate(orphaned, { id: 'g', now: NOW }).ok).toBe(false);
  });
});
