import { describe, expect, it } from 'vitest';
import { planChild } from '../src/jobs/supervise.js';

/** docs/46. one pass per supervised run, and the supervisor keeps the clock. */
describe('what the supervisor hands the child', () => {
  it('turns a requested cadence into the supervisor sleep', () => {
    expect(planChild(['--every', '30000'])).toEqual({ childArgs: ['--cycles', '1'], everyMs: 30_000 });
  });

  it('strips a cycles flag from the caller, because one pass is the unit', () => {
    expect(planChild(['--cycles', '5', '--every=1000']).everyMs).toBe(1000);
    expect(planChild(['--cycles', '5']).childArgs).toEqual(['--cycles', '1']);
  });

  it('keeps other arguments for the child', () => {
    expect(planChild(['--verbose', '--every', '2000']).childArgs).toEqual(['--verbose', '--cycles', '1']);
  });
});
