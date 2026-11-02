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
