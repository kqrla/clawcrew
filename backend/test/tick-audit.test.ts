import { describe, expect, it } from 'vitest';
import { TickerPorts, runTick } from '../src/jobs/ticker.js';

/** the tick carries the auditor's standing disagreements into every heartbeat */
const ports = (alerts: number): TickerPorts => ({
  async tryLock() {
    return true;
  },
  async loadSchedules() {
    return [];
  },
  async saveSchedule() {},
  async emitWake() {},
  async loadRelay() {
    return [];
  },
  async saveRelay() {},
  async deliver() {
    return 'ack' as const;
  },
  async heartbeat() {},
  async countAuditAlerts() {
    return alerts;
  },
});

describe('the heartbeat carries the audit', () => {
  it('reports the number of alerts standing open', async () => {
    const report = await runTick(ports(3), { now: '2026-11-03T01:00:00.000Z' });
    expect(report.auditAlerts).toBe(3);
  });

  it('reports zero when the auditor has nothing open, and zero when it was never asked', async () => {
    expect((await runTick(ports(0), { now: '2026-11-03T01:00:00.000Z' })).auditAlerts).toBe(0);
    const silent = ports(0);
    delete silent.countAuditAlerts;
    expect((await runTick(silent, { now: '2026-11-03T01:00:00.000Z' })).auditAlerts).toBe(0);
  });
});
