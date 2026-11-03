import { describe, expect, it } from 'vitest';
import { Reading } from '../src/domain/measure.js';
import {
  AuditAlert,
  ExternalObservation,
  auditObjective,
  auditRound,
  dueForAudit,
  reconcileAlerts,
} from '../src/domain/audit.js';

/**
 * docs/33. the auditor asks a third time, from outside, on a slow clock.
 */
const NOW = '2026-11-03T01:00:00.000Z';
const at = (h: number) => new Date(Date.parse(NOW) - h * 3_600_000).toISOString();

const OBJ = {
  ref: 'obj.meenible.code.repo',
  source: 'git:rev-list --count origin/main --since=7.days',
  crosscheckSource: 'http:GET https://api.github.com/repos/kqrla/orchart/commits',
};

const reading = (over: Partial<Reading> = {}): Reading => ({
  objectiveRef: OBJ.ref,
  objectiveVersion: 1,
  source: OBJ.source,
  role: 'primary',
  value: 25,
  ok: true,
  computedAt: at(1),
  runBy: 'runner.gauges',
  ...over,
});

const pair = (primary: number, crosscheck: number, over: Partial<Reading> = {}) => [
  reading({ value: primary, ...over }),
  reading({ role: 'crosscheck', source: OBJ.crosscheckSource!, value: crosscheck, runBy: 'runner.audit', ...over }),
];

const outside = (over: Partial<ExternalObservation> = {}): ExternalObservation => ({
  objectiveRef: OBJ.ref,
  source: 'http:GET https://api.github.com/repos/kqrla/orchart/git/refs/heads/main',
  observedBy: 'witness.github',
  value: 25,
  ok: true,
  observedAt: at(1),
  ...over,
});

const audit = (readings: Reading[], ext: ExternalObservation | undefined) =>
  auditObjective(OBJ, readings, ext, { now: NOW });

describe('three answers, not two', () => {
  it('agrees when the outsider sees what the org sees', () => {
    expect(audit(pair(25, 25), outside()).verdict).toBe('agrees');
  });

  it('calls a blind spot what it is: the org agrees with itself and nobody else does', () => {
    // both internal expressions read the same stale table. they agree, and they
    // are both wrong, which is the failure a two-way check cannot see
    const r = audit(pair(1, 1), outside({ value: 25 }));
    expect(r.verdict).toBe('blind_spot');
    expect(r.primary).toBe(1);
    expect(r.external).toBe(25);
    expect(r.spread).toBeCloseTo(0.96, 2);
  });

  it('reports an internal disagreement without waiting for the outsider', () => {
    const r = audit(pair(25, 3), outside());
    expect(r.verdict).toBe('disputes');
    expect(r.reason).toBe('internal_disagreement');
  });

  it('tolerates a small difference and names the spread', () => {
    const r = audit(pair(25, 25), outside({ value: 26 }));
    expect(r.verdict).toBe('agrees');
    expect(r.spread).toBeCloseTo(0.0385, 3);
  });

  it('treats a witness running an internal expression as no witness at all', () => {
    const r = audit(pair(25, 25), outside({ source: OBJ.source }));
    expect(r.verdict).toBe('unverifiable');
    expect(r.reason).toBe('external_is_an_internal_expression');
  });

  it('refuses a third answer produced by the same hand', () => {
    const r = audit(pair(25, 25), outside({ observedBy: 'runner.gauges' }));
    expect(r.reason).toBe('external_observer_is_the_org');
  });

  it('will not audit an internal pair that came from one runner', () => {
    const same = [reading({ value: 25 }), reading({ role: 'crosscheck', value: 25, runBy: 'runner.gauges' })];
    expect(audit(same, outside()).reason).toBe('same_runner');
  });

  it('cannot verify a number the org never measured', () => {
    expect(audit([], outside()).reason).toBe('primary_never_run');
  });

  it('cannot verify without an outsider, and says which', () => {
    expect(audit(pair(25, 25), undefined).reason).toBe('no_external_witness');
  });

  it('cannot verify when the witness failed', () => {
    expect(audit(pair(25, 25), outside({ ok: false, value: null })).reason).toBe('external_failed');
  });
});

describe('a round is the whole objective set', () => {
  const objectives = [
    { ref: 'obj.a', source: 'sql:select 1', crosscheckSource: 'sql:select 2' },
    { ref: 'obj.b', source: 'sql:select 3', crosscheckSource: 'sql:select 4' },
    { ref: 'obj.c', source: 'sql:select 5', crosscheckSource: 'sql:select 6' },
  ];

  const readings: Reading[] = [
    { objectiveRef: 'obj.a', objectiveVersion: 1, source: 'sql:select 1', role: 'primary', value: 10, ok: true, computedAt: at(1), runBy: 'r.one' },
    { objectiveRef: 'obj.a', objectiveVersion: 1, source: 'sql:select 2', role: 'crosscheck', value: 10, ok: true, computedAt: at(1), runBy: 'r.two' },
    { objectiveRef: 'obj.b', objectiveVersion: 1, source: 'sql:select 3', role: 'primary', value: 7, ok: true, computedAt: at(1), runBy: 'r.one' },
    { objectiveRef: 'obj.b', objectiveVersion: 1, source: 'sql:select 4', role: 'crosscheck', value: 7, ok: true, computedAt: at(1), runBy: 'r.two' },
  ];

  it('raises a high alert for a blind spot and a medium one for a number it cannot see', () => {
    const { results, alerts } = auditRound(objectives, readings, [
      { objectiveRef: 'obj.a', source: 'http:GET https://warehouse.example/report', observedBy: 'witness.warehouse', value: 4, ok: true, observedAt: at(1) },
    ], { now: NOW });

    expect(results.map((r) => r.verdict)).toEqual(['blind_spot', 'unverifiable', 'unverifiable']);
    expect(alerts.map((a) => a.code)).toEqual(['audit_blind_spot', 'audit_cannot_verify', 'audit_cannot_verify']);
    expect(alerts[0]!.severity).toBe('high');
    expect(alerts[1]!.severity).toBe('medium');
  });

  it('nothing is raised for a number that holds up', () => {
    const { alerts } = auditRound([objectives[0]!], readings, [
      { objectiveRef: 'obj.a', source: 'http:GET https://warehouse.example/report', observedBy: 'witness.warehouse', value: 10, ok: true, observedAt: at(1) },
    ], { now: NOW });
    expect(alerts).toEqual([]);
  });
});

describe('the slow clock', () => {
  it('is due at once when it has never run', () => {
    expect(dueForAudit(null, NOW)).toEqual({ due: true, nextAt: null });
  });

  it('waits a week, because a disagreement is not an outage', () => {
    const { due, nextAt } = dueForAudit('2026-11-01T09:00:00.000Z', NOW);
    expect(due).toBe(false);
    expect(nextAt).toBe('2026-11-08T09:00:00.000Z');
  });

  it('is due when the week is up', () => {
    expect(dueForAudit('2026-10-27T01:00:00.000Z', NOW).due).toBe(true);
  });

  it('treats an unreadable timestamp as never run rather than as fresh', () => {
    expect(dueForAudit('yesterday-ish', NOW).due).toBe(true);
  });
});

describe('an alert closes on evidence, never on time', () => {
  const alert = (code: AuditAlert['code'], ref: string): AuditAlert => ({
    objectiveRef: ref,
    code,
    severity: 'high',
    detail: {},
  });

  it('keeps an alert the current round still raises', () => {
    expect(reconcileAlerts([alert('audit_blind_spot', 'obj.a')], [alert('audit_blind_spot', 'obj.a')])).toHaveLength(1);
  });

  it('closes an alert the current round no longer raises', () => {
    expect(reconcileAlerts([alert('audit_blind_spot', 'obj.a')], [])).toEqual([]);
  });

  it('does not let a resolved blind spot close an unrelated dispute', () => {
    const open = [alert('audit_dispute', 'obj.a'), alert('audit_blind_spot', 'obj.a')];
    const still = reconcileAlerts(open, [alert('audit_dispute', 'obj.a')]);
    expect(still.map((a) => a.code)).toEqual(['audit_dispute']);
  });
});
