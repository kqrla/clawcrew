import { describe, expect, it } from 'vitest';
import { DispatchInput, LEASE_MS, nextAssignment } from '../src/jobs/dispatch.js';

/** docs/51. what gets worked on next, and the reasons it might be nothing. */
const base: DispatchInput = {
  candidates: [
    { taskId: 't.2', kind: 'reply', slice: 'support', objectiveId: 'obj.meenible.support', priority: 5 },
    { taskId: 't.1', kind: 'reply', slice: 'support', objectiveId: 'obj.meenible.support', priority: 9 },
    { taskId: 't.3', kind: 'commit', slice: 'code', objectiveId: 'obj.meenible.code', priority: 20 },
  ],
  seats: [
    { id: 'seat.support', slice: 'support', onCall: true },
    { id: 'seat.code', slice: 'code', onCall: true },
  ],
  leasedTaskIds: [],
  registeredKinds: ['reply', 'commit'],
};

describe('dispatch', () => {
  it('takes the highest priority ready task a seat exists for', () => {
    // t.3 outranks t.1, so priority wins before slice order: the ledger decides, not the seat list
    expect(nextAssignment(base)).toEqual({ ok: true, seat: 'seat.code', taskId: 't.3', kind: 'commit', leaseMs: LEASE_MS });
  });

  it('never hands out a task that is already leased', () => {
    const r = nextAssignment({ ...base, leasedTaskIds: ['t.3'] });
    expect(r.ok && r.taskId).toBe('t.1');
    expect(nextAssignment({ ...base, leasedTaskIds: ['t.1', 't.2', 't.3'] })).toEqual({ ok: false, why: 'nothing_ready' });
  });

  it('refuses a kind with no evidence rule, because it could never finish', () => {
    const r = nextAssignment({ ...base, registeredKinds: ['commit'] });
    expect(r.ok && r.kind).toBe('commit');
    expect(nextAssignment({ ...base, registeredKinds: [] })).toEqual({ ok: false, why: 'kind_unregistered' });
  });

  it('says so when no seat covers the slice, rather than assigning it anyway', () => {
    const r = nextAssignment({ ...base, seats: [{ id: 'seat.code', slice: 'code', onCall: true }], registeredKinds: ['reply'] });
    expect(r).toEqual({ ok: false, why: 'no_seat_for_slice' });
  });

  it('ignores seats that are not on call', () => {
    const r = nextAssignment({ ...base, seats: [{ id: 'seat.support', slice: 'support', onCall: false }], registeredKinds: ['reply'] });
    expect(r).toEqual({ ok: false, why: 'no_seat_for_slice' });
  });
});
