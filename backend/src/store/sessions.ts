/**
 * docs/49. who is dragging. the body may say anything; the cookie cannot.
 *
 * a session is a row with an expiry, issued only against the board passphrase. writes take the
 * actor from that row, so "signed as you" requires your passphrase, not your honesty.
 */
import { randomBytes } from 'node:crypto';
import { cell, lit, sql } from './sql-cli.js';

export const COOKIE = 'bc_session';

/** `a=1; bc_session=xyz; b=2` -> xyz. a cookie parser, not a regex test, because a regex that
 *  matches the wrong pair is how a session becomes someone else's. */
export function parseCookie(header: string | undefined, name = COOKIE): string | null {
  if (!header) return null;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() !== name) continue;
    const v = part.slice(eq + 1).trim().replace(/^"|"$/g, '');
    return v.length > 0 ? v : null;
  }
  return null;
}

export function issueSession(actor: string, ttlHours = 12): string {
  const token = randomBytes(24).toString('hex');
  sql(
    `insert into bc_session (token, actor, expires_at) values (${lit(token)}, ${lit(actor)}, now() + interval '${ttlHours} hours')`,
  );
  return token;
}

export function sessionActor(token: string | null): string | null {
  if (!token) return null;
  const actor = cell(
    `coalesce((select actor from bc_session where token = ${lit(token)} and expires_at > now()), '')`,
  );
  return actor || null;
}

export function revoke(token: string): void {
  sql(`delete from bc_session where token = ${lit(token)}`);
}

/** one guard for every write route, so a new route cannot quietly forget it */
export type Guard = { ok: true; actor: string } | { ok: false; why: 'no_session' | 'expired' };

export function guard(cookieHeader: string | undefined): Guard {
  const token = parseCookie(cookieHeader);
  if (!token) return { ok: false, why: 'no_session' };
  const actor = sessionActor(token);
  return actor ? { ok: true, actor } : { ok: false, why: 'expired' };
}
