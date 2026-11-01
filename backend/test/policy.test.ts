import { describe, expect, it } from 'vitest';
import { Action, classify, gate } from '../src/domain/policy.js';

const config = { spendApprovalThresholdUsd: 50 };
const owned = { kind: 'repo_path' as const, sensitivity: 'internal' as const, ownerCircle: 'eng' };

describe('deterministic risk classification', () => {
  it('money leaving the entity is never unattended', () => {
    const a: Action = { verb: 'payout.send', actorCircle: 'fin', economic: { direction: 'out', amountUsd: 5 } };
    expect(classify(a, config).cls).toBe('a4');
    expect(gate(a, config).decision).toBe('block');
  });

  it('irreversible external publication needs dual control', () => {
    const a: Action = { verb: 'post.publish', actorCircle: 'brand', external: true, reversible: false };
    expect(classify(a, config).cls).toBe('a3');
  });

  it('sensitive surfaces need dual control', () => {
    const a: Action = {
      verb: 'row.write',
      actorCircle: 'eng',
      surface: { ...owned, sensitivity: 'sensitive' },
      write: true,
    };
    expect(classify(a, config).cls).toBe('a3');
  });

  it('spend above the threshold needs an approval card', () => {
    const a: Action = { verb: 'ad.buy', actorCircle: 'brand', economic: { direction: 'in', amountUsd: 51 } };
    expect(classify(a, config).cls).toBe('a2');
  });

  it('writing to another circle surface needs approval', () => {
    const a: Action = {
      verb: 'file.write',
      actorCircle: 'brand',
      surface: { ...owned, ownerCircle: 'eng' },
      write: true,
    };
    expect(classify(a, config).cls).toBe('a2');
  });

  it('writing to your own surface is act and notify', () => {
    const a: Action = { verb: 'file.write', actorCircle: 'eng', surface: owned, write: true };
    expect(classify(a, config)).toMatchObject({ cls: 'a1', rule: 6 });
    expect(gate(a, config).decision).toBe('notify');
  });

  it('reads are act and log', () => {
    expect(classify({ verb: 'file.read', actorCircle: 'eng' }, config).cls).toBe('a0');
  });

  it('the model may propose but not decide', () => {
    const a: Action = { verb: 'payout.send', actorCircle: 'fin', economic: { direction: 'out', amountUsd: 5 } };
    const r = gate(a, config, { cls: 'a0', actor: 'seat.cfo' });
    expect(r.classification.cls).toBe('a4');
    expect(r.override).toEqual({ proposed: 'a0', applied: 'a4', actor: 'seat.cfo' });
  });

  it('records no override when the model agrees', () => {
    const a: Action = { verb: 'file.read', actorCircle: 'eng' };
    expect(gate(a, config, { cls: 'a0', actor: 'seat.cto' }).override).toBeUndefined();
  });
});
