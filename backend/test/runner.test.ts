import { describe, expect, it } from 'vitest';
import { chooseRunner, cliRunner, psqlRunner, setRunner } from '../src/store/sql-cli.js';

/**
 * docs/44. self-hostable is a property of the driver: with DATABASE_URL set nothing about
 * this repo needs a vendor, and without it the sandbox cli is used. one place decides.
 */
describe('which database driver a machine uses', () => {
  it('uses psql when there is a postgres url, because that is what self-hosting means', () => {
    expect(chooseRunner({ DATABASE_URL: 'postgres://localhost/clawcrew' })).toBe(psqlRunner);
    expect(chooseRunner({ DATABASE_URL: 'postgres://localhost/clawcrew' }).name).toBe('psql');
  });

  it('falls back to the cli only when no url exists', () => {
    expect(chooseRunner({})).toBe(cliRunner);
  });

  it('can be swapped, so a test never shells out to a real database', () => {
    setRunner({ name: 'fake', run: () => '##7##' });
    setRunner(chooseRunner({}));
    expect(chooseRunner({}).name).toBe('insforge-cli');
  });
});
