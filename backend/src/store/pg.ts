import pg from 'pg';
import { EventRecord, GENESIS, append } from '../domain/events.js';

const { Pool } = pg;

/**
 * postgres is the coordination store, not a cache.
 *
 * this is the one place the spec's earlier instinct (git as the write path) had to
 * be inverted: leases, handoffs and surface locks need atomic multi-row transitions,
 * and a filesystem cannot join a transaction. portability is preserved by exporting
 * the event log to jsonl, which is what the audit actually needs.
 */
export interface Store {
  query<T extends pg.QueryResultRow = pg.QueryResultRow>(sql: string, params?: unknown[]): Promise<T[]>;
  tx<T>(fn: (c: pg.PoolClient) => Promise<T>): Promise<T>;
  appendEvent(stream: string, payload: Record<string, unknown>, at: string): Promise<EventRecord>;
  claimLease(input: {
    id: string;
    circle: string;
    responsibility: string;
    holder: string;
    acquiredAt: string;
    expiresAt: string;
    heartbeatMs: number;
  }): Promise<boolean>;
  withSurfaceLock<T>(surfaceId: string, fn: () => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

export function createStore(connectionString: string): Store {
  const pool = new Pool({ connectionString, max: 10 });

  async function appendWithin(c: pg.PoolClient, stream: string, payload: Record<string, unknown>, at: string) {
    // serialize appends per stream so the hash chain has one writer at a time
    await c.query('select pg_advisory_xact_lock(hashtext($1))', [stream]);
    const last = await c.query<{ seq: string; hash: string }>(
      'select seq, hash from event where stream = $1 order by seq desc limit 1',
      [stream],
    );
    const prev = last.rows[0]
      ? ({ seq: Number(last.rows[0].seq), hash: last.rows[0].hash } as EventRecord)
      : null;
    const record = append(prev, payload, at);
    await c.query(
      `insert into event (stream, seq, id, at, payload, prev_hash, hash)
       values ($1, $2, $3, $4, $5, $6, $7)`,
      [stream, record.seq, record.id, record.at, payload, record.prevHash ?? GENESIS, record.hash],
    );
    return record;
  }

  return {
    async query(sql, params) {
      const res = await pool.query(sql, params as unknown[]);
      return res.rows;
    },
    async tx(fn) {
      const c = await pool.connect();
      try {
        await c.query('begin');
        const out = await fn(c);
        await c.query('commit');
        return out;
      } catch (err) {
        await c.query('rollback');
        throw err;
      } finally {
        c.release();
      }
    },
    async appendEvent(stream, payload, at) {
      return this.tx((c) => appendWithin(c, stream, payload, at));
    },
    async claimLease(input) {
      const rows = await pool.query(
        `insert into lease (id, circle, responsibility, holder, acquired_at, expires_at, heartbeat_ms, renewals, max_renewals, state, last_heartbeat)
         values ($1, $2, $3, $4, $5, $6, $7, 0, 2, 'held', $5)
         on conflict (circle, responsibility) where state = 'held' do nothing
         returning id`,
        [input.id, input.circle, input.responsibility, input.holder, input.acquiredAt, input.expiresAt, input.heartbeatMs],
      );
      return rows.rowCount === 1;
    },
    async withSurfaceLock(surfaceId, fn) {
      return this.tx(async (c) => {
        await c.query('select pg_advisory_xact_lock(hashtext($1))', [`surface:${surfaceId}`]);
        return fn();
      });
    },
    async close() {
      await pool.end();
    },
  };
}
