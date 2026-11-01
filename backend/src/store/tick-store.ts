import { Schedule, Priority, CatchUp } from '../domain/scheduler.js';
import { WorkRow, WorkState, Action } from '../domain/liveness.js';
import { GENESIS, hashOf } from '../domain/events.js';
import { RelayMessage, RelayState } from '../domain/relay-queue.js';
import { TickerPorts } from '../jobs/ticker.js';

/** anything with pg-shaped query(): a pg.Pool, a pg.Client, or PGlite */
export interface Queryable {
  query<T = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ): Promise<{ rows: T[] }>;
}

interface ScheduleRow {
  id: string;
  kind: string;
  ref: string;
  tier: string;
  every_seconds: number;
  priority: string;
  catch_up: string;
  enabled: boolean;
  next_due_at: string | Date;
  last_fired_at: string | Date | null;
  last_fire_key: string | null;
}

interface RelayRow {
  id: string;
  from_tier: string;
  to_tier: string;
  crossing: string;
  kind: string;
  dedupe_key: string;
  payload_ref: string;
  seq: string | number;
  priority: string;
  state: string;
  attempts: number;
  max_attempts: number;
  created_at: string | Date;
  expires_at: string | Date;
  next_attempt_at: string | Date;
  locked_until: string | Date | null;
  holder: string | null;
  path: string[];
  acked_at: string | Date | null;
  dead_reason: string | null;
}

export interface TaskRow {
  id: string;
  state: string;
  owner_tier: string;
  objective_id: string | null;
  surfaces: string[] | null;
  next_action_at: string | Date | null;
  claim_deadline_at: string | Date | null;
  progress_version: number;
  progress_at: string | Date | null;
  attempts: number;
  max_attempts: number;
  blocking_reason: string | null;
  evidence_ref: string | null;
  cancelled_reason: string | null;
  cancelled_by: string | null;
  custody_holder: string | null;
  custody_expires_at: string | Date | null;
  custody_renewals: number;
}

const iso = (v: string | Date): string => (v instanceof Date ? v.toISOString() : v);
const isoOrUndef = (v: string | Date | null): string | undefined =>
  v === null ? undefined : iso(v);

export function toSchedule(r: ScheduleRow): Schedule {
  return {
    id: r.id,
    kind: r.kind,
    ref: r.ref,
    tier: r.tier,
    everySeconds: r.every_seconds,
    priority: r.priority as Priority,
    catchUp: r.catch_up as CatchUp,
    enabled: r.enabled,
    nextDueAt: iso(r.next_due_at),
    ...(r.last_fired_at ? { lastFiredAt: iso(r.last_fired_at) } : {}),
    ...(r.last_fire_key ? { lastFireKey: r.last_fire_key } : {}),
  };
}

export function toRelay(r: RelayRow): RelayMessage {
  return {
    id: r.id,
    from: r.from_tier,
    to: r.to_tier,
    crossing: r.crossing,
    kind: r.kind,
    dedupeKey: r.dedupe_key,
    payloadRef: r.payload_ref,
    seq: Number(r.seq),
    priority: r.priority as RelayMessage['priority'],
    state: r.state as RelayState,
    attempts: r.attempts,
    maxAttempts: r.max_attempts,
    createdAt: iso(r.created_at),
    expiresAt: iso(r.expires_at),
    nextAttemptAt: iso(r.next_attempt_at),
    ...(r.locked_until ? { lockedUntil: iso(r.locked_until) } : {}),
    ...(r.holder ? { holder: r.holder } : {}),
    path: r.path,
    ...(r.acked_at ? { ackedAt: iso(r.acked_at) } : {}),
    ...(r.dead_reason ? { deadReason: r.dead_reason } : {}),
  };
}

export function toWork(r: TaskRow): WorkRow {
  return {
    id: r.id,
    state: r.state as WorkState,
    tier: r.owner_tier,
    objectiveRef: r.objective_id ?? '',
    surfaces: r.surfaces ?? [],
    nextActionAt: isoOrUndef(r.next_action_at),
    claimDeadlineAt: isoOrUndef(r.claim_deadline_at),
    lease:
      r.custody_holder && r.custody_expires_at
        ? {
            holder: r.custody_holder,
            expiresAt: iso(r.custody_expires_at),
            renewals: r.custody_renewals,
          }
        : undefined,
    progressVersion: r.progress_version,
    progressAt: isoOrUndef(r.progress_at),
    attempts: r.attempts,
    maxAttempts: r.max_attempts,
    blockedReason: r.blocking_reason ?? undefined,
    evidenceRef: r.evidence_ref ?? undefined,
    cancelledReason: r.cancelled_reason ?? undefined,
    cancelledBy: r.cancelled_by ?? undefined,
  };
}

/** the one write path for a work row. every state change goes through it. */
export async function writeWork(db: Queryable, w: WorkRow): Promise<void> {
  await db.query(
    `update task
        set state = $2, attempts = $3, next_action_at = $4,
            claim_deadline_at = $5, blocking_reason = $6,
            custody_holder = $7, custody_expires_at = $8,
            custody_renewals = $9, evidence_ref = $10,
            cancelled_reason = $11, cancelled_by = $12,
            progress_version = $13,
            completed_at = case when $2 = 'done' then coalesce(completed_at, now())
                                else completed_at end
      where id = $1`,
    [
      w.id,
      w.state,
      w.attempts,
      w.nextActionAt ?? null,
      w.claimDeadlineAt ?? null,
      w.blockedReason ?? null,
      w.lease?.holder ?? null,
      w.lease?.expiresAt ?? null,
      w.lease?.renewals ?? 0,
      w.evidenceRef ?? null,
      w.cancelledReason ?? null,
      w.cancelledBy ?? null,
      w.progressVersion,
    ],
  );
}

/** identical findings collapse: the condition is the identity, not the tick. */
export function findingKey(f: Action): string {
  switch (f.kind) {
    // one per row, not one per window: a row nobody can claim is one finding
    // with a long history, and re-arming must not mint a new alarm each time.
    case 'alarm_unclaimable':
      return `${f.kind}:${f.rowId}`;
    case 'alarm_stall':
      return `${f.kind}:${f.rowId}:${f.since}`;
    case 'violation':
      return `${f.kind}:${f.rowId}:${f.rule}`;
    default:
      return `${f.kind}:${f.rowId}`;
  }
}

export interface TickStoreOptions {
  /** a dedicated connection, because advisory locks are session scoped */
  lockClient: Queryable;
  onWake?: (wake: { kind: string; ref: string; tier: string; firedAt: string }) => Promise<void>;
  onDeliver?: (m: RelayMessage) => Promise<'ack' | 'nack'>;
}

export function createTickStore(db: Queryable, opts: TickStoreOptions): TickerPorts {
  return {
    async tryLock() {
      const r = await opts.lockClient.query<{ ok: boolean }>(
        `select pg_try_advisory_lock(hashtext('orchart_ticker')) as ok`,
      );
      return r.rows[0]?.ok === true;
    },

    async loadSchedules() {
      const r = await db.query<ScheduleRow>(
        `select * from schedule where enabled order by next_due_at`,
      );
      return r.rows.map(toSchedule);
    },

    async saveSchedule(s) {
      await db.query(
        `update schedule
            set next_due_at = $2, last_fired_at = $3, last_fire_key = $4
          where id = $1
            and (last_fire_key is distinct from $4)`,
        [s.id, s.nextDueAt, s.lastFiredAt ?? null, s.lastFireKey ?? null],
      );
    },

    async emitWake(s, firedAt) {
      for (const at of firedAt) {
        await db.query(
          `insert into wake (kind, ref, tier, fired_at) values ($1, $2, $3, $4)`,
          [s.kind, s.ref, s.tier, at],
        );
      }
      if (opts.onWake) {
        for (const at of firedAt) {
          await opts.onWake({ kind: s.kind, ref: s.ref, tier: s.tier, firedAt: at });
        }
      }
    },

    async loadRelay() {
      const r = await db.query<RelayRow>(
        `select * from relay_message where state in ('queued', 'leased')`,
      );
      return r.rows.map(toRelay);
    },

    async saveRelay(m) {
      await db.query(
        `update relay_message
            set state = $2, attempts = $3, next_attempt_at = $4,
                locked_until = $5, holder = $6, path = $7,
                acked_at = $8, dead_reason = $9
          where id = $1`,
        [
          m.id,
          m.state,
          m.attempts,
          m.nextAttemptAt,
          m.lockedUntil ?? null,
          m.holder ?? null,
          m.path,
          m.ackedAt ?? null,
          m.deadReason ?? null,
        ],
      );
    },

    async deliver(m) {
      if (!opts.onDeliver) return 'nack';
      return opts.onDeliver(m);
    },

    async loadWork(limit = 200) {
      const r = await db.query<TaskRow>(
        `select id, state, owner_tier, objective_id, surfaces, next_action_at,
                claim_deadline_at, progress_version, progress_at, attempts,
                max_attempts, blocking_reason, evidence_ref, cancelled_reason,
                cancelled_by, custody_holder, custody_expires_at, custody_renewals
           from task
          where state in ('ready', 'leased', 'blocked')
          order by next_action_at nulls last
          limit $1`,
        [limit],
      );
      return r.rows.map(toWork);
    },

    async saveWork(w) {
      await writeWork(db, w);
    },

    /** findings go on the hash chain, so an alarm cannot be quietly dropped */
    async recordFindings(findings: Action[], at: string) {
      if (findings.length === 0) return;
      const head = await db.query<{ seq: string | number; hash: string }>(
        `select seq, hash from event where stream = 'liveness' order by seq desc limit 1`,
      );
      let seq = head.rows[0] ? Number(head.rows[0].seq) + 1 : 1;
      let prevHash = head.rows[0]?.hash ?? GENESIS;

      for (const f of findings) {
        // one finding per condition, not one per tick: a stall that persists for
        // a day is one record with its original deadline, not 17,000 records.
        const dedupeKey = findingKey(f);
        const seen = await db.query<{ present: number }>(
          `select 1 as present from event
            where stream = 'liveness' and payload->>'dedupeKey' = $1 limit 1`,
          [dedupeKey],
        );
        if (seen.rows.length > 0) continue;

        const payload = { ...f, dedupeKey } as Record<string, unknown>;
        const hash = hashOf(prevHash, seq, at, payload);
        await db.query(
          `insert into event (stream, seq, id, at, payload, prev_hash, hash)
           values ('liveness', $1, $2, $3, $4, $5, $6)`,
          [seq, `evt.${seq}.${hash.slice(0, 8)}`, at, payload, prevHash, hash],
        );
        prevHash = hash;
        seq += 1;
      }
    },

    async heartbeat(h) {
      await db.query(
        `insert into ticker_heartbeat (id, at, tick_count, lag_ms)
         values (true, $1, $2, $3)
         on conflict (id) do update
           set at = excluded.at,
               tick_count = excluded.tick_count,
               lag_ms = excluded.lag_ms`,
        [h.at, h.tickCount, h.lagMs],
      );
    },
  };
}
