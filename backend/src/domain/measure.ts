/**
 * the gauge layer. docs/31.
 *
 * `objective.source` already has to be executable, enforced by a check
 * constraint. that proves a metric *can* be computed. it does not prove anyone
 * ever ran it, or that the number means what the statement claims. ten plausible
 * `sql:` strings returning integers would satisfy every gate in docs/30.
 *
 * so a source is not a measurement until it has been run, by something that is
 * not the tier being measured, and the result was recorded. this module decides
 * whether a recording counts. it never runs anything: execution is a port, so a
 * test can feed a reading rather than a database.
 */
export type SourceKind = 'sql' | 'http' | 'git' | 'run';

export const SOURCE_KINDS: SourceKind[] = ['sql', 'http', 'git', 'run'];

export interface SourcePlan {
  kind: SourceKind;
  /** the part after the scheme: a query, a url, an argv string, a script */
  payload: string;
  /** the source exactly as declared, so a recorded reading can be matched to it */
  source: string;
}

const SCHEME = /^(sql|http|git|run):/;

export function parseSource(source: string): { ok: true; plan: SourcePlan } | { ok: false; reason: string } {
  if (typeof source !== 'string') return { ok: false, reason: 'source_not_a_string' };
  const trimmed = source.trim();
  const m = SCHEME.exec(trimmed);
  if (!m) return { ok: false, reason: 'source_not_executable' };
  const kind = m[1] as SourceKind;
  const payload = trimmed.slice(m[0].length).trim();
  if (payload.length === 0) return { ok: false, reason: 'source_has_no_payload' };
  // a method is allowed in front of the url, because a gauge is often a POST
  if (kind === 'http' && !/^https?:\/\//.test(payload.replace(/^(GET|POST|PUT|HEAD)\s+/i, ''))) {
    return { ok: false, reason: 'http_source_needs_a_url' };
  }
  // a source that needs a human to interpret it is not a source
  if (/\b(TBD|todo|manual|ask|maybe)\b/i.test(payload)) {
    return { ok: false, reason: 'source_is_a_placeholder' };
  }
  return { ok: true, plan: { kind, payload, source: trimmed } };
}

export interface Reading {
  /** which expression produced it. a crosscheck is a second way to ask the same question */
  role?: 'primary' | 'crosscheck';
  objectiveRef: string;
  objectiveVersion: number;
  /** the source string that was actually run */
  source: string;
  /** null when the run failed */
  value: number | null;
  ok: boolean;
  detail?: string;
  computedAt: string;
  /** who ran it. the tier being measured is not an acceptable answer */
  runBy: string;
}

export const DEFAULT_MAX_AGE_MS = 24 * 60 * 60_000;

export interface ObjectiveSubject {
  ref: string;
  source: string;
  ownerTier: string;
}

export function acceptReading(
  objective: ObjectiveSubject,
  reading: Reading | undefined,
  opts: { now: string; maxAgeMs?: number } = { now: new Date().toISOString() },
): { ok: true } | { ok: false; reason: string; detail?: string } {
  if (!reading) return { ok: false, reason: 'no_reading' };
  if (!reading.ok) {
    return { ok: false, reason: 'source_failed', detail: reading.detail ?? 'the run did not succeed' };
  }
  if (reading.objectiveRef !== objective.ref) {
    return { ok: false, reason: 'reading_for_another_objective' };
  }
  // a reading of a different source is a reading of a different metric
  if (reading.source.trim() !== objective.source.trim()) {
    return { ok: false, reason: 'source_changed_since_reading' };
  }
  if (reading.value === null || !Number.isFinite(reading.value)) {
    return { ok: false, reason: 'value_not_a_number' };
  }
  if (reading.runBy === 'self' || reading.runBy === objective.ownerTier) {
    return { ok: false, reason: 'self_measured' };
  }
  const at = Date.parse(reading.computedAt);
  if (Number.isNaN(at)) return { ok: false, reason: 'reading_time_invalid' };
  const now = Date.parse(opts.now);
  if (Number.isNaN(now)) return { ok: false, reason: 'clock_invalid' };
  if (at > now) return { ok: false, reason: 'reading_from_the_future' };
  const maxAge = opts.maxAgeMs ?? DEFAULT_MAX_AGE_MS;
  if (now - at > maxAge) {
    return { ok: false, reason: 'reading_stale', detail: `older than ${Math.round(maxAge / 60_000)} minutes` };
  }
  return { ok: true };
}

/**
 * two objectives reading the same expression are one objective wearing two hats.
 * the copy-paste metric is the cheapest way to look measured, so it is refused
 * rather than flagged.
 */
export function duplicateSources(subjects: ObjectiveSubject[]): { source: string; refs: string[] }[] {
  const bySource = new Map<string, string[]>();
  for (const s of subjects) {
    const key = s.source.trim();
    bySource.set(key, [...(bySource.get(key) ?? []), s.ref]);
  }
  return [...bySource.entries()]
    .filter(([, refs]) => refs.length > 1)
    .map(([source, refs]) => ({ source, refs }));
}

/**
 * one number, two expressions.
 *
 * a metric computed by one expression is self-reporting one level down: the same
 * org writes the gauge and reads it. corroboration is the cheapest independent
 * check available, because it needs no second team, only a second way to ask.
 */
export type CorroborationState = 'agrees' | 'disagrees' | 'unverified' | 'not_declared';

export interface Corroboration {
  state: CorroborationState;
  /** why it is not a verdict, or the numbers that disagree */
  reason?: string;
  primary?: number;
  crosscheck?: number;
  spreadPct?: number;
  tolerancePct: number;
}

export const DEFAULT_TOLERANCE_PCT = 0.05;

/**
 * what is wrong with an objective's second expression, if anything. this is a
 * declaration check and runs at inception, when there are no readings yet: the
 * point is to refuse a plan that never intended to ask twice.
 */
export function crosscheckFault(subject: {
  source: string;
  crosscheckSource?: string | null;
}): string | undefined {
  const cross = (subject.crosscheckSource ?? '').trim();
  if (!cross) return 'not_declared';
  if (sameExpression(cross, subject.source)) return 'crosscheck_is_the_same_expression';
  if (!/^(sql|http|git|run):\S/.test(cross)) return 'crosscheck_not_executable';
  return undefined;
}

export const sameExpression = (a: string, b: string): boolean =>
  a.trim().toLowerCase().replace(/\s+/g, ' ') === b.trim().toLowerCase().replace(/\s+/g, ' ');

/**
 * does a second expression, run by somebody else, produce the same number?
 *
 * this cannot tell whether either expression measures the claim. it can tell
 * whether two independent attempts to measure it agree, which is the difference
 * between a number and a coincidence.
 */
export function corroborate(
  subject: { ref: string; source: string; crosscheckSource?: string | null },
  readings: Reading[],
  opts: { now: string; maxAgeMs?: number; tolerancePct?: number },
): Corroboration {
  const tolerancePct = opts.tolerancePct ?? DEFAULT_TOLERANCE_PCT;
  const declared = subject.crosscheckSource ?? null;
  if (!declared) return { state: 'not_declared', tolerancePct };
  if (sameExpression(declared, subject.source)) {
    return { state: 'not_declared', reason: 'crosscheck_is_the_same_expression', tolerancePct };
  }

  const pick = (role: 'primary' | 'crosscheck' | undefined, source: string): Reading | undefined =>
    readings
      .filter((r) => r.objectiveRef === subject.ref && (role ? (r.role ?? 'primary') === role : true))
      .filter((r) => r.source === source)
      .sort((a, b) => Date.parse(b.computedAt) - Date.parse(a.computedAt))[0];

  const primary = pick('primary', subject.source);
  const cross = pick('crosscheck', declared);

  if (!primary) return { state: 'unverified', reason: 'primary_never_run', tolerancePct };
  if (!cross) return { state: 'unverified', reason: 'crosscheck_never_run', tolerancePct };
  if (!primary.ok) return { state: 'unverified', reason: 'primary_failed', tolerancePct };
  if (!cross.ok) return { state: 'unverified', reason: 'crosscheck_failed', tolerancePct };

  const age = opts.maxAgeMs ?? DEFAULT_MAX_AGE_MS;
  for (const r of [primary, cross]) {
    if (!Number.isFinite(Date.parse(r.computedAt))) {
      return { state: 'unverified', reason: 'reading_time_invalid', tolerancePct };
    }
    if (Date.parse(opts.now) - Date.parse(r.computedAt) > age) {
      return { state: 'unverified', reason: 'reading_stale', tolerancePct };
    }
  }

  // two expressions run by the same runner are two ways of asking the same person
  if (primary.runBy === cross.runBy) {
    return { state: 'unverified', reason: 'same_runner', tolerancePct };
  }

  if (primary.value === null || cross.value === null) {
    return { state: 'unverified', reason: 'value_not_a_number', tolerancePct };
  }

  const a = primary.value;
  const b = cross.value;
  const scale = Math.max(Math.abs(a), Math.abs(b));
  // two zeros agree; one zero and one non-zero never do
  const spreadPct = scale === 0 ? 0 : Math.abs(a - b) / scale;

  return spreadPct <= tolerancePct
    ? { state: 'agrees', primary: a, crosscheck: b, spreadPct, tolerancePct }
    : { state: 'disagrees', primary: a, crosscheck: b, spreadPct, tolerancePct };
}
