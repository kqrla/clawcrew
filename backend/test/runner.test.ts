import { describe, expect, it } from 'vitest';
import { chooseRunner, cliRunner, pgRunner, psqlRunner, setRunner } from '../src/store/sql-cli.js';

/**
 * docs/44. self-hostable is a property of the driver: with DATABASE_URL set nothing about
 * this repo needs a vendor, and without it the sandbox cli is used. one place decides.
 */
describe('which database driver a machine uses', () => {
  it('uses node-pg when there is a postgres url, because it needs nothing installed', () => {
    expect(chooseRunner({ DATABASE_URL: 'postgres://localhost/clawcrew' })).toBe(pgRunner);
    expect(chooseRunner({ DATABASE_URL: 'postgres://localhost/clawcrew' }).name).toBe('node-pg');
  });

  it('uses psql only when the box is asked for psql', () => {
    const env = { DATABASE_URL: 'postgres://localhost/clawcrew', CLAWCREW_DRIVER: 'psql' };
    expect(chooseRunner(env)).toBe(psqlRunner);
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
