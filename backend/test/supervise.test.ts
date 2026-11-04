import { describe, expect, it } from 'vitest';
import { Attempt, backoffMs, decide } from '../src/jobs/supervise.js';

/**
 * docs/43. the three ways a supervised loop ends, and the one way it continues.
 */
const base: Attempt = {
  restarts: 0,
  maxRestarts: 5,
  exitCode: null,
  ranForMs: 0,
  minUptimeMs: 5_000,
  crashes: 0,
  maxCrashes: 2,
  failures: 0,
  maxFailures: 3,
};

describe('a supervised loop', () => {
  it('runs while the child is running', () => {
    expect(decide(base)).toEqual({ action: 'run' });
  });

  it('stops without paging when the child finished its cycles', () => {
    expect(decide({ ...base, exitCode: 0, ranForMs: 60_000 })).toEqual({
      action: 'stop',
      reason: 'finished',
      page: false,
    });
  });

  it('restarts a child that ran for a while and then died', () => {
    const step = decide({ ...base, exitCode: 1, ranForMs: 60_000, restarts: 1 });
    expect(step).toEqual({ action: 'restart', delayMs: backoffMs(1) });
  });

  it('gives up and pages when the child dies instantly, twice', () => {
    const step = decide({ ...base, exitCode: 1, ranForMs: 200, crashes: 2 });
    expect(step).toEqual({ action: 'stop', reason: 'crash_loop', page: true });
  });

  it('backs off instead of hammering, and caps the wait', () => {
    expect(backoffMs(0)).toBe(1000);
    expect(backoffMs(3)).toBe(8000);
    expect(backoffMs(20)).toBe(60_000);
  });

  it('stops and pages when the work keeps failing, even if each attempt lasted a while', () => {
    const step = decide({ ...base, exitCode: 1, ranForMs: 23_000, failures: 3, restarts: 2 });
    expect(step).toEqual({ action: 'stop', reason: 'failing', page: true });
  });

  it('stops paging when it has restarted too many times', () => {
    const step = decide({ ...base, exitCode: 1, ranForMs: 60_000, restarts: 5 });
    expect(step).toEqual({ action: 'stop', reason: 'too_many_restarts', page: true });
  });
});
