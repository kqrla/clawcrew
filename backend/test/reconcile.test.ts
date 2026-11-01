import { describe, expect, it } from 'vitest';
import {
  MappedCard,
  ProjectionFinding,
  ReconcilePorts,
  normalizeRemote,
  reconcileProjections,
} from '../src/jobs/reconcile.js';

function harness(remote: Record<string, { state: string | null } | null>) {
  const findings: ProjectionFinding[] = [];
  const repushed: string[] = [];
  const cards: MappedCard[] = [
    { taskId: 't1', remoteId: 'r1', localState: 'in_progress' },
    { taskId: 't2', remoteId: 'r2', localState: 'open' },
    { taskId: 't3', remoteId: 'r3', localState: 'open' },
    { taskId: 't4', remoteId: 'r4', localState: 'open' },
  ];
  const ports: ReconcilePorts = {
    async listMapped() {
      return cards;
    },
    async fetchRemote(id) {
      return remote[id] ?? null;
    },
    async repush(card) {
      repushed.push(card.taskId);
    },
    async emit(f) {
      findings.push(f);
    },
  };
  return { ports, findings, repushed };
}

describe('projection reconciliation', () => {
  const remote = {
    r1: { state: 'In Progress' }, // agrees
    r2: { state: 'Done' }, // someone closed it on the board
    r3: null, // card was deleted
    r4: { state: 'Galactic Hold' }, // unmapped state
  };

  it('reports drift without ever changing local state', async () => {
    const { ports, findings, repushed } = harness(remote);
    const summary = await reconcileProjections(ports);
    expect(summary).toMatchObject({ checked: 4, drift: 1, lost: 1, unreadable: 1 });
    const drift = findings.find((f) => f.taskId === 't2')!;
    expect(drift.kind).toBe('projection_drift');
    expect(drift.remote).toBe('Done');
    expect(drift.severity).toBe('drift');
    expect(drift.actionRequired).toMatch(/completion still needs evidence/);
  });

  it('repairs by re-pushing from the record, and says so', async () => {
    const { ports, repushed } = harness(remote);
    await reconcileProjections(ports);
    expect(repushed).toEqual(['t2', 't3']);
  });

  it('treats an unmapped remote state as an integrity problem, not a guess', async () => {
    const { ports, findings } = harness(remote);
    const summary = await reconcileProjections(ports);
    expect(summary.unreadable).toBe(1);
    const odd = findings.find((f) => f.taskId === 't4')!;
    expect(odd.kind).toBe('projection_unreadable');
    expect(odd.severity).toBe('integrity');
  });

  it('normalizes the states people actually type', () => {
    expect(normalizeRemote('Todo')).toBe('open');
    expect(normalizeRemote('  completed ')).toBe('done');
    expect(normalizeRemote('Cancelled')).toBe('blocked');
    expect(normalizeRemote(null)).toBe('unknown');
  });
});
