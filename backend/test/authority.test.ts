import { describe, expect, it } from 'vitest';
import {
  ChainLevel,
  applyElevation,
  effectiveHome,
  effectiveInHost,
} from '../src/domain/authority.js';

const chain: ChainLevel[] = [
  { id: 'root', ceiling: { tools: ['git.read', 'git.write', 'ci.run', 'ad.publish', 'asset.write', 'bank.read'], spendUsdPerDay: 500 } },
  { id: 'brand', ceiling: { tools: ['git.read', 'ad.publish', 'asset.write'], spendUsdPerDay: 120 } },
  { id: 'brand.social', ceiling: { tools: ['ad.publish', 'asset.write', 'brand.voice'], spendUsdPerDay: 40 } },
];

const own = { tools: ['asset.write', 'ad.publish', 'bank.read'], spendUsdPerDay: 10 };

describe('authority composition', () => {
  it('intersects down the chain and drops what no level allows', () => {
    const r = effectiveHome(chain, own);
    expect(r.grants.tools).toEqual(['ad.publish', 'asset.write']);
    expect(r.grants.spendUsdPerDay).toBe(10);
  });

  it('explains which level dropped each tool', () => {
    const r = effectiveHome(chain, own);
    const bank = r.trace.find((t) => t.tool === 'bank.read');
    expect(bank).toEqual({ tool: 'bank.read', kept: false, droppedBy: 'brand' });
  });

  it('caps spend at the tightest level', () => {
    const tight: ChainLevel[] = [
      { id: 'root', ceiling: { tools: ['x'], spendUsdPerDay: 5 } },
      { id: 'dept', ceiling: { tools: ['x'], spendUsdPerDay: 50 } },
    ];
    expect(effectiveHome(tight, { tools: ['x'], spendUsdPerDay: 100 }).grants.spendUsdPerDay).toBe(5);
  });

  it('host context defaults spend to zero', () => {
    const hostChain: ChainLevel[] = [
      { id: 'root', ceiling: { tools: ['git.read', 'asset.write'], spendUsdPerDay: 500 } },
      { id: 'eng', ceiling: { tools: ['git.read', 'asset.write'], spendUsdPerDay: 200 } },
    ];
    const r = effectiveInHost(hostChain, own, { scope: { tools: ['asset.write', 'git.read'] } });
    // you cannot be loaned a capability you do not hold: git.read is in scope but not in `own`
    expect(r.grants.tools).toEqual(['asset.write']);
    expect(r.grants.spendUsdPerDay).toBe(0);
    expect(r.mode).toBe('host');
  });

  it('a secondment narrows rather than widens: ad.publish does not travel', () => {
    const hostChain: ChainLevel[] = [
      { id: 'root', ceiling: { tools: ['git.read', 'asset.write', 'ad.publish'], spendUsdPerDay: 500 } },
      { id: 'eng', ceiling: { tools: ['git.read', 'asset.write'], spendUsdPerDay: 200 } },
    ];
    const r = effectiveInHost(hostChain, own, {
      scope: { tools: ['asset.write', 'git.read'], spendUsdPerDay: 20 },
    });
    expect(r.grants.tools).not.toContain('ad.publish');
    // an explicit spend line travels, but the seat's own cap still applies
    expect(r.grants.spendUsdPerDay).toBe(10);
  });
});

describe('elevation', () => {
  const base = { tools: ['git.read'], spendUsdPerDay: 10 };
  const elev = {
    id: 'elev.1',
    issuer: 'eng.platform',
    target: 'eng.platform.infra.ci',
    adds: ['cloud.deploy.staging'],
    issuedAt: '2026-10-31T00:00:00Z',
    expiresAt: '2026-11-14T00:00:00Z',
    maxUses: 200,
    used: 0,
  };
  const ctx = {
    now: '2026-11-01T00:00:00Z',
    targetChain: ['root', 'eng', 'eng.platform', 'eng.platform.infra.ci'],
    issuerCeiling: { tools: ['git.read', 'cloud.deploy.staging'], spendUsdPerDay: 100 },
    dayOfWeek: 1,
    hourUtc: 10,
  };

  it('applies when the issuer is an ancestor and holds the grant', () => {
    const r = applyElevation(base, elev, ctx);
    expect(r.applied).toBe(true);
    expect(r.grants.tools).toContain('cloud.deploy.staging');
  });

  it('refuses an issuer that is not an ancestor', () => {
    expect(applyElevation(base, elev, { ...ctx, targetChain: ['root', 'eng'] }).reason).toBe('issuer_not_ancestor');
  });

  it('refuses to grant beyond the issuer ceiling', () => {
    const r = applyElevation(base, elev, { ...ctx, issuerCeiling: { tools: ['git.read'], spendUsdPerDay: 100 } });
    expect(r.applied).toBe(false);
    expect(r.reason).toContain('issuer_lacks');
  });

  it('refuses after expiry', () => {
    expect(applyElevation(base, elev, { ...ctx, now: '2026-12-01T00:00:00Z' }).reason).toBe('expired');
  });

  it('refuses outside the window', () => {
    const windowed = { ...elev, window: { days: [1, 2, 3, 4, 5], hours: [9, 17] as [number, number] } };
    expect(applyElevation(base, windowed, { ...ctx, hourUtc: 20 }).reason).toBe('outside_window');
    expect(applyElevation(base, windowed, ctx).applied).toBe(true);
  });
});
