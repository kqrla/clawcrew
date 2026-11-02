import { describe, expect, it } from 'vitest';
import {
  Reading,
  acceptReading,
  duplicateSources,
  parseSource,
} from '../src/domain/measure.js';

const NOW = '2026-11-02T01:00:00.000Z';
const hoursAgo = (h: number) => new Date(Date.parse(NOW) - h * 3_600_000).toISOString();

const subject = {
  ref: 'obj.meenible.code.repo',
  source: 'git:rev-list --count origin/main --since=7.days',
  ownerTier: 't.test01.code',
};

const reading = (over: Partial<Reading> = {}): Reading => ({
  objectiveRef: subject.ref,
  objectiveVersion: 1,
  source: subject.source,
  value: 6,
  ok: true,
  computedAt: hoursAgo(1),
  runBy: 'runner.gauges',
  ...over,
});

describe('a source has to be an expression', () => {
  it('parses each of the four kinds', () => {
    expect(parseSource('sql:select count(*) from orders').ok).toBe(true);
    expect(parseSource('http:GET https://api.stripe.com/v1/charges').ok).toBe(true);
    expect(parseSource('git:rev-list --count origin/main').ok).toBe(true);
    expect(parseSource('run:npm test -- --reporter=json').ok).toBe(true);
  });

  it('refuses a name someone has to interpret', () => {
    expect(parseSource('stripe.charges')).toEqual({ ok: false, reason: 'source_not_executable' });
    expect(parseSource('ops team weekly')).toEqual({ ok: false, reason: 'source_not_executable' });
  });

  it('refuses an empty payload and a placeholder', () => {
    expect(parseSource('sql:   ')).toEqual({ ok: false, reason: 'source_has_no_payload' });
    expect(parseSource('run:report TBD')).toEqual({ ok: false, reason: 'source_is_a_placeholder' });
  });

  it('refuses an http source that is not a url', () => {
    expect(parseSource('http:stripe.com/charges')).toEqual({
      ok: false,
      reason: 'http_source_needs_a_url',
    });
  });
});

describe('a reading counts or it does not', () => {
  it('accepts a fresh reading taken by a runner that is not the measured tier', () => {
    expect(acceptReading(subject, reading(), { now: NOW })).toEqual({ ok: true });
  });

  it('refuses an objective nobody ever ran', () => {
    expect(acceptReading(subject, undefined, { now: NOW })).toMatchObject({
      ok: false,
      reason: 'no_reading',
    });
  });

  it('keeps the failure message, so the gap is workable', () => {
    const failed = reading({ ok: false, value: null, detail: 'relation "ticket" does not exist' });
    expect(acceptReading(subject, failed, { now: NOW })).toMatchObject({
      ok: false,
      reason: 'source_failed',
      detail: 'relation "ticket" does not exist',
    });
  });

  it('refuses a reading of a source that has since changed', () => {
    const other = reading({ source: 'git:rev-list --count origin/main' });
    expect(acceptReading(subject, other, { now: NOW })).toMatchObject({
      ok: false,
      reason: 'source_changed_since_reading',
    });
  });

  it('refuses the owning tier measuring itself', () => {
    expect(acceptReading(subject, reading({ runBy: 't.test01.code' }), { now: NOW })).toMatchObject({
      ok: false,
      reason: 'self_measured',
    });
    expect(acceptReading(subject, reading({ runBy: 'self' }), { now: NOW })).toMatchObject({
      ok: false,
      reason: 'self_measured',
    });
  });

  it('refuses a reading older than the freshness window', () => {
    expect(acceptReading(subject, reading({ computedAt: hoursAgo(30) }), { now: NOW })).toMatchObject({
      ok: false,
      reason: 'reading_stale',
    });
  });

  it('refuses a number that is not a number', () => {
    expect(acceptReading(subject, reading({ value: Number.NaN }), { now: NOW })).toMatchObject({
      ok: false,
      reason: 'value_not_a_number',
    });
  });

  it('refuses a reading from the future, which means a broken clock somewhere', () => {
    const ahead = new Date(Date.parse(NOW) + 60_000).toISOString();
    expect(acceptReading(subject, reading({ computedAt: ahead }), { now: NOW })).toMatchObject({
      ok: false,
      reason: 'reading_from_the_future',
    });
  });

  it('refuses a reading recorded against a different objective', () => {
    expect(
      acceptReading(subject, reading({ objectiveRef: 'obj.meenible.design.studio' }), { now: NOW }),
    ).toMatchObject({ ok: false, reason: 'reading_for_another_objective' });
  });
});

describe('one gauge cannot be two metrics', () => {
  it('finds the copy-pasted source', () => {
    const shared = duplicateSources([
      { ref: 'obj.a', source: 'sql:select count(*) from orders', ownerTier: 't.a' },
      { ref: 'obj.b', source: 'sql:select count(*) from orders', ownerTier: 't.b' },
      { ref: 'obj.c', source: 'git:rev-list --count origin/main', ownerTier: 't.c' },
    ]);
    expect(shared).toHaveLength(1);
    expect(shared[0]!.refs.sort()).toEqual(['obj.a', 'obj.b']);
  });

  it('treats whitespace as the same expression', () => {
    const shared = duplicateSources([
      { ref: 'obj.a', source: 'sql:select 1 ', ownerTier: 't.a' },
      { ref: 'obj.b', source: 'sql:select 1', ownerTier: 't.b' },
    ]);
    expect(shared).toHaveLength(1);
  });
});
