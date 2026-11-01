import { describe, expect, it } from 'vitest';
import { PluginRegistry, configFor } from '../src/plugins/registry.js';
import { sqlSource, assertReadOnly } from '../src/plugins/sources/sql.js';
import { weeklyAuditor } from '../src/plugins/auditors/weekly.js';
import { AuditInput } from '../src/plugins/types.js';

describe('plugin registry', () => {
  it('registers and resolves a source by scheme', () => {
    const r = new PluginRegistry();
    r.register(sqlSource());
    expect(r.sourceFor('sql:analytics.activation_daily').id).toBe('sql');
    expect(() => r.sourceFor('http://example.com')).toThrow(/no objective source/);
  });

  it('refuses a duplicate id', () => {
    const r = new PluginRegistry();
    r.register(sqlSource());
    expect(() => r.register(sqlSource())).toThrow(/already registered/);
  });

  it('refuses a plugin built for another abi', () => {
    const r = new PluginRegistry();
    expect(() => r.register({ ...sqlSource(), abi: '2' })).toThrow(/abi/);
  });

  it('only enables what the committed config lists', () => {
    const available = [sqlSource(), weeklyAuditor()];
    const config = configFor([sqlSource()]);
    const r = PluginRegistry.fromConfig(config, available);
    expect(r.list()).toHaveLength(1);
    expect(r.auditors()).toHaveLength(0);
  });

  it('reports a config that references a missing plugin', () => {
    const config = { version: 1 as const, plugins: [{ kind: 'auditor' as const, id: 'ghost' }], policy: { spendApprovalThresholdUsd: 50 } };
    expect(() => PluginRegistry.fromConfig(config, [sqlSource()])).toThrow(/unknown plugins: auditor:ghost/);
  });
});

describe('sql objective source', () => {
  it('only allows a single read-only statement', () => {
    expect(() => assertReadOnly('delete from task')).toThrow(/select or with/);
    expect(() => assertReadOnly('select 1; drop table task')).toThrow(/single statement/);
    expect(() => assertReadOnly('select * from task; update task set state = \'done\'')).toThrow();
    expect(() => assertReadOnly('with x as (select 1) select * from x')).not.toThrow();
  });

  it('reads one numeric value', async () => {
    const src = sqlSource();
    const reading = await src.read('sql:select pct from analytics', { now: '2026-11-07T06:00:00Z', runSql: async () => [{ pct: '0.47' }] });
    expect(reading.value).toBe(0.47);
    expect(reading.provenance).toBe('sql');
  });
});

describe('weekly auditor', () => {
  const input: AuditInput = {
    now: '2026-11-07T06:00:00Z',
    week: '2026-W45',
    tasks: [
      { id: 't1', objectiveId: null, ownerCircle: 'brand', state: 'in_progress', costUsd: 2 },
      { id: 't2', objectiveId: 'obj.activation', ownerCircle: 'product', state: 'done', costUsd: 40, completedAt: '2026-11-06T00:00:00Z' },
    ],
    objectives: [
      { id: 'obj.activation', ownerCircle: 'product', metric: 'pct', source: 'sql:a', baseline: 0.31, target: 0.55, status: 'active', deadline: '2026-12-15' },
      { id: 'obj.dark', ownerCircle: 'product', metric: 'pct', source: 'sql:b', baseline: 0.1, target: 0.5, status: 'active', deadline: '2026-12-15' },
    ],
    evidence: [{ objective: 'obj.activation', source: 'sql:a', value: 0.34, computedAt: '2026-11-07T05:00:00Z', runBy: 'auditor' }],
  };

  it('reports untraceable work, claim gaps and unmeasured objectives', async () => {
    const findings = await weeklyAuditor().run(input);
    const kinds = findings.map((f) => `${f.question}:${f.severity}`);
    expect(kinds).toContain('q2:untraceable');
    expect(kinds).toContain('q1:drift');
    expect(kinds).toContain('q2:stall');
    expect(findings.every((f) => f.status === 'open')).toBe(true);
    expect(findings.every((f) => f.id.startsWith('fnd.2026-W45.'))).toBe(true);
  });
});
