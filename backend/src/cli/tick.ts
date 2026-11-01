import { createStore } from '../store/pg.js';
import { escalationFor, type Lease } from '../domain/leases.js';
import { expire, type Handoff } from '../domain/handoff.js';

/**
 * the ticker. deliberately boring: it runs every 15 seconds, does one pass,
 * writes events for anything that changed and exits. no long-lived workers,
 * so a crash cannot leave a responsibility looking staffed.
 */
async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL is required');
    process.exit(1);
  }
  const store = createStore(url);
  const now = new Date().toISOString();

  const expired = await store.query<{ id: string; circle: string; holder: string }>(
    `update lease set state = 'expired'
      where state = 'held' and expires_at < $1
      returning id, circle, holder`,
    [now],
  );

  for (const row of expired) {
    const lease: Lease = {
      id: row.id,
      circle: row.circle,
      responsibility: 'oncall',
      holder: row.holder,
      acquiredAt: now,
      expiresAt: now,
      heartbeatMs: 0,
      maxRenewals: 0,
      renewals: 0,
      state: 'expired',
      lastHeartbeat: now,
    };
    const step = escalationFor(lease, now);
    await store.appendEvent(
      `circle:${row.circle}`,
      { type: 'lease.expired', lease: row.id, holder: row.holder, escalation: step?.kind ?? 'page_next_holder' },
      now,
    );
    console.log(`lease ${row.id} expired → ${step?.kind ?? 'page_next_holder'}`);
  }

  const stale = await store.query<{ id: string; from_seat: string; to_seat: string; offered_at: string; timeout_ms: number }>(
    `update handoff set state = 'expired'
      where state = 'offered' and offered_at + (timeout_ms || ' milliseconds')::interval < $1
      returning id, from_seat, to_seat, offered_at, timeout_ms`,
    [now],
  );

  for (const row of stale) {
    const h: Handoff = {
      id: row.id,
      from: row.from_seat,
      to: row.to_seat,
      precondition: '',
      payloadRef: 'artifact://unknown',
      acceptanceRequired: true,
      timeoutMs: row.timeout_ms,
      offeredAt: row.offered_at,
      state: 'offered',
    };
    const next = expire(h, now);
    await store.appendEvent('handoffs', { type: 'handoff.expired', handoff: row.id }, now);
    console.log(`handoff ${next.id} expired, bounced to ${next.from}`);
  }

  await store.close();
  console.log(`tick complete: ${expired.length} leases, ${stale.length} handoffs`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
