import { describe, expect, it } from 'vitest';
import { guard, parseCookie } from '../src/store/sessions.js';
import { setRunner } from '../src/store/sql-cli.js';

/** docs/49. the actor comes from the session; the body is only ever a suggestion. */
describe('board sessions', () => {
  it('reads its own cookie out of a crowded header', () => {
    expect(parseCookie('a=1; bc_session=abc123; b=2')).toBe('abc123');
    expect(parseCookie('bc_session="q"')).toBe('q');
    expect(parseCookie('bc_session=')).toBeNull();
    expect(parseCookie(undefined)).toBeNull();
  });

  it('refuses a write with no cookie at all', () => {
    expect(guard(undefined)).toEqual({ ok: false, why: 'no_session' });
  });

  it('refuses a token the database does not know', () => {
    setRunner({ name: 'fake', run: () => '## ##' });
    expect(guard('bc_session=guessed')).toEqual({ ok: false, why: 'expired' });
  });

  it('takes the actor from the row, not from the request', () => {
    setRunner({ name: 'fake', run: () => '##human:anne##' });
    expect(guard('bc_session=real')).toEqual({ ok: true, actor: 'human:anne' });
  });
});
