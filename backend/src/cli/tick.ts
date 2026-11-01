import pg from 'pg';
import { createTickStore } from '../store/tick-store.js';
import { runTick } from '../jobs/ticker.js';
import { RelayMessage } from '../domain/relay-queue.js';

const { Pool } = pg;

/**
 * the night shift: one tick every few seconds, forever.
 *
 *   node dist/cli/tick.js            # loop
 *   node dist/cli/tick.js --once     # single tick, for cron or a test
 *   node dist/cli/tick.js --once --require-transport
 *
 * relay delivery is disabled until a transport is configured, because a ticker
 * that acks messages it never delivered is worse than one that does nothing.
 */
async function main(): Promise<void> {
  const once = process.argv.includes('--once');
  const requireTransport = process.argv.includes('--require-transport');
  const intervalMs = Number(process.env.ORCHART_TICK_MS ?? 5000);
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');

  const pool = new Pool({ connectionString: url });
  const lockClient = await pool.connect();

  const transportConfigured = process.env.ORCHART_TRANSPORT !== undefined;
  if (requireTransport && !transportConfigured) {
    throw new Error('ORCHART_TRANSPORT is not set; refusing to run relay delivery');
  }

  const store = createTickStore(pool, {
    lockClient,
    onDeliver: async (m: RelayMessage): Promise<'ack' | 'nack'> => {
      // no transport yet: see docs/22 §11. the relay stays queued rather than
      // pretending delivery happened.
      console.warn(`[relay] no transport configured, leaving ${m.id} queued`);
      return 'nack';
    },
  });

  const ports = transportConfigured
    ? store
    : { ...store, loadRelay: async () => [] };

  let tickCount = 0;
  const once_ = async (): Promise<void> => {
    const now = new Date().toISOString();
    const report = await runTick(ports, { now, tickCount: ++tickCount });
    if (once || report.fired > 0 || report.relayLeased > 0) {
      console.log(JSON.stringify(report));
    }
  };

  await once_();
  if (once) {
    await pool.end();
    return;
  }

  const timer = setInterval(() => {
    once_().catch((err) => {
      console.error('[tick] failed', err);
    });
  }, intervalMs);

  const shutdown = async (): Promise<void> => {
    clearInterval(timer);
    await pool.end();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
