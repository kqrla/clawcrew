import { describe, expect, it } from 'vitest';
import { Action, classify, gate } from '../src/domain/policy.js';

const config = { spendApprovalThresholdUsd: 50 };
const owned = { kind: 'repo_path' as const, sensitivity: 'internal' as const, ownerTier: 'eng' };

describe('deterministic risk classification', () => {
  it('money leaving the entity is never unattended', () => {
    const a: Action = { verb: 'payout.send', actorTier: 'fin', economic: { direction: 'out', amountUsd: 5 } };
    expect(classify(a, config).cls).toBe('a4');
    expect(gate(a, config).decision).toBe('block');
  });

  it('irreversible external publication needs dual control', () => {
    const a: Action = { verb: 'post.publish', actorTier: 'brand', external: true, reversible: false };
    expect(classify(a, config).cls).toBe('a3');
  });

  it('sensitive surfaces need dual control', () => {
    const a: Action = {
      verb: 'row.write',
      actorTier: 'eng',
      surface: { ...owned, sensitivity: 'sensitive' },
      write: true,
    };
    expect(classify(a, config).cls).toBe('a3');
  });

  it('spend above the threshold needs an approval card', () => {
    const a: Action = { verb: 'ad.buy', actorTier: 'brand', economic: { direction: 'in', amountUsd: 51 } };
    expect(classify(a, config).cls).toBe('a2');
  });

  it('writing to another tier surface needs approval', () => {
    const a: Action = {
      verb: 'file.write',
      actorTier: 'brand',
      surface: { ...owned, ownerTier: 'eng' },
      write: true,
    };
    expect(classify(a, config).cls).toBe('a2');
  });

  it('writing to your own surface is act and notify', () => {
    const a: Action = { verb: 'file.write', actorTier: 'eng', surface: owned, write: true };
    expect(classify(a, config)).toMatchObject({ cls: 'a1', rule: 6 });
    expect(gate(a, config).decision).toBe('notify');
  });

  it('reads are act and log', () => {
    expect(classify({ verb: 'file.read', actorTier: 'eng' }, config).cls).toBe('a0');
  });

  it('the model may propose but not decide', () => {
    const a: Action = { verb: 'payout.send', actorTier: 'fin', economic: { direction: 'out', amountUsd: 5 } };
    const r = gate(a, config, { cls: 'a0', actor: 'seat.cfo' });
    expect(r.classification.cls).toBe('a4');
    expect(r.override).toEqual({ proposed: 'a0', applied: 'a4', actor: 'seat.cfo' });
  });

  it('records no override when the model agrees', () => {
    const a: Action = { verb: 'file.read', actorTier: 'eng' };
    expect(gate(a, config, { cls: 'a0', actor: 'seat.cto' }).override).toBeUndefined();
  });
});
