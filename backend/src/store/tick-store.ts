import { Schedule, Priority, CatchUp } from '../domain/scheduler.js';
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
