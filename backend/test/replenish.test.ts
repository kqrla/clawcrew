import { describe, expect, it } from 'vitest';
import { Objective, replenish } from '../src/jobs/replenish.js';

/** docs/53. a lagging objective can ask for work, and a busy one cannot. */
const now = new Date('2026-11-07T00:00:00Z');
const obj = (over: Partial<Objective> = {}): Objective => ({
  id: 'obj.meenible.support.inbox', version: 1, ownerTier: 't.test01.support',
  baseline: 0, target: 25, deadline: new Date('2026-12-01T00:00:00Z'),
  status: 'active', kinds: ['support', 'reply'], ...over,
});

describe('replenish', () => {
  it('proposes a measurement task when an objective has never been measured', () => {
    const r = replenish({ objectives: [obj()], measurements: [], openTasks: [], now });
    expect(r.proposals).toHaveLength(1);
    expect(r.proposals[0]).toMatchObject({ why: 'no_measurement', kind: 'support', slice: 'support' });
  });

  it('leaves an objective alone when it is on track', () => {
    const r = replenish({
      objectives: [obj()], openTasks: [], now,
      measurements: [{ objectiveId: 'obj.meenible.support.inbox', value: 24, computedAt: new Date('2026-11-01T00:00:00Z') }],
    });
    expect(r.proposals).toHaveLength(0);
    expect(r.refusals).toEqual([{ objectiveId: 'obj.meenible.support.inbox', why: 'on_track' }]);
  });

  it('proposes work when the metric is behind its own clock', () => {
    const r = replenish({
      objectives: [obj()], openTasks: [], now,
      measurements: [{ objectiveId: 'obj.meenible.support.inbox', value: 2, computedAt: new Date('2026-11-01T00:00:00Z') }],
    });
    expect(r.proposals[0]).toMatchObject({ why: 'behind_target', kind: 'support' });
    expect(r.proposals[0]!.deficit).toBeGreaterThan(0.5);
  });

  it('will not stack a second task on an objective that already has one', () => {
    const r = replenish({
      objectives: [obj()], now,
      openTasks: [{ id: 't.1', objectiveId: 'obj.meenible.support.inbox', kind: 'support', state: 'ready' }],
      measurements: [{ objectiveId: 'obj.meenible.support.inbox', value: 1, computedAt: new Date('2026-11-01T00:00:00Z') }],
    });
    expect(r.proposals).toHaveLength(0);
    expect(r.refusals[0]!.why).toBe('already_queued');
  });

  it('stops at the wip limit rather than at the first task', () => {
    const open = [1, 2].map((i) => ({ id: `t.${i}`, objectiveId: 'obj.meenible.support.inbox', kind: 'support', state: 'ready' }));
    const r = replenish({
      objectives: [obj()], openTasks: open, now,
      measurements: [{ objectiveId: 'obj.meenible.support.inbox', value: 1, computedAt: new Date('2026-11-01T00:00:00Z') }],
    });
    expect(r.refusals[0]!.why).toBe('wip_limit');
  });

  it('refuses an objective whose deadline has passed, and one with no kinds', () => {
    const past = replenish({ objectives: [obj({ deadline: new Date('2026-11-01T00:00:00Z') })], measurements: [], openTasks: [], now });
    expect(past.refusals[0]!.why).toBe('no_deadline_left');
    const none = replenish({ objectives: [obj({ kinds: [] })], measurements: [], openTasks: [], now });
    expect(none.refusals[0]!.why).toBe('kind_unregistered');
  });

  it('refuses a planned line, however far behind its metric', () => {
    const r = replenish({
      objectives: [obj({ lineStatus: 'planned' })], openTasks: [], now,
      measurements: [{ objectiveId: 'obj.meenible.support.inbox', value: 0, computedAt: new Date('2026-11-01T00:00:00Z') }],
    });
    expect(r.proposals).toHaveLength(0);
    expect(r.refusals[0]!.why).toBe('line_not_live');
  });

  it('orders proposals by how far behind they are', () => {
    const r = replenish({
      objectives: [obj({ id: 'obj.meenible.support.inbox' }), obj({ id: 'obj.meenible.code.repo', ownerTier: 't.test01.code' })],
      openTasks: [], now,
      measurements: [
        { objectiveId: 'obj.meenible.support.inbox', value: 1, computedAt: new Date('2026-11-01T00:00:00Z') },
        { objectiveId: 'obj.meenible.code.repo', value: 0, computedAt: new Date('2026-11-01T00:00:00Z') },
      ],
    });
    expect(r.proposals[0]!.objectiveId).toBe('obj.meenible.code.repo');
  });
});
