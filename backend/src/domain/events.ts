import { createHash } from 'node:crypto';

// append-only, hash-chained. this makes silent rewriting detectable, which is the
// property that matters when the only witnesses are agents.
export interface EventRecord {
  id: string;
  at: string;
  seq: number;
  payload: Record<string, unknown>;
  prevHash: string;
  hash: string;
}

export function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`);
  return `{${entries.join(',')}}`;
}

export function hashOf(prevHash: string, seq: number, at: string, payload: unknown): string {
  return createHash('sha256')
    .update(prevHash)
    .update('\u241f')
    .update(String(seq))
    .update('\u241f')
    .update(at)
    .update('\u241f')
    .update(canonical(payload))
    .digest('hex');
}

export const GENESIS = '0'.repeat(64);

export function append(
  prev: EventRecord | null,
  payload: Record<string, unknown>,
  at: string,
): EventRecord {
  const seq = prev ? prev.seq + 1 : 1;
  const prevHash = prev ? prev.hash : GENESIS;
  const hash = hashOf(prevHash, seq, at, payload);
  return { id: `evt.${seq}.${hash.slice(0, 8)}`, at, seq, payload, prevHash, hash };
}

export interface VerifyResult {
  ok: boolean;
  brokenAt?: number;
  reason?: string;
}

export function verifyChain(events: EventRecord[]): VerifyResult {
  let prevHash = GENESIS;
  let expectedSeq = 1;
  for (const e of events) {
    if (e.seq !== expectedSeq) return { ok: false, brokenAt: e.seq, reason: 'sequence_gap' };
    if (e.prevHash !== prevHash) return { ok: false, brokenAt: e.seq, reason: 'prev_hash_mismatch' };
    const recomputed = hashOf(e.prevHash, e.seq, e.at, e.payload);
    if (recomputed !== e.hash) return { ok: false, brokenAt: e.seq, reason: 'hash_mismatch' };
    prevHash = e.hash;
    expectedSeq += 1;
  }
  return { ok: true };
}

export function headHash(events: EventRecord[]): string {
  return events.length === 0 ? GENESIS : events[events.length - 1]!.hash;
}

/** jsonl is the export format: portable, greppable, auditable without a vendor. */
export function toJsonl(events: EventRecord[]): string {
  return events.map((e) => JSON.stringify(e)).join('\n') + (events.length ? '\n' : '');
}

export function fromJsonl(text: string): EventRecord[] {
  return text
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as EventRecord);
}
